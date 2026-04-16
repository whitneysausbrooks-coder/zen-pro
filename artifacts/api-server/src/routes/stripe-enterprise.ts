import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { getStripeClient, isStripeConfigured } from "../stripeClient";
import { query, auditLog, withTransaction } from "../lib/db";
import { getWebhookMetrics, retryDeadLetterQueue } from "../lib/enterpriseWebhook";
import { randomUUID } from "crypto";

const router: IRouter = Router();

function requireEnterpriseAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers["x-enterprise-key"] as string;
  const validKey = process.env.ENTERPRISE_API_KEY;
  if (!validKey || apiKey !== validKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.use("/stripe-enterprise/{*path}", requireEnterpriseAuth);

const ENTERPRISE_PRICE_PER_SEAT = 1200;
const SAAS_TAX_CODE = "txcd_10103001";
const BILLING_ADMIN_ROLES = ["admin"];

async function requireBillingRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  const callerEmail = req.headers["x-enterprise-caller"] as string;
  const companyId = req.body?.company_id || req.params?.companyId;

  if (!callerEmail || !companyId) {
    next();
    return;
  }

  try {
    const result = await query(
      `SELECT role FROM enterprise_users WHERE email = $1 AND company_id = $2`,
      [callerEmail, companyId]
    );

    if (result.rows.length > 0) {
      const role = result.rows[0].role;
      if (!BILLING_ADMIN_ROLES.includes(role)) {
        await auditLog(null, "billing_action_denied", "stripe", {
          caller_email: callerEmail,
          company_id: companyId,
          role,
          action: req.path,
        });
        res.status(403).json({
          error: "Insufficient permissions. Only admin users can perform billing actions.",
          required_role: "admin",
          current_role: role,
        });
        return;
      }
    }
  } catch {}

  next();
}

router.post("/stripe-enterprise/create-company", async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ error: "Stripe not configured" });
  }

  const schema = z.object({
    company_id: z.string().uuid(),
    company_name: z.string().min(1).max(200),
    admin_email: z.string().email(),
    employee_count: z.number().int().min(1).max(10000),
    address: z.object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postal_code: z.string().optional(),
      country: z.string().length(2).default("US"),
    }).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const stripe = getStripeClient();
    const { company_id, company_name, admin_email, employee_count, address } = parsed.data;

    const idempotencyKey = `create-company-${company_id}`;
    const customerParams: any = {
      email: admin_email,
      name: company_name,
      metadata: {
        nq_company_id: company_id,
        type: "enterprise",
        employee_count: String(employee_count),
      },
      tax: { validate_location: "deferred" as const },
    };

    if (address) {
      customerParams.address = {
        line1: address.line1 || "",
        line2: address.line2 || undefined,
        city: address.city || "",
        state: address.state || "",
        postal_code: address.postal_code || "",
        country: address.country,
      };
    }

    const customer = await stripe.customers.create(customerParams, {
      idempotencyKey,
    });

    await query(
      `UPDATE companies SET stripe_customer_id = $1 WHERE id = $2`,
      [customer.id, company_id]
    );

    await auditLog(null, "stripe_customer_created", "companies", {
      company_id,
      stripe_customer_id: customer.id,
      has_address: !!address,
    });

    return res.json({
      success: true,
      stripe_customer_id: customer.id,
      company_id,
    });
  } catch (err: any) {
    console.error("Enterprise Stripe customer error:", err.message);
    await auditLog(null, "stripe_customer_create_failed", "companies", { error: err.message });
    return res.status(500).json({ error: "Failed to create Stripe customer" });
  }
});

router.post("/stripe-enterprise/subscribe", requireBillingRole, async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ error: "Stripe not configured" });
  }

  const schema = z.object({
    company_id: z.string().uuid(),
    employee_count: z.number().int().min(1).max(10000),
    success_url: z.string().url().optional(),
    cancel_url: z.string().url().optional(),
    enable_tax: z.boolean().default(true),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const stripe = getStripeClient();
    const { company_id, employee_count, enable_tax } = parsed.data;

    const companyResult = await query(
      `SELECT name, stripe_customer_id FROM companies WHERE id = $1`,
      [company_id]
    );
    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    const company = companyResult.rows[0];
    if (!company.stripe_customer_id) {
      return res.status(400).json({ error: "Company has no Stripe customer. Call create-company first." });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const successUrl = parsed.data.success_url || `${baseUrl}/admin-dashboard?billing=success`;
    const cancelUrl = parsed.data.cancel_url || `${baseUrl}/admin-dashboard?billing=canceled`;
    const idempotencyKey = `subscribe-${company_id}-${employee_count}-${Date.now()}`;

    const sessionParams: any = {
      customer: company.stripe_customer_id,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: ENTERPRISE_PRICE_PER_SEAT,
            recurring: { interval: "month" },
            product_data: {
              name: "NeuroQuest Zen Pro Enterprise",
              description: `Workforce resilience platform — ${employee_count} seats`,
              tax_code: SAAS_TAX_CODE,
            },
          },
          quantity: employee_count,
        },
      ],
      mode: "subscription" as const,
      subscription_data: {
        metadata: {
          nq_company_id: company_id,
          type: "enterprise_subscription",
          employee_count: String(employee_count),
        },
      },
      metadata: {
        nq_company_id: company_id,
        type: "enterprise_subscription",
        employee_count: String(employee_count),
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    };

    if (enable_tax) {
      sessionParams.automatic_tax = { enabled: true };
    }

    const session = await stripe.checkout.sessions.create(sessionParams, {
      idempotencyKey,
    });

    await auditLog(null, "enterprise_checkout_started", "companies", {
      company_id,
      employee_count,
      session_id: session.id,
      tax_enabled: enable_tax,
    });

    return res.json({
      success: true,
      checkout_url: session.url,
      session_id: session.id,
      per_seat_price: ENTERPRISE_PRICE_PER_SEAT / 100,
      total_monthly: (ENTERPRISE_PRICE_PER_SEAT * employee_count) / 100,
      tax_enabled: enable_tax,
    });
  } catch (err: any) {
    console.error("Enterprise checkout error:", err.message);
    await auditLog(null, "enterprise_checkout_failed", "companies", { error: err.message });
    return res.status(500).json({ error: "Failed to create checkout session" });
  }
});

router.post("/stripe-enterprise/update-seats", requireBillingRole, async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ error: "Stripe not configured" });
  }

  const schema = z.object({
    company_id: z.string().uuid(),
    new_employee_count: z.number().int().min(1).max(10000),
    proration_behavior: z.enum(["create_prorations", "none", "always_invoice"]).default("create_prorations"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const stripe = getStripeClient();
    const { company_id, new_employee_count, proration_behavior } = parsed.data;

    const companyResult = await query(
      `SELECT stripe_customer_id, seat_count FROM companies WHERE id = $1`,
      [company_id]
    );
    if (companyResult.rows.length === 0 || !companyResult.rows[0].stripe_customer_id) {
      return res.status(404).json({ error: "Company or Stripe customer not found" });
    }

    const previousSeats = companyResult.rows[0].seat_count || 0;

    const subscriptions = await stripe.subscriptions.list({
      customer: companyResult.rows[0].stripe_customer_id,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return res.status(404).json({ error: "No active subscription found" });
    }

    const sub = subscriptions.data[0];
    const item = sub.items.data[0];

    const idempotencyKey = `update-seats-${company_id}-${new_employee_count}-${randomUUID()}`;
    await stripe.subscriptionItems.update(item.id, {
      quantity: new_employee_count,
      proration_behavior,
    }, {
      idempotencyKey,
    });

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE companies
         SET seat_count = $1
         WHERE id = $2`,
        [new_employee_count, company_id]
      );
    });

    await auditLog(null, "enterprise_seats_updated", "companies", {
      company_id,
      previous_seats: previousSeats,
      new_employee_count,
      proration_behavior,
      subscription_id: sub.id,
    });

    return res.json({
      success: true,
      previous_seats: previousSeats,
      new_employee_count,
      proration_behavior,
      new_monthly_total: (ENTERPRISE_PRICE_PER_SEAT * new_employee_count) / 100,
    });
  } catch (err: any) {
    console.error("Seat update error:", err.message);
    await auditLog(null, "seat_update_failed", "companies", { error: err.message });
    return res.status(500).json({ error: "Failed to update seats" });
  }
});

router.get("/stripe-enterprise/billing/:companyId", async (req, res) => {
  const companyId = req.params.companyId;
  if (!z.string().uuid().safeParse(companyId).success) {
    return res.status(400).json({ error: "Invalid company ID" });
  }

  try {
    const companyResult = await query(
      `SELECT name, stripe_customer_id, subscription_status, subscription_id,
              seat_count, billing_period_end, dunning_attempts, grace_period_end, suspended_at
       FROM companies WHERE id = $1`,
      [companyId]
    );
    if (companyResult.rows.length === 0) {
      return res.json({ has_subscription: false });
    }

    const company = companyResult.rows[0];

    if (company.subscription_status === "active" && company.subscription_id) {
      return res.json({
        has_subscription: true,
        company_name: company.name,
        subscription_id: company.subscription_id,
        status: company.subscription_status,
        seats: company.seat_count || 0,
        per_seat_price: ENTERPRISE_PRICE_PER_SEAT / 100,
        monthly_total: (ENTERPRISE_PRICE_PER_SEAT * (company.seat_count || 0)) / 100,
        current_period_end: company.billing_period_end
          ? new Date(company.billing_period_end).toISOString()
          : null,
        dunning_attempts: company.dunning_attempts || 0,
        grace_period_end: company.grace_period_end
          ? new Date(company.grace_period_end).toISOString()
          : null,
        is_suspended: !!company.suspended_at,
      });
    }

    if (!isStripeConfigured() || !company.stripe_customer_id) {
      return res.json({
        has_subscription: false,
        company_name: company.name,
        subscription_status: company.subscription_status || "none",
      });
    }

    try {
      const stripe = getStripeClient();
      const subscriptions = await stripe.subscriptions.list({
        customer: company.stripe_customer_id,
        status: "active",
        limit: 1,
      });

      if (subscriptions.data.length === 0) {
        return res.json({
          has_subscription: false,
          company_name: company.name,
          stripe_customer_id: company.stripe_customer_id,
        });
      }

      const sub = subscriptions.data[0];
      const seats = sub.items.data[0]?.quantity || 0;
      const periodEnd = new Date((sub.current_period_end as number) * 1000);

      await withTransaction(async (client) => {
        await client.query(
          `UPDATE companies
           SET subscription_status = $1, subscription_id = $2,
               seat_count = $3, billing_period_end = $4
           WHERE id = $5`,
          ["active", sub.id, seats, periodEnd, companyId]
        );
      });

      return res.json({
        has_subscription: true,
        company_name: company.name,
        subscription_id: sub.id,
        status: sub.status,
        seats,
        per_seat_price: ENTERPRISE_PRICE_PER_SEAT / 100,
        monthly_total: (ENTERPRISE_PRICE_PER_SEAT * seats) / 100,
        current_period_end: periodEnd.toISOString(),
      });
    } catch {
      return res.json({
        has_subscription: false,
        company_name: company.name,
        subscription_status: company.subscription_status || "none",
      });
    }
  } catch (err: any) {
    console.error("Billing status error:", err.message);
    return res.status(500).json({ error: "Failed to fetch billing info" });
  }
});

router.get("/stripe-enterprise/invoices/:companyId", async (req, res) => {
  const companyId = req.params.companyId;
  if (!z.string().uuid().safeParse(companyId).success) {
    return res.status(400).json({ error: "Invalid company ID" });
  }

  if (!isStripeConfigured()) {
    return res.json({ invoices: [], has_more: false });
  }

  try {
    const companyResult = await query(
      `SELECT stripe_customer_id FROM companies WHERE id = $1`,
      [companyId]
    );
    if (companyResult.rows.length === 0 || !companyResult.rows[0].stripe_customer_id) {
      return res.json({ invoices: [], has_more: false });
    }

    const stripe = getStripeClient();
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const startingAfter = req.query.starting_after as string | undefined;

    const params: any = {
      customer: companyResult.rows[0].stripe_customer_id,
      limit,
    };
    if (startingAfter) params.starting_after = startingAfter;

    const invoices = await stripe.invoices.list(params);

    return res.json({
      invoices: invoices.data.map((inv) => ({
        id: inv.id,
        number: inv.number,
        status: inv.status,
        amount_due: inv.amount_due,
        amount_paid: inv.amount_paid,
        currency: inv.currency,
        created: new Date((inv.created as number) * 1000).toISOString(),
        period_start: inv.period_start ? new Date((inv.period_start as number) * 1000).toISOString() : null,
        period_end: inv.period_end ? new Date((inv.period_end as number) * 1000).toISOString() : null,
        hosted_invoice_url: inv.hosted_invoice_url,
        invoice_pdf: inv.invoice_pdf,
        tax: inv.tax,
        subtotal: inv.subtotal,
        total: inv.total,
        lines: inv.lines.data.map((line) => ({
          description: line.description,
          amount: line.amount,
          quantity: line.quantity,
        })),
      })),
      has_more: invoices.has_more,
    });
  } catch (err: any) {
    console.error("Invoice list error:", err.message);
    return res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

router.get("/stripe-enterprise/upcoming/:companyId", async (req, res) => {
  const companyId = req.params.companyId;
  if (!z.string().uuid().safeParse(companyId).success) {
    return res.status(400).json({ error: "Invalid company ID" });
  }

  if (!isStripeConfigured()) {
    return res.json({ has_upcoming: false });
  }

  try {
    const companyResult = await query(
      `SELECT stripe_customer_id FROM companies WHERE id = $1`,
      [companyId]
    );
    if (companyResult.rows.length === 0 || !companyResult.rows[0].stripe_customer_id) {
      return res.json({ has_upcoming: false });
    }

    const stripe = getStripeClient();
    const upcoming = await stripe.invoices.retrieveUpcoming({
      customer: companyResult.rows[0].stripe_customer_id,
    });

    return res.json({
      has_upcoming: true,
      amount_due: upcoming.amount_due,
      currency: upcoming.currency,
      next_payment_attempt: upcoming.next_payment_attempt
        ? new Date((upcoming.next_payment_attempt as number) * 1000).toISOString()
        : null,
      subtotal: upcoming.subtotal,
      tax: upcoming.tax,
      total: upcoming.total,
      lines: upcoming.lines.data.map((line) => ({
        description: line.description,
        amount: line.amount,
        quantity: line.quantity,
      })),
    });
  } catch (err: any) {
    if (err.code === "invoice_upcoming_none") {
      return res.json({ has_upcoming: false });
    }
    console.error("Upcoming invoice error:", err.message);
    return res.status(500).json({ error: "Failed to fetch upcoming invoice" });
  }
});

router.post("/stripe-enterprise/portal", requireBillingRole, async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ error: "Stripe not configured" });
  }

  const schema = z.object({
    company_id: z.string().uuid(),
    return_url: z.string().url().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const stripe = getStripeClient();
    const { company_id } = parsed.data;

    const companyResult = await query(
      `SELECT stripe_customer_id FROM companies WHERE id = $1`,
      [company_id]
    );
    if (companyResult.rows.length === 0 || !companyResult.rows[0].stripe_customer_id) {
      return res.status(404).json({ error: "No Stripe customer found" });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: companyResult.rows[0].stripe_customer_id,
      return_url: parsed.data.return_url || `${baseUrl}/admin-dashboard`,
    });

    await auditLog(null, "billing_portal_opened", "companies", { company_id });

    return res.json({ url: portalSession.url });
  } catch (err: any) {
    console.error("Portal error:", err.message);
    await auditLog(null, "billing_portal_failed", "companies", { error: err.message });
    return res.status(500).json({ error: "Failed to create billing portal" });
  }
});

router.get("/stripe-enterprise/webhook-metrics", async (_req, res) => {
  try {
    const metrics = await getWebhookMetrics();
    return res.json(metrics);
  } catch (err: any) {
    console.error("Webhook metrics error:", err.message);
    return res.status(500).json({ error: "Failed to fetch webhook metrics" });
  }
});

router.post("/stripe-enterprise/retry-dlq", async (_req, res) => {
  try {
    const result = await retryDeadLetterQueue();
    await auditLog(null, "dlq_retry_triggered", "stripe", result);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error("DLQ retry error:", err.message);
    return res.status(500).json({ error: "Failed to retry DLQ" });
  }
});

export default router;
