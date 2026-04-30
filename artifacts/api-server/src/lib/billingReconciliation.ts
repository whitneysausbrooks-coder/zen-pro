import { getStripeClient, isStripeConfigured } from "../stripeClient";
import { query, auditLog, withTransaction } from "./db";
import { retryDeadLetterQueue } from "./enterpriseWebhook";

interface ReconciliationResult {
  companies_checked: number;
  discrepancies_found: number;
  auto_fixed: number;
  errors: string[];
  dlq_retried: number;
  dlq_succeeded: number;
}

export async function runReconciliation(): Promise<ReconciliationResult> {
  const result: ReconciliationResult = {
    companies_checked: 0,
    discrepancies_found: 0,
    auto_fixed: 0,
    errors: [],
    dlq_retried: 0,
    dlq_succeeded: 0,
  };

  if (!isStripeConfigured()) {
    result.errors.push("Stripe not configured — reconciliation skipped");
    return result;
  }

  try {
    const companies = await query(
      `SELECT id, name, stripe_customer_id, subscription_status, subscription_id,
              seat_count, billing_period_end, dunning_attempts, suspended_at, grace_period_end
       FROM companies WHERE stripe_customer_id IS NOT NULL`
    );

    const stripe = getStripeClient();

    for (const company of companies.rows) {
      result.companies_checked++;

      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: company.stripe_customer_id,
          limit: 1,
        });

        const stripeSub = subscriptions.data[0];

        if (stripeSub) {
          const stripeStatus = stripeSub.status;
          const stripeSeats = stripeSub.items.data[0]?.quantity || 0;
          // Stripe SDK v18+ moved current_period_end onto each SubscriptionItem.
          const periodEndUnix = stripeSub.items?.data?.[0]?.current_period_end;
          const stripePeriodEnd = periodEndUnix ? new Date(periodEndUnix * 1000) : null;

          const fixes: string[] = [];

          if (company.subscription_status !== stripeStatus) {
            fixes.push("status");
            result.discrepancies_found++;
            await logDiscrepancy(company.id, "status_mismatch", company.subscription_status || "null", stripeStatus);
          }

          if (company.seat_count !== stripeSeats) {
            fixes.push("seats");
            result.discrepancies_found++;
            await logDiscrepancy(company.id, "seat_mismatch", String(company.seat_count), String(stripeSeats));
          }

          if (stripePeriodEnd) {
            const localEnd = company.billing_period_end ? new Date(company.billing_period_end).getTime() : 0;
            const stripeEnd = stripePeriodEnd.getTime();
            if (Math.abs(localEnd - stripeEnd) > 60000) {
              fixes.push("period_end");
              result.discrepancies_found++;
              await logDiscrepancy(company.id, "period_end_mismatch",
                company.billing_period_end?.toISOString() || "null",
                stripePeriodEnd.toISOString()
              );
            }
          }

          if (company.subscription_id !== stripeSub.id) {
            fixes.push("subscription_id");
            result.discrepancies_found++;
            await logDiscrepancy(company.id, "subscription_id_mismatch",
              company.subscription_id || "null",
              stripeSub.id
            );
          }

          if (fixes.length > 0) {
            await withTransaction(async (client) => {
              await client.query(
                `UPDATE companies
                 SET subscription_status = $1, subscription_id = $2,
                     seat_count = $3, billing_period_end = $4
                 WHERE id = $5`,
                [stripeStatus, stripeSub.id, stripeSeats, stripePeriodEnd, company.id]
              );

              if (stripeStatus === "active" && company.suspended_at) {
                await client.query(
                  `UPDATE companies SET suspended_at = NULL, dunning_attempts = 0, grace_period_end = NULL WHERE id = $1`,
                  [company.id]
                );
              }
            });
            result.auto_fixed += fixes.length;
          }
        } else {
          if (company.subscription_status && company.subscription_status !== "none" && company.subscription_status !== "canceled") {
            result.discrepancies_found++;
            await logDiscrepancy(company.id, "phantom_subscription", company.subscription_status, "no_subscription_in_stripe");

            await withTransaction(async (client) => {
              await client.query(
                `UPDATE companies SET subscription_status = 'none', subscription_id = NULL, seat_count = 0 WHERE id = $1`,
                [company.id]
              );
            });
            result.auto_fixed++;
          }
        }

        if (company.grace_period_end && new Date(company.grace_period_end) < new Date()) {
          if (company.subscription_status === "past_due" && !company.suspended_at) {
            await withTransaction(async (client) => {
              await client.query(
                `UPDATE companies SET subscription_status = 'suspended', suspended_at = NOW() WHERE id = $1`,
                [company.id]
              );
            });
            await auditLog(null, "grace_period_expired_suspension", "companies", {
              company_id: company.id,
              grace_period_end: company.grace_period_end,
            });
          }
        }
      } catch (err: any) {
        result.errors.push(`Company ${company.id}: ${err.message}`);
      }
    }

    try {
      const dlqResult = await retryDeadLetterQueue();
      result.dlq_retried = dlqResult.retried;
      result.dlq_succeeded = dlqResult.succeeded;
    } catch (err: any) {
      result.errors.push(`DLQ retry: ${err.message}`);
    }

    await auditLog(null, "billing_reconciliation_complete", "companies", {
      companies_checked: result.companies_checked,
      discrepancies_found: result.discrepancies_found,
      auto_fixed: result.auto_fixed,
      dlq_retried: result.dlq_retried,
      dlq_succeeded: result.dlq_succeeded,
      errors: result.errors.length,
    });
  } catch (err: any) {
    result.errors.push(`Fatal: ${err.message}`);
    await auditLog(null, "billing_reconciliation_failed", "companies", { error: err.message });
  }

  return result;
}

async function logDiscrepancy(
  companyId: string,
  type: string,
  localValue: string,
  stripeValue: string
): Promise<void> {
  await query(
    `INSERT INTO billing_reconciliation_log (company_id, discrepancy_type, local_value, stripe_value)
     VALUES ($1, $2, $3, $4)`,
    [companyId, type, localValue, stripeValue]
  );
}

export function startReconciliationScheduler(): void {
  const INTERVAL = 60 * 60 * 1000;

  const run = async () => {
    try {
      console.log("[Reconciliation] Starting billing reconciliation...");
      const result = await runReconciliation();
      console.log(
        `[Reconciliation] Complete: ${result.companies_checked} checked, ` +
        `${result.discrepancies_found} discrepancies, ${result.auto_fixed} fixed, ` +
        `DLQ: ${result.dlq_retried} retried/${result.dlq_succeeded} succeeded, ` +
        `${result.errors.length} errors`
      );
    } catch (err: any) {
      console.error("[Reconciliation] Fatal error:", err.message);
    }
  };

  setTimeout(run, 30000);
  setInterval(run, INTERVAL);
}
