/**
 * Triple-Weight Algorithm AI Bridge — Build #8 placeholder.
 *
 * Privacy-safe wrapper that decides whether the server may forward an
 * anonymized baseline summary to an external LLM (e.g. OpenAI) for
 * post-baseline insights.
 *
 * RULES (Build #8 spec, items 7 & 8):
 *   1. No raw health data. The caller passes a pre-computed `baselineSummary`
 *      object that already contains only derived, non-PII metrics.
 *   2. No personally identifying information. Caller passes `anonymizedUserId`
 *      (a one-way hash, NOT the app_users.id UUID) so the AI side never sees
 *      the real identifier.
 *   3. Explicit consent required. `consentConfirmed` must be the boolean true.
 *      Any other value => `consent_required`.
 *   4. Minimum 7-day baseline. Caller supplies `baselineDays`; less than 7 =>
 *      `baseline_incomplete`.
 *   5. The function does NOT call OpenAI in this build. It returns a
 *      deterministic placeholder so the route, consent gate, and audit log
 *      can all be wired up safely. When OpenAI is later wired in, the only
 *      change here will be the `summary` body.
 */

export interface BaselineSummary {
  /** Derived 7-day average resilience score, 0..100. */
  meanResilience: number | null;
  /** Standard deviation across the window. */
  resilienceStdev: number | null;
  /** Number of biometric samples in the window (denominator for completeness). */
  sampleCount: number;
  /** Caller-side anonymized cohort tag. Optional. */
  cohort?: string;
}

export interface AnalyzeBaselineInput {
  anonymizedUserId: string;
  baselineSummary: BaselineSummary;
  baselineDays: number;
  consentConfirmed: boolean;
}

export type AnalyzeBaselineResult =
  | {
      ok: true;
      summary: {
        narrative: string;
        suggestedFocus: "sleep" | "hrv" | "activity" | "balanced";
        confidence: number;
        modelVersion: string;
      };
    }
  | {
      ok: false;
      reason:
        | "consent_required"
        | "baseline_incomplete"
        | "invalid_anonymized_id"
        | "invalid_summary";
    };

const MIN_BASELINE_DAYS = 7;
const MIN_SAMPLES = 5;

export function analyzeTripleWeightBaseline(
  input: AnalyzeBaselineInput,
): AnalyzeBaselineResult {
  if (input.consentConfirmed !== true) {
    return { ok: false, reason: "consent_required" };
  }
  if (
    typeof input.anonymizedUserId !== "string" ||
    input.anonymizedUserId.length < 8 ||
    /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(
      input.anonymizedUserId,
    )
  ) {
    // Reject anything that looks like a raw UUID — caller must hash first.
    return { ok: false, reason: "invalid_anonymized_id" };
  }
  if (!input.baselineSummary || typeof input.baselineSummary !== "object") {
    return { ok: false, reason: "invalid_summary" };
  }
  if (input.baselineDays < MIN_BASELINE_DAYS) {
    return { ok: false, reason: "baseline_incomplete" };
  }
  if (input.baselineSummary.sampleCount < MIN_SAMPLES) {
    return { ok: false, reason: "baseline_incomplete" };
  }

  const mean = input.baselineSummary.meanResilience ?? 0;
  let suggestedFocus: "sleep" | "hrv" | "activity" | "balanced" = "balanced";
  if (mean < 40) suggestedFocus = "sleep";
  else if (mean < 60) suggestedFocus = "hrv";
  else if (mean < 75) suggestedFocus = "activity";

  return {
    ok: true,
    summary: {
      narrative: `Baseline established (${input.baselineDays}d). Mean neuro-resilience ${mean.toFixed(0)}/100.`,
      suggestedFocus,
      confidence: input.baselineSummary.sampleCount >= 14 ? 0.85 : 0.6,
      modelVersion: "placeholder-1.0",
    },
  };
}
