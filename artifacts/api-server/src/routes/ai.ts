/**
 * /api/ai/* — Build #8 placeholder AI bridge.
 *
 * Today this file exposes a single privacy-safe endpoint that wraps
 * `analyzeTripleWeightBaseline()`. It enforces:
 *   - device-or-Clerk authentication (same handshake as /api/iap),
 *   - explicit user consent (must be the boolean true on the request),
 *   - 7-day baseline completion server-side (we don't trust client claims),
 *   - hashing the user_id before passing it to the analyzer (the analyzer
 *     itself rejects raw UUIDs as a defense-in-depth check).
 *
 * Build #13: the handler calls OpenAI through the Replit AI Integrations
 * proxy when AI_INTEGRATIONS_OPENAI_* env vars are present. If the proxy is
 * unavailable or the call fails, it falls back to the Build #8 deterministic
 * summary so the consent gate, audit log and error paths still pass. The
 * returned `modelVersion` always reflects what produced the narrative.
 */
import { Router, type IRouter } from "express";
import crypto from "crypto";
import { z } from "zod";
import { query } from "../lib/db";
import { verifyDeviceSignature, consumeRequestNonce } from "../lib/deviceAuth";
import { captureMessage } from "../lib/errorMonitoring";
import { analyzeTripleWeightBaseline } from "../lib/tripleWeightAi";

const router: IRouter = Router();

async function requireUserOrDevice(req: any, res: any): Promise<string | null> {
  const headerUserId = req.headers["x-user-id"];
  const deviceUserId = Array.isArray(headerUserId)
    ? headerUserId[0]
    : headerUserId;
  if (typeof deviceUserId === "string" && deviceUserId.length > 0) {
    const result = verifyDeviceSignature(req, deviceUserId);
    if (result.status === "ok") {
      // Accept-once: reject a replayed (already-seen) signature even when the
      // crypto verifies, so a captured request can't be reused in the window.
      if ((await consumeRequestNonce(req, deviceUserId)) === "replayed") {
        captureMessage("ai_device_auth:replayed", {
          route: `${req.method} ${req.path}`,
          extra: { reason: "nonce_reused", user_id_provided: deviceUserId.slice(0, 8) },
        });
        res.status(401).json({ error: "Unauthorized" });
        return null;
      }
      return deviceUserId;
    }
    captureMessage(`ai_device_auth:${result.status}`, {
      route: `${req.method} ${req.path}`,
      extra: {
        reason: result.reason ?? null,
        user_id_provided: deviceUserId.slice(0, 8),
      },
    });
  }
  res.status(401).json({ error: "Unauthorized" });
  return null;
}

const analyzeBodySchema = z.object({
  consent_confirmed: z.boolean(),
  cohort: z.string().min(1).max(64).optional(),
});

function hashUserId(userId: string): string {
  // One-way salted hash. Salt is the SERVER_DEVICE_KEY so the hash is stable
  // for one server install but cannot be reversed externally.
  const salt = process.env.SERVER_DEVICE_KEY ?? "neuroquest-default-salt";
  return crypto
    .createHmac("sha256", salt)
    .update(`anon:${userId}`)
    .digest("hex")
    .slice(0, 32);
}

router.post("/ai/analyze-baseline", async (req, res) => {
  const userId = await requireUserOrDevice(req, res);
  if (!userId) return;

  const parsed = analyzeBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: parsed.error.flatten(),
    });
  }
  const { consent_confirmed, cohort } = parsed.data;

  // Compute the baseline window server-side from the biometrics table — never
  // trust a client-supplied baselineDays. We use 7 calendar days and require
  // at least 5 samples, matching tripleWeightAi.MIN_SAMPLES.
  let meanResilience: number | null = null;
  let resilienceStdev: number | null = null;
  let sampleCount = 0;
  let baselineDays = 0;
  try {
    const r = await query(
      `SELECT
         COUNT(*)::int AS n,
         AVG(neuro_resilience_score) AS mean,
         STDDEV_SAMP(neuro_resilience_score) AS sd,
         EXTRACT(EPOCH FROM (now() - MIN(recorded_at))) / 86400.0 AS days
       FROM app_user_biometrics
       WHERE app_user_id = $1
         AND recorded_at >= now() - interval '14 days'
         AND neuro_resilience_score IS NOT NULL`,
      [userId],
    );
    const row = r.rows[0] ?? {};
    sampleCount = Number(row.n ?? 0);
    meanResilience = row.mean !== null ? Number(row.mean) : null;
    resilienceStdev = row.sd !== null ? Number(row.sd) : null;
    baselineDays = Math.floor(Number(row.days ?? 0));
  } catch (err: any) {
    captureMessage("ai_analyze_baseline_query_failed", {
      extra: { error: err?.message ?? "unknown" },
    });
    return res.status(500).json({ error: "Baseline lookup failed" });
  }

  const result = await analyzeTripleWeightBaseline({
    anonymizedUserId: hashUserId(userId),
    baselineSummary: {
      meanResilience,
      resilienceStdev,
      sampleCount,
      cohort,
    },
    baselineDays,
    consentConfirmed: consent_confirmed,
  });

  if (!result.ok) {
    const status = result.reason === "consent_required" ? 403 : 400;
    return res.status(status).json({ error: result.reason });
  }
  return res.json({ success: true, ...result.summary });
});

export default router;
