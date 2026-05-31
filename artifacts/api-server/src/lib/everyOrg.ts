import { query } from "./db";

/**
 * Compassion Reels — business-funded micro-donations via every.org.
 *
 * IMPORTANT ARCHITECTURE NOTE
 * Real per-event micro-donations to a charity are economically impossible
 * (a card/ACH transfer of a few cents is dwarfed by processor fees). The
 * honest, correct model — and the one every.org supports — is ACCRUE-then-
 * SETTLE: each Compassion Milestone accrues a real, committed micro-donation
 * in our ledger (capped by a hard monthly budget the BUSINESS funds), and the
 * aggregate is settled to the nonprofit in batches through every.org. every.org
 * then fires a webhook confirming the disbursement.
 *
 * The user NEVER pays. This is a "the company donates when you play" mechanic,
 * not gambling and not an in-app purchase.
 */

export interface CompassionConfig {
  nonprofitSlug: string;
  monthlyBudgetCents: number;
  milestoneCents: number;
  apiKey: string;
  webhookToken: string;
}

function parseIntSafe(value: string | undefined, fallback: number): number {
  const n = parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function compassionConfig(): CompassionConfig {
  return {
    nonprofitSlug: process.env.COMPASSION_NONPROFIT_SLUG || "feeding-america",
    monthlyBudgetCents: parseIntSafe(process.env.COMPASSION_MONTHLY_BUDGET_CENTS, 5000),
    milestoneCents: parseIntSafe(process.env.COMPASSION_MILESTONE_CENTS, 10),
    apiKey: process.env.EVERY_ORG_API_KEY || "",
    webhookToken: process.env.EVERY_ORG_WEBHOOK_TOKEN || "",
  };
}

/** Current month bucket used for cap accounting, e.g. "2026-05" (UTC). */
export function currentPeriod(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Validate that the configured nonprofit exists on every.org. Requires the
 * partner API key; degrades to a no-op (treated as valid) when no key is set so
 * development without credentials still works.
 */
export async function validateNonprofit(
  slug: string
): Promise<{ ok: boolean; skipped?: boolean; status?: number; name?: string }> {
  const { apiKey } = compassionConfig();
  if (!apiKey) return { ok: true, skipped: true };
  try {
    const res = await fetch(
      `https://partners.every.org/v0.2/nonprofit/${encodeURIComponent(slug)}?apiKey=${encodeURIComponent(apiKey)}`
    );
    if (!res.ok) return { ok: false, status: res.status };
    const data: any = await res.json();
    return { ok: true, name: data?.data?.nonprofit?.name ?? data?.nonprofit?.name };
  } catch {
    return { ok: false };
  }
}

/**
 * Build an every.org donate link the BUSINESS completes to settle an accrued
 * batch to the nonprofit. `partner_donation_id` is our batch id so the webhook
 * can match the confirmation back to the ledger rows.
 */
export function buildSettlementLink(amountCents: number, batchId: string): string {
  const { nonprofitSlug, webhookToken } = compassionConfig();
  const params = new URLSearchParams();
  params.set("amount", (amountCents / 100).toFixed(2));
  params.set("partner_donation_id", batchId);
  params.set(
    "description",
    "NeuroQuest Compassion Reels — business-funded community giving"
  );
  if (webhookToken) params.set("webhook_token", webhookToken);
  return `https://www.every.org/${nonprofitSlug}/donate?${params.toString()}`;
}

/**
 * Process an every.org donation webhook confirming a settlement batch. Marks
 * the matching `settling` ledger rows as `settled`. Returns how many rows were
 * confirmed. Verifies the shared webhook token when one is configured.
 */
export async function handleEveryOrgWebhook(
  rawBody: Buffer,
  providedToken: string | undefined
): Promise<{ ok: boolean; reason?: string; settled?: number }> {
  const { webhookToken } = compassionConfig();
  // Fail-closed: a webhook can flip ledger rows to `settled` (i.e. assert real
  // money moved), so we must be able to authenticate it. In production, refuse
  // to process webhooks at all unless a shared token is configured. In
  // development we allow an unset token so the flow can be exercised locally.
  if (!webhookToken) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, reason: "webhook_token_not_configured" };
    }
  } else if (providedToken !== webhookToken) {
    return { ok: false, reason: "invalid_token" };
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return { ok: false, reason: "invalid_json" };
  }

  const batchId: string | undefined =
    payload?.partnerDonationId ||
    payload?.partner_donation_id ||
    payload?.partnerMetadata?.partner_donation_id;
  if (!batchId) return { ok: false, reason: "missing_batch_id" };

  const chargeId: string | null =
    payload?.chargeId || payload?.charge_id || payload?.id || null;

  const result = await query(
    `UPDATE compassion_donations
        SET status = 'settled', settled_at = now(), every_org_charge_id = $2
      WHERE batch_id = $1 AND status = 'settling'`,
    [batchId, chargeId]
  );
  return { ok: true, settled: result.rowCount ?? 0 };
}
