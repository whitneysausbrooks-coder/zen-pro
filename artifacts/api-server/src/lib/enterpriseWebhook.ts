import { getStripeClient, isStripeConfigured } from "../stripeClient";
import { query, auditLog } from "./db";
import type Stripe from "stripe";

async function syncSubscription(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.toString();
  const seats = sub.items.data[0]?.quantity || 0;
  const periodEnd = new Date((sub.current_period_end as number) * 1000);
  const companyId = sub.metadata?.nq_company_id;

  if (companyId) {
    await query(
      `UPDATE companies
       SET subscription_status = $1, subscription_id = $2,
           seat_count = $3, billing_period_end = $4
       WHERE id = $5`,
      [sub.status, sub.id, seats, periodEnd, companyId]
    );
  } else if (customerId) {
    await query(
      `UPDATE companies
       SET subscription_status = $1, subscription_id = $2,
           seat_count = $3, billing_period_end = $4
       WHERE stripe_customer_id = $5`,
      [sub.status, sub.id, seats, periodEnd, customerId]
    );
  }
}

export async function processEnterpriseWebhook(
  payload: Buffer,
  signature: string
): Promise<void> {
  if (!isStripeConfigured()) {
    throw new Error("Stripe not configured");
  }

  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_ENTERPRISE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  if (webhookSecret) {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } else {
    event = JSON.parse(payload.toString()) as Stripe.Event;
    console.warn("Enterprise webhook: No webhook secret configured, skipping signature verification");
  }

  const eventType = event.type;

  try {
    switch (eventType) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.type === "enterprise_subscription" && session.subscription) {
          const subId = typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.toString();
          const sub = await stripe.subscriptions.retrieve(subId);
          await syncSubscription(sub);
          await auditLog(null, "enterprise_subscription_created", "companies", {
            company_id: session.metadata.nq_company_id,
            subscription_id: subId,
            seats: session.metadata.employee_count,
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscription(sub);
        await auditLog(null, "enterprise_subscription_updated", "companies", {
          subscription_id: sub.id,
          status: sub.status,
          seats: sub.items.data[0]?.quantity,
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.toString();
        const companyId = sub.metadata?.nq_company_id;

        if (companyId) {
          await query(
            `UPDATE companies SET subscription_status = 'canceled', subscription_id = NULL, seat_count = 0 WHERE id = $1`,
            [companyId]
          );
        } else if (customerId) {
          await query(
            `UPDATE companies SET subscription_status = 'canceled', subscription_id = NULL, seat_count = 0 WHERE stripe_customer_id = $1`,
            [customerId]
          );
        }

        await auditLog(null, "enterprise_subscription_canceled", "companies", {
          subscription_id: sub.id,
          company_id: companyId,
        });
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const subId = typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription.toString();
          const sub = await stripe.subscriptions.retrieve(subId);
          if (sub.metadata?.type === "enterprise_subscription" || sub.metadata?.nq_company_id) {
            await syncSubscription(sub);
            await auditLog(null, "enterprise_invoice_paid", "companies", {
              invoice_id: invoice.id,
              subscription_id: subId,
              amount: invoice.amount_paid,
              company_id: sub.metadata.nq_company_id,
            });
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const subId = typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription.toString();
          const sub = await stripe.subscriptions.retrieve(subId);
          if (sub.metadata?.nq_company_id) {
            await query(
              `UPDATE companies SET subscription_status = 'past_due' WHERE id = $1`,
              [sub.metadata.nq_company_id]
            );
            await auditLog(null, "enterprise_payment_failed", "companies", {
              invoice_id: invoice.id,
              subscription_id: subId,
              company_id: sub.metadata.nq_company_id,
            });
          }
        }
        break;
      }

      default:
        break;
    }
  } catch (err: any) {
    console.error(`Enterprise webhook handler error for ${eventType}:`, err.message);
    await auditLog(null, "enterprise_webhook_error", "stripe", {
      event_type: eventType,
      error: err.message,
    });
    throw err;
  }
}
