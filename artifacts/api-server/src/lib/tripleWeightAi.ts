/**
 * Triple-Weight Algorithm AI Bridge — Build #13 live OpenAI wiring.
 *
 * Privacy-safe wrapper that forwards an anonymized baseline summary to an
 * external LLM (OpenAI via Replit AI Integrations proxy) for post-baseline
 * neuro-resilience insights.
 *
 * RULES (Build #8 spec, items 7 & 8 — preserved verbatim in Build #13):
 *   1. No raw health data. The caller passes a pre-computed `baselineSummary`
 *      object that already contains only derived, non-PII metrics.
 *   2. No personally identifying information. Caller passes `anonymizedUserId`
 *      (a one-way hash, NOT the app_users.id UUID) so the AI side never sees
 *      the real identifier.
 *   3. Explicit consent required. `consentConfirmed` must be the boolean true.
 *      Any other value => `consent_required`.
 *   4. Minimum 7-day baseline. Caller supplies `baselineDays`; less than 7 =>
 *      `baseline_incomplete`.
 *   5. Build #13: a real LLM call is made through the Replit AI Integrations
 *      proxy. If the proxy is not configured OR the call fails OR the response
 *      cannot be parsed, the function falls back to the deterministic Build #8
 *      summary so the consent/audit path and clinical thresholds still behave
 *      identically. `modelVersion` always reflects what actually produced the
 *      narrative ("placeholder-1.0" on fallback, e.g. "gpt-5-mini-2026-05"
 *      on a live call) — never lie about provenance.
 */

import OpenAI from "openai";

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
const LIVE_MODEL = "gpt-5-mini";
const FALLBACK_MODEL_VERSION = "placeholder-1.0";

function deterministicFocus(
  mean: number,
): "sleep" | "hrv" | "activity" | "balanced" {
  if (mean < 40) return "sleep";
  if (mean < 60) return "hrv";
  if (mean < 75) return "activity";
  return "balanced";
}

function deterministicSummary(
  input: AnalyzeBaselineInput,
): Extract<AnalyzeBaselineResult, { ok: true }>["summary"] {
  const mean = input.baselineSummary.meanResilience ?? 0;
  return {
    narrative: `Baseline established (${input.baselineDays}d). Mean neuro-resilience ${mean.toFixed(0)}/100.`,
    suggestedFocus: deterministicFocus(mean),
    confidence: input.baselineSummary.sampleCount >= 14 ? 0.85 : 0.6,
    modelVersion: FALLBACK_MODEL_VERSION,
  };
}

let cachedClient: OpenAI | null = null;
function getClient(): OpenAI | null {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (!apiKey || !baseURL) return null;
  if (cachedClient) return cachedClient;
  cachedClient = new OpenAI({ apiKey, baseURL });
  return cachedClient;
}

interface LlmJsonShape {
  narrative?: unknown;
  suggestedFocus?: unknown;
  confidence?: unknown;
}

function coerceLlmResponse(
  raw: string,
  fallbackMean: number,
  fallbackSamples: number,
): Extract<AnalyzeBaselineResult, { ok: true }>["summary"] | null {
  let parsed: LlmJsonShape;
  try {
    parsed = JSON.parse(raw) as LlmJsonShape;
  } catch {
    return null;
  }
  const narrative =
    typeof parsed.narrative === "string" && parsed.narrative.trim().length > 0
      ? parsed.narrative.trim().slice(0, 600)
      : null;
  const focus =
    parsed.suggestedFocus === "sleep" ||
    parsed.suggestedFocus === "hrv" ||
    parsed.suggestedFocus === "activity" ||
    parsed.suggestedFocus === "balanced"
      ? parsed.suggestedFocus
      : deterministicFocus(fallbackMean);
  const confRaw =
    typeof parsed.confidence === "number" ? parsed.confidence : null;
  const confidence =
    confRaw !== null && confRaw >= 0 && confRaw <= 1
      ? Math.round(confRaw * 100) / 100
      : fallbackSamples >= 14
        ? 0.85
        : 0.6;
  if (!narrative) return null;
  return {
    narrative,
    suggestedFocus: focus,
    confidence,
    modelVersion: `${LIVE_MODEL}-build13`,
  };
}

export async function analyzeTripleWeightBaseline(
  input: AnalyzeBaselineInput,
): Promise<AnalyzeBaselineResult> {
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

  const meanRaw = input.baselineSummary.meanResilience ?? 0;
  const stdevRaw = input.baselineSummary.resilienceStdev ?? 0;
  const mean = Number.isFinite(meanRaw) ? Math.max(0, Math.min(100, meanRaw)) : 0;
  const stdev = Number.isFinite(stdevRaw) ? Math.max(0, Math.min(100, stdevRaw)) : 0;
  const samples = Math.max(0, Math.min(10000, Math.floor(input.baselineSummary.sampleCount)));
  const days = Math.max(0, Math.min(365, Math.floor(input.baselineDays)));
  // Cohort is INTENTIONALLY NOT forwarded to the LLM. Free-text client input
  // cannot be trusted to be PII-free, and the LLM does not need it to produce
  // a per-user insight. Cohort remains available to the caller for telemetry.

  const client = getClient();
  if (!client) {
    return { ok: true, summary: deterministicSummary(input) };
  }

  try {
    const completion = await client.chat.completions.create({
      model: LIVE_MODEL,
      max_completion_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are NeuroQuest's neuro-resilience coach. You receive ONLY anonymized, aggregated baseline statistics for one user (no PII, no raw biometrics). Return STRICT JSON with keys: narrative (string, <=2 sentences, plain-English, NO medical diagnosis, NO 'AI' filler, address the user as 'you'), suggestedFocus (one of: sleep, hrv, activity, balanced), confidence (number 0..1 reflecting how much the sample size supports the recommendation). Do not invent metrics not present in the input. Do not promise outcomes.",
        },
        {
          role: "user",
          content: JSON.stringify({
            meanResilience: Number(mean.toFixed(1)),
            resilienceStdev: Number(stdev.toFixed(2)),
            sampleCount: samples,
            baselineDays: days,
          }),
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    const coerced = coerceLlmResponse(raw, mean, samples);
    if (coerced) {
      return { ok: true, summary: coerced };
    }
    return { ok: true, summary: deterministicSummary(input) };
  } catch {
    return { ok: true, summary: deterministicSummary(input) };
  }
}
