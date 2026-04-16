import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { getStripeClient, isStripeConfigured } from "../stripeClient";
import { query, auditLog } from "../lib/db";

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

router.post("/stripe-enterprise/create-company", async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ error: "Stripe not configured" });
  }

  const schema = z.object({
    company_id: z.string().uuid(),
    company_name: z.string().min(1).max(200),
    admin_email: z.string().email(),
    employee_count: z.number().int().min(1).max(10000),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const stripe = getStripeClient();
    const { company_id, company_name, admin_email, employee_count } = parsed.data;

    const customer = await stripe.customers.create({
      email: admin_email,
      name: company_name,
      metadata: {
        nq_company_id: company_id,
        type: "enterprise",
        employee_count: String(employee_count),
      },
    });

    await query(
      `UPDATE companies SET stripe_customer_id = $1 WHERE id = $2`,
      [customer.id, company_id]
    );

    await auditLog(null, "stripe_customer_created", "companies", {
      company_id,
      stripe_customer_id: customer.id,
    });

    return res.json({
      success: true,
      stripe_customer_id: customer.id,
      company_id,
    });
  } catch (err: any) {
    console.error("Enterprise Stripe customer error:", err.message);
    return res.status(500).json({ error: "Failed to create Stripe customer" });
  }
});

router.post("/stripe-enterprise/subscribe", async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ error: "Stripe not configured" });
  }

  const schema = z.object({
    company_id: z.string().uuid(),
    employee_count: z.number().int().min(1).max(10000),
    success_url: z.string().url().optional(),
    cancel_url: z.string().url().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const stripe = getStripeClient();
    const { company_id, employee_count } = parsed.data;

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

    const session = await stripe.checkout.sessions.create({
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
            },
          },
          quantity: employee_count,
        },
      ],
      mode: "subscription",
      metadata: {
        nq_company_id: company_id,
        type: "enterprise_subscription",
        employee_count: String(employee_count),
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    await auditLog(null, "enterprise_checkout_started", "companies", {
      company_id,
      employee_count,
      session_id: session.id,
    });

    return res.json({
      success: true,
      checkout_url: session.url,
      session_id: session.id,
      per_seat_price: ENTERPRISE_PRICE_PER_SEAT / 100,
      total_monthly: (ENTERPRISE_PRICE_PER_SEAT * employee_count) / 100,
    });
  } catch (err: any) {
    console.error("Enterprise checkout error:", err.message);
    return res.status(500).json({ error: "Failed to create checkout session" });
  }
});

router.post("/stripe-enterprise/update-seats", async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ error: "Stripe not configured" });
  }

  const schema = z.object({
    company_id: z.string().uuid(),
    new_employee_count: z.number().int().min(1).max(10000),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const stripe = getStripeClient();
    const { company_id, new_employee_count } = parsed.data;

    const companyResult = await query(
      `SELECT stripe_customer_id FROM companies WHERE id = $1`,
      [company_id]
    );
    if (companyResult.rows.length === 0 || !companyResult.rows[0].stripe_customer_id) {
      return res.status(404).json({ error: "Company or Stripe customer not found" });
    }

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

    await stripe.subscriptionItems.update(item.id, {
      quantity: new_employee_count,
    });

    await auditLog(null, "enterprise_seats_updated", "companies", {
      company_id,
      new_employee_count,
      subscription_id: sub.id,
    });

    return res.json({
      success: true,
      new_employee_count,
      new_monthly_total: (ENTERPRISE_PRICE_PER_SEAT * new_employee_count) / 100,
    });
  } catch (err: any) {
    console.error("Seat update error:", err.message);
    return res.status(500).json({ error: "Failed to update seats" });
  }
});

router.get("/stripe-enterprise/billing/:companyId", async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ error: "Stripe not configured" });
  }

  const companyId = req.params.companyId;
  if (!z.string().uuid().safeParse(companyId).success) {
    return res.status(400).json({ error: "Invalid company ID" });
  }

  try {
    const stripe = getStripeClient();

    const companyResult = await query(
      `SELECT name, stripe_customer_id FROM companies WHERE id = $1`,
      [companyId]
    );
    if (companyResult.rows.length === 0 || !companyResult.rows[0].stripe_customer_id) {
      return res.json({ has_subscription: false, company_name: companyResult.rows[0]?.name });
    }

    const customerId = companyResult.rows[0].stripe_customer_id;
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return res.json({
        has_subscription: false,
        company_name: companyResult.rows[0].name,
        stripe_customer_id: customerId,
      });
    }

    const sub = subscriptions.data[0];
    const seats = sub.items.data[0]?.quantity || 0;

    return res.json({
      has_subscription: true,
      company_name: companyResult.rows[0].name,
      subscription_id: sub.id,
      status: sub.status,
      seats,
      per_seat_price: ENTERPRISE_PRICE_PER_SEAT / 100,
      monthly_total: (ENTERPRISE_PRICE_PER_SEAT * seats) / 100,
      current_period_end: new Date((sub.current_period_end as number) * 1000).toISOString(),
    });
  } catch (err: any) {
    console.error("Billing status error:", err.message);
    return res.status(500).json({ error: "Failed to fetch billing info" });
  }
});

router.post("/stripe-enterprise/portal", async (req, res) => {
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
    return res.status(500).json({ error: "Failed to create billing portal" });
  }
});

export default router;
