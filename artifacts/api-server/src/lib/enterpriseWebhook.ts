import { getStripeClient, isStripeConfigured } from "../stripeClient";
import { query, auditLog, withTransaction } from "./db";
import {
  handleNewSubscription,
  handleInvoicePaid,
  handleSeatChangeProspective,
  handleCancellation,
  handleRefund,
  handleSuspension,
  handleReactivation,
} from "./revenueRecognition";
import type Stripe from "stripe";

const GRACE_PERIOD_DAYS = 7;
const MAX_DUNNING_ATTEMPTS = 3;
const DLQ_MAX_RETRIES = 3;

/**
 * Stripe SDK v18+ relocated `current_period_end` / `current_period_start` from
 * the Subscription root onto each SubscriptionItem (Subscription.items.data[i]).
 * The first item is the canonical one for single-item subscriptions (our case).
 * These helpers centralize the lookup so the rest of the file is readable.
 */
function subItemPeriodEnd(sub: Stripe.Subscription): number | undefined {
  return sub.items?.data?.[0]?.current_period_end;
}

function subItemPeriodStart(sub: Stripe.Subscription): number | undefined {
  return sub.items?.data?.[0]?.current_period_start;
}

/**
 * Stripe SDK v18+ removed `Invoice.subscription` in favor of
 * `Invoice.parent.subscription_details.subscription`. This helper returns the
 * subscription id (string) regardless of which surface it lives on, falling
 * back to a defensive cast for older event payloads sitting in our DLQ.
 */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const fromParent = invoice.parent?.subscription_details?.subscription;
  if (fromParent) {
    return typeof fromParent === "string" ? fromParent : fromParent.id;
  }
  // Defensive: replay an older DLQ payload that still has the legacy field
  const legacy = (invoice as any).subscription;
  if (legacy) return typeof legacy === "string" ? legacy : String(legacy);
  return null;
}

async function isEventProcessed(eventId: string): Promise<boolean> {
  const result = await query(
    `SELECT event_id FROM processed_stripe_events WHERE event_id = $1`,
    [eventId]
  );
  return result.rows.length > 0;
}

async function markEventProcessed(
  eventId: string,
  eventType: string,
  result: string = "success",
  details?: Record<string, any>
): Promise<void> {
  await query(
    `INSERT INTO processed_stripe_events (event_id, event_type, result, details)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (event_id) DO NOTHING`,
    [eventId, eventType, result, details ? JSON.stringify(details) : null]
  );
}

async function recordMetric(
  eventType: string,
  success: boolean,
  processingTimeMs: number,
  errorMessage?: string
): Promise<void> {
  try {
    await query(
      `INSERT INTO webhook_metrics (event_type, success, processing_time_ms, error_message)
       VALUES ($1, $2, $3, $4)`,
      [eventType, success, processingTimeMs, errorMessage || null]
    );
  } catch {}
}

async function addToDeadLetterQueue(
  eventId: string,
  eventType: string,
  payload: any,
  errorMessage: string
): Promise<void> {
  try {
    const nextRetry = new Date(Date.now() + 5 * 60 * 1000);
    await query(
      `INSERT INTO webhook_dead_letter (event_id, event_type, payload, error_message, next_retry_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [eventId, eventType, JSON.stringify(payload), errorMessage, nextRetry]
    );
  } catch {}
}

async function syncSubscriptionTransactional(sub: Stripe.Subscription): Promise<string | null> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.toString();
  const seats = sub.items.data[0]?.quantity || 0;
  const periodEndUnix = subItemPeriodEnd(sub);
  const periodEnd = periodEndUnix ? new Date(periodEndUnix * 1000) : null;
  const companyId = sub.metadata?.nq_company_id;
  const status = sub.status;
  const subscriptionId = sub.id;

  return await withTransaction(async (client) => {
    let resolvedCompanyId = companyId;

    if (companyId) {
      await client.query(
        `UPDATE companies
         SET subscription_status = $1, subscription_id = $2,
             seat_count = $3, billing_period_end = $4
         WHERE id = $5`,
        [status, subscriptionId, seats, periodEnd, companyId]
      );
    } else if (customerId) {
      const result = await client.query(
        `UPDATE companies
         SET subscription_status = $1, subscription_id = $2,
             seat_count = $3, billing_period_end = $4
         WHERE stripe_customer_id = $5
         RETURNING id`,
        [status, subscriptionId, seats, periodEnd, customerId]
      );
      resolvedCompanyId = result.rows[0]?.id || null;
    }

    return resolvedCompanyId || null;
  });
}

async function handleCheckoutCompleted(event: Stripe.Event): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.metadata?.type !== "enterprise_subscription" || !session.subscription) return;

  const stripe = getStripeClient();
  const subId = typeof session.subscription === "string"
    ? session.subscription
    : session.subscription.toString();
  const sub = await stripe.subscriptions.retrieve(subId);
  const companyId = await syncSubscriptionTransactional(sub);

  if (companyId) {
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE companies
         SET dunning_attempts = 0, dunning_last_at = NULL, suspended_at = NULL, grace_period_end = NULL
         WHERE id = $1`,
        [companyId]
      );
    });
  }

  const resolvedCompanyId = companyId || session.metadata?.nq_company_id;
  const seats = sub.items.data[0]?.quantity || 0;
  const periodStartUnix = subItemPeriodStart(sub);
  const periodEndUnix = subItemPeriodEnd(sub);
  const amountBilled = seats * 1200;

  if (resolvedCompanyId && periodStartUnix && periodEndUnix) {
    try {
      await handleNewSubscription(
        resolvedCompanyId,
        subId,
        new Date(periodStartUnix * 1000),
        new Date(periodEndUnix * 1000),
        seats,
        amountBilled,
      );
    } catch (err: any) {
      console.error("Revenue recording error (new sub):", err.message);
    }
  }

  await auditLog(null, "enterprise_subscription_created", "companies", {
    event_id: event.id,
    company_id: resolvedCompanyId,
    subscription_id: subId,
    seats,
    status: sub.status,
  });
}

async function handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
  const subFromEvent = event.data.object as Stripe.Subscription;

  const stripe = getStripeClient();
  const liveSub = await stripe.subscriptions.retrieve(subFromEvent.id);

  const companyId = await syncSubscriptionTransactional(liveSub);

  const prev = (event.data as any).previous_attributes;
  const currentSeats = liveSub.items.data[0]?.quantity || 0;
  const previousSeats = prev?.items?.data?.[0]?.quantity;

  if (companyId && previousSeats !== undefined && previousSeats !== currentSeats) {
    try {
      await handleSeatChangeProspective(companyId, liveSub.id, currentSeats, previousSeats);
    } catch (err: any) {
      console.error("Revenue recording error (seat change):", err.message);
    }
  }

  await auditLog(null, "enterprise_subscription_updated", "companies", {
    event_id: event.id,
    subscription_id: liveSub.id,
    status: liveSub.status,
    previous_status: prev?.status,
    seats: currentSeats,
    previous_seats: previousSeats,
    company_id: companyId,
  });
}

async function handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
  const sub = event.data.object as Stripe.Subscription;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.toString();
  const companyId = sub.metadata?.nq_company_id;

  await withTransaction(async (client) => {
    if (companyId) {
      await client.query(
        `UPDATE companies SET subscription_status = 'canceled', subscription_id = NULL, seat_count = 0 WHERE id = $1`,
        [companyId]
      );
    } else if (customerId) {
      await client.query(
        `UPDATE companies SET subscription_status = 'canceled', subscription_id = NULL, seat_count = 0 WHERE stripe_customer_id = $1`,
        [customerId]
      );
    }
  });

  let resolvedCompanyId = companyId;
  if (!resolvedCompanyId && customerId) {
    const lookup = await query(
      `SELECT id FROM companies WHERE stripe_customer_id = $1 LIMIT 1`,
      [customerId]
    );
    resolvedCompanyId = lookup.rows[0]?.id || null;
  }

  if (resolvedCompanyId) {
    try {
      const periodEndUnix = subItemPeriodEnd(sub);
      const periodEnd = periodEndUnix ? new Date(periodEndUnix * 1000) : undefined;
      await handleCancellation(resolvedCompanyId, sub.id, periodEnd);
    } catch (err: any) {
      console.error("Revenue recording error (cancellation):", err.message);
    }
  }

  await auditLog(null, "enterprise_subscription_canceled", "companies", {
    event_id: event.id,
    subscription_id: sub.id,
    company_id: resolvedCompanyId || companyId,
  });
}

async function handlePaymentSucceeded(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const subId = invoiceSubscriptionId(invoice);
  if (!subId) return;

  const stripe = getStripeClient();
  const sub = await stripe.subscriptions.retrieve(subId);
  const companyId = sub.metadata?.nq_company_id;
  if (!companyId) return;

  await syncSubscriptionTransactional(sub);

  const companyState = await query(
    `SELECT suspended_at, subscription_status FROM companies WHERE id = $1`,
    [companyId]
  );
  const wasSuspended = companyState.rows[0]?.suspended_at != null ||
    companyState.rows[0]?.subscription_status === "past_due";

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE companies
       SET dunning_attempts = 0, dunning_last_at = NULL, suspended_at = NULL, grace_period_end = NULL
       WHERE id = $1`,
      [companyId]
    );
  });

  if (wasSuspended) {
    try {
      await handleReactivation(companyId, subId);
    } catch (err: any) {
      console.error("Revenue recording error (reactivation):", err.message);
    }
  }

  try {
    const periodStartUnix = subItemPeriodStart(sub);
    const periodEndUnix = subItemPeriodEnd(sub);
    if (periodStartUnix && periodEndUnix && invoice.id) {
      await handleInvoicePaid(
        companyId,
        subId,
        new Date(periodStartUnix * 1000),
        new Date(periodEndUnix * 1000),
        sub.items.data[0]?.quantity || 0,
        invoice.amount_paid || 0,
        invoice.id,
      );
    }
  } catch (err: any) {
    console.error("Revenue recording error (payment):", err.message);
  }

  await auditLog(null, "enterprise_invoice_paid", "companies", {
    event_id: event.id,
    invoice_id: invoice.id,
    subscription_id: subId,
    amount_paid: invoice.amount_paid,
    currency: invoice.currency,
    company_id: companyId,
  });
}

async function handlePaymentFailed(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const subId = invoiceSubscriptionId(invoice);
  if (!subId) return;

  const stripe = getStripeClient();
  const sub = await stripe.subscriptions.retrieve(subId);
  const companyId = sub.metadata?.nq_company_id;
  if (!companyId) return;

  const attempts = await withTransaction(async (client) => {
    await client.query(
      `UPDATE companies
       SET subscription_status = 'past_due',
           dunning_attempts = COALESCE(dunning_attempts, 0) + 1,
           dunning_last_at = NOW()
       WHERE id = $1`,
      [companyId]
    );

    const result = await client.query(
      `SELECT dunning_attempts, grace_period_end FROM companies WHERE id = $1`,
      [companyId]
    );
    const row = result.rows[0];
    const dunningAttempts = row?.dunning_attempts || 0;

    if (dunningAttempts === 1 && !row?.grace_period_end) {
      const graceEnd = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
      await client.query(
        `UPDATE companies SET grace_period_end = $1 WHERE id = $2`,
        [graceEnd, companyId]
      );
    }

    if (dunningAttempts >= MAX_DUNNING_ATTEMPTS) {
      await client.query(
        `UPDATE companies SET subscription_status = 'suspended', suspended_at = NOW() WHERE id = $1`,
        [companyId]
      );
    }

    return dunningAttempts;
  });

  if (attempts >= MAX_DUNNING_ATTEMPTS) {
    try {
      await handleSuspension(companyId, subId);
    } catch (err: any) {
      console.error("Revenue recording error (suspension):", err.message);
    }

    await auditLog(null, "enterprise_account_suspended", "companies", {
      event_id: event.id,
      company_id: companyId,
      reason: `${MAX_DUNNING_ATTEMPTS} consecutive payment failures`,
      dunning_attempts: attempts,
    });
  }

  await auditLog(null, "enterprise_payment_failed", "companies", {
    event_id: event.id,
    invoice_id: invoice.id,
    subscription_id: subId,
    company_id: companyId,
    dunning_attempt: attempts,
    amount_due: invoice.amount_due,
    failure_reason: (invoice as any).last_finalization_error?.message || null,
  });
}

async function handleChargeRefunded(event: Stripe.Event): Promise<void> {
  const charge = event.data.object as Stripe.Charge;
  const customerId = typeof charge.customer === "string" ? charge.customer : charge.customer?.toString();
  if (!customerId) return;

  const companyResult = await query(
    `SELECT id, subscription_id FROM companies WHERE stripe_customer_id = $1 LIMIT 1`,
    [customerId]
  );
  if (companyResult.rows.length === 0) return;

  const company = companyResult.rows[0];
  const amountRefunded = charge.amount_refunded || 0;

  if (amountRefunded > 0) {
    try {
      await handleRefund(
        company.id,
        amountRefunded,
        company.subscription_id || undefined,
        (charge as any).invoice || undefined
      );
    } catch (err: any) {
      console.error("Revenue recording error (refund):", err.message);
    }
  }

  await auditLog(null, "enterprise_charge_refunded", "companies", {
    event_id: event.id,
    charge_id: charge.id,
    company_id: company.id,
    amount_refunded: amountRefunded,
  });
}

const EVENT_HANDLERS: Record<string, (event: Stripe.Event) => Promise<void>> = {
  "checkout.session.completed": handleCheckoutCompleted,
  "customer.subscription.updated": handleSubscriptionUpdated,
  "customer.subscription.deleted": handleSubscriptionDeleted,
  "invoice.payment_succeeded": handlePaymentSucceeded,
  "invoice.payment_failed": handlePaymentFailed,
  "charge.refunded": handleChargeRefunded,
};

export async function processEnterpriseWebhook(
  payload: Buffer,
  signature: string
): Promise<void> {
  if (!isStripeConfigured()) {
    throw new Error("Stripe not configured");
  }

  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_ENTERPRISE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("CRITICAL: No webhook secret configured. Rejecting request.");
    throw new Error("Webhook secret not configured");
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    await auditLog(null, "webhook_signature_rejected", "stripe", {
      error: err.message,
      signature_present: !!signature,
    });
    throw err;
  }

  const eventId = event.id;
  const eventType = event.type;

  if (await isEventProcessed(eventId)) {
    console.log(`[Webhook] Idempotent skip: ${eventId} (${eventType})`);
    return;
  }

  const handler = EVENT_HANDLERS[eventType];
  if (!handler) {
    await markEventProcessed(eventId, eventType, "ignored");
    return;
  }

  const startTime = Date.now();

  try {
    await handler(event);
    const processingTime = Date.now() - startTime;

    await markEventProcessed(eventId, eventType, "success", {
      processing_time_ms: processingTime,
    });
    await recordMetric(eventType, true, processingTime);
  } catch (err: any) {
    const processingTime = Date.now() - startTime;
    console.error(`[Webhook] Handler error for ${eventType} (${eventId}):`, err.message);

    await markEventProcessed(eventId, eventType, "error", {
      error: err.message,
      processing_time_ms: processingTime,
    });
    await recordMetric(eventType, false, processingTime, err.message);
    await addToDeadLetterQueue(eventId, eventType, event.data.object, err.message);

    await auditLog(null, "enterprise_webhook_error", "stripe", {
      event_id: eventId,
      event_type: eventType,
      error: err.message,
      processing_time_ms: processingTime,
    });
    throw err;
  }
}

export async function retryDeadLetterQueue(): Promise<{
  retried: number;
  succeeded: number;
  failed: number;
  permanently_failed: number;
}> {
  const result = { retried: 0, succeeded: 0, failed: 0, permanently_failed: 0 };

  const items = await query(
    `SELECT id, event_id, event_type, payload, retry_count, max_retries
     FROM webhook_dead_letter
     WHERE resolved = false AND next_retry_at <= NOW()
     ORDER BY created_at ASC
     LIMIT 10`
  );

  if (!isStripeConfigured()) return result;
  const stripe = getStripeClient();

  for (const item of items.rows) {
    result.retried++;
    try {
      const handler = EVENT_HANDLERS[item.event_type];
      if (handler) {
        const fakeEvent = {
          id: item.event_id,
          type: item.event_type,
          data: { object: item.payload },
        } as unknown as Stripe.Event;

        await handler(fakeEvent);
        await query(
          `UPDATE webhook_dead_letter SET resolved = true, updated_at = NOW() WHERE id = $1`,
          [item.id]
        );
        result.succeeded++;
      }
    } catch (err: any) {
      const newRetryCount = item.retry_count + 1;
      if (newRetryCount >= item.max_retries) {
        await query(
          `UPDATE webhook_dead_letter SET retry_count = $1, resolved = true, error_message = $2, updated_at = NOW() WHERE id = $3`,
          [newRetryCount, `Permanently failed: ${err.message}`, item.id]
        );
        result.permanently_failed++;
        await auditLog(null, "webhook_dlq_permanent_failure", "stripe", {
          event_id: item.event_id,
          event_type: item.event_type,
          error: err.message,
          retry_count: newRetryCount,
        });
      } else {
        const backoffMs = Math.pow(2, newRetryCount) * 60 * 1000;
        const nextRetry = new Date(Date.now() + backoffMs);
        await query(
          `UPDATE webhook_dead_letter SET retry_count = $1, next_retry_at = $2, error_message = $3, updated_at = NOW() WHERE id = $4`,
          [newRetryCount, nextRetry, err.message, item.id]
        );
        result.failed++;
      }
    }
  }

  return result;
}

export async function getWebhookMetrics(): Promise<{
  total_24h: number;
  success_24h: number;
  failure_24h: number;
  success_rate_24h: number;
  avg_processing_ms_24h: number;
  by_type: Array<{ event_type: string; total: number; success: number; failure: number; avg_ms: number }>;
  dlq_pending: number;
  dlq_permanent_failures: number;
}> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [totals, byType, dlqPending, dlqPerm] = await Promise.all([
    query(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN success THEN 1 ELSE 0 END) as successes,
         SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failures,
         AVG(processing_time_ms) as avg_ms
       FROM webhook_metrics WHERE created_at >= $1`,
      [cutoff]
    ),
    query(
      `SELECT event_type,
         COUNT(*) as total,
         SUM(CASE WHEN success THEN 1 ELSE 0 END) as successes,
         SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failures,
         AVG(processing_time_ms) as avg_ms
       FROM webhook_metrics WHERE created_at >= $1
       GROUP BY event_type ORDER BY total DESC`,
      [cutoff]
    ),
    query(`SELECT COUNT(*) as count FROM webhook_dead_letter WHERE resolved = false`),
    query(`SELECT COUNT(*) as count FROM webhook_dead_letter WHERE resolved = true AND error_message LIKE 'Permanently%'`),
  ]);

  const t = totals.rows[0];
  const total = parseInt(t.total) || 0;
  const success = parseInt(t.successes) || 0;

  return {
    total_24h: total,
    success_24h: success,
    failure_24h: parseInt(t.failures) || 0,
    success_rate_24h: total > 0 ? Math.round((success / total) * 10000) / 100 : 100,
    avg_processing_ms_24h: Math.round(parseFloat(t.avg_ms) || 0),
    by_type: byType.rows.map((r: any) => ({
      event_type: r.event_type,
      total: parseInt(r.total),
      success: parseInt(r.successes),
      failure: parseInt(r.failures),
      avg_ms: Math.round(parseFloat(r.avg_ms) || 0),
    })),
    dlq_pending: parseInt(dlqPending.rows[0].count),
    dlq_permanent_failures: parseInt(dlqPerm.rows[0].count),
  };
}
