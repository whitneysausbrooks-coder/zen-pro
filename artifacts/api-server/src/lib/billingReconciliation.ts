import { getStripeClient, isStripeConfigured } from "../stripeClient";
import { query, auditLog } from "./db";

interface ReconciliationResult {
  companies_checked: number;
  discrepancies_found: number;
  auto_fixed: number;
  errors: string[];
}

export async function runReconciliation(): Promise<ReconciliationResult> {
  const result: ReconciliationResult = {
    companies_checked: 0,
    discrepancies_found: 0,
    auto_fixed: 0,
    errors: [],
  };

  if (!isStripeConfigured()) {
    result.errors.push("Stripe not configured — reconciliation skipped");
    return result;
  }

  try {
    const companies = await query(
      `SELECT id, name, stripe_customer_id, subscription_status, subscription_id,
              seat_count, billing_period_end
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
          const stripePeriodEnd = new Date((stripeSub.current_period_end as number) * 1000);

          if (company.subscription_status !== stripeStatus) {
            result.discrepancies_found++;
            await logDiscrepancy(company.id, "status_mismatch", company.subscription_status, stripeStatus);
            await query(
              `UPDATE companies SET subscription_status = $1, subscription_id = $2 WHERE id = $3`,
              [stripeStatus, stripeSub.id, company.id]
            );
            result.auto_fixed++;
          }

          if (company.seat_count !== stripeSeats) {
            result.discrepancies_found++;
            await logDiscrepancy(company.id, "seat_mismatch", String(company.seat_count), String(stripeSeats));
            await query(`UPDATE companies SET seat_count = $1 WHERE id = $2`, [stripeSeats, company.id]);
            result.auto_fixed++;
          }

          const localEnd = company.billing_period_end ? new Date(company.billing_period_end).getTime() : 0;
          const stripeEnd = stripePeriodEnd.getTime();
          if (Math.abs(localEnd - stripeEnd) > 60000) {
            result.discrepancies_found++;
            await logDiscrepancy(company.id, "period_end_mismatch",
              company.billing_period_end?.toISOString() || "null",
              stripePeriodEnd.toISOString()
            );
            await query(`UPDATE companies SET billing_period_end = $1 WHERE id = $2`, [stripePeriodEnd, company.id]);
            result.auto_fixed++;
          }
        } else {
          if (company.subscription_status === "active") {
            result.discrepancies_found++;
            await logDiscrepancy(company.id, "phantom_active", company.subscription_status, "no_subscription");
            await query(
              `UPDATE companies SET subscription_status = 'none', subscription_id = NULL, seat_count = 0 WHERE id = $1`,
              [company.id]
            );
            result.auto_fixed++;
          }
        }
      } catch (err: any) {
        result.errors.push(`Company ${company.id}: ${err.message}`);
      }
    }

    await auditLog(null, "billing_reconciliation_complete", "companies", {
      companies_checked: result.companies_checked,
      discrepancies_found: result.discrepancies_found,
      auto_fixed: result.auto_fixed,
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
        `${result.errors.length} errors`
      );
    } catch (err: any) {
      console.error("[Reconciliation] Fatal error:", err.message);
    }
  };

  setTimeout(run, 30000);
  setInterval(run, INTERVAL);
}
