import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { randomBytes } from "crypto";
import { query, auditLog } from "../lib/db";
import {
  mintDeviceCredentials,
  requireDeviceSignature,
  verifyDeviceSignature,
  consumeRequestNonce,
  isActiveInstall,
} from "../lib/deviceAuth";
import { captureMessage } from "../lib/errorMonitoring";

// Strict GDPR-only signature gate. Unlike the global `requireDeviceSignature`,
// this one HARD-401s when the signature is anything other than `ok`. Architect
// blocker (Apr 30 2026): export and erasure endpoints must not honor the
// global soft-mode rollout because they leak / destroy regulated data.
async function requireDeviceSignatureStrict(req: Request, res: Response, next: NextFunction) {
  const rawId = req.params["id"];
  const userId = Array.isArray(rawId) ? (rawId[0] ?? "") : (rawId ?? "");
  const result = verifyDeviceSignature(req, userId);
  (req as any).signatureCheck = result;
  if (result.status !== "ok") {
    // Surface every non-ok verdict with the SAME `active_install` discriminator
    // the general gate uses, so the strict-path lockout monitor can isolate REAL
    // members (device-aware clients) from the harmless pre-handshake tail. This
    // path ignores DEVICE_AUTH_SOFT_MODE, so a regression here can ONLY be
    // mitigated by reverting the bad deploy — see the strict/IAP monitor.
    captureMessage(`device_signature_strict:${result.status}`, {
      user_id: userId,
      route: `${req.method} ${req.path}`,
      extra: {
        reason: result.reason ?? null,
        scope: "gdpr_strict",
        active_install: isActiveInstall(req),
      },
    });
    return res.status(401).json({
      error: "Authentication failed",
      details: { reason: result.status, scope: "gdpr_strict" },
    });
  }
  // Accept-once: a replayed export/erasure request (same captured signature
  // inside the skew window) must be rejected even though the crypto is valid.
  if ((await consumeRequestNonce(req, userId)) === "replayed") {
    captureMessage("device_signature_strict:replayed", {
      user_id: userId,
      route: `${req.method} ${req.path}`,
      extra: {
        reason: "nonce_reused",
        scope: "gdpr_strict",
        active_install: isActiveInstall(req),
      },
    });
    return res.status(401).json({
      error: "Authentication failed",
      details: { reason: "replayed", scope: "gdpr_strict" },
    });
  }
  return next();
}

const router: IRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const registerSchema = z.object({
  user_id: z.string().regex(UUID_RE, "Invalid user_id (must be a v4 UUID)"),
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Invalid email").max(254),
  account_type: z.enum(["individual"]).default("individual"),
  // Optional: when present, server mints per-device signing credentials and
  // returns them in the response. Older mobile builds that omit this still
  // succeed (soft-mode tolerated).
  device_id: z.string().min(1).max(120).optional(),
});

/**
 * POST /api/app-user/register
 * Idempotent. Client owns the UUID (generated via expo-crypto on first launch).
 * Used for individual (non-enterprise) accounts. Enterprise users continue
 * to flow through /api/enterprise/lookup-invite + enterprise_users.
 */
router.post("/app-user/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: parsed.error.flatten(),
    });
  }
  const { user_id, name, email, account_type } = parsed.data;
  const normEmail = email.toLowerCase();

  try {
    // Architect HIGH (Apr 30 2026): block re-binding a tombstoned account.
    // After GDPR erasure, the row's email is `deleted_<random>@neuroquest.local`.
    // Allowing ON CONFLICT DO UPDATE on that PK would re-attach the historical
    // biometrics/outcomes to a new identity — defeats Article 17.
    const existing = await query<{ email: string }>(
      `SELECT email FROM app_users WHERE id = $1`,
      [user_id],
    );
    if (existing.rowCount && existing.rows[0].email.startsWith("deleted_")) {
      await auditLog(user_id, "app_user_register_blocked_tombstone", "app_users", {
        reason: "PK previously erased under GDPR Article 17",
      });
      return res.status(410).json({
        error: "Account previously erased",
        details: "This account ID has been permanently anonymized and cannot be reused.",
      });
    }

    const result = await query(
      `INSERT INTO app_users (id, email, name, display_name, account_type, last_login, updated_at)
       VALUES ($1, $2, $3, $3, $4, now(), now())
       ON CONFLICT (id) DO UPDATE
         SET email = EXCLUDED.email,
             name = EXCLUDED.name,
             display_name = COALESCE(app_users.display_name, EXCLUDED.display_name),
             last_login = now(),
             updated_at = now()
       RETURNING id, email, name, display_name, account_type, created_at, updated_at, last_login,
                 onboarding_complete, onboarding_status, baseline_status,
                 health_consent_status, watch_connected_status,
                 auth_provider, wearable_connected, wearable_type`,
      [user_id, normEmail, name, account_type],
    );
    await auditLog(user_id, "app_user_registered", "app_users", { account_type });
    // Mint per-device signing credentials when the client provided a device_id
    // and SERVER_DEVICE_KEY is configured. Returned alongside the user record
    // so the mobile client can store them in the keychain on the same trip.
    const deviceCreds = parsed.data.device_id
      ? mintDeviceCredentials({ user_id, device_id: parsed.data.device_id })
      : null;
    return res.json({
      success: true,
      user: result.rows[0],
      ...(deviceCreds
        ? { device_secret: deviceCreds.device_secret, issued_at: deviceCreds.issued_at }
        : {}),
    });
  } catch (err: any) {
    console.error("app_user/register failed:", err.message);
    await auditLog(null, "app_user_register_failed", "app_users", { error: err.message });
    return res.status(500).json({ error: "Failed to register user" });
  }
});

/**
 * POST /api/app-user/heartbeat
 * Updates last_login. Used on app cold-start to keep session-active metrics fresh.
 */
router.post("/app-user/heartbeat", async (req, res) => {
  const userId = String(req.body?.user_id ?? "");
  if (!UUID_RE.test(userId)) {
    return res.status(400).json({ error: "Invalid user_id" });
  }
  try {
    const r = await query(
      `UPDATE app_users SET last_login = now(), updated_at = now() WHERE id = $1 RETURNING id`,
      [userId],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "User not found" });
    return res.json({ success: true });
  } catch (err: any) {
    console.error("app_user/heartbeat failed:", err.message);
    return res.status(500).json({ error: "Heartbeat failed" });
  }
});

const biometricsSchema = z.object({
  user_id: z.string().regex(UUID_RE),
  hrv: z.number().min(0).max(300).nullable().optional(),
  sleep_hours: z.number().min(0).max(24).nullable().optional(),
  steps: z.number().int().min(0).max(200000).nullable().optional(),
  strain_score: z.number().min(0).max(21).nullable().optional(),
  data_source: z.enum(["manual", "wearable", "estimated"]).default("manual"),
});

// Triple-Weight Algorithm: HRV 50% / Sleep 35% / Strain 15% (per the brief).
// Component scores are scaled to [0, 100] so the composite is also [0, 100].
function computeNeuroResilienceScore(args: {
  hrv: number | null;
  sleep_hours: number | null;
  strain: number | null;
}): number | null {
  const { hrv, sleep_hours, strain } = args;
  // Need at least one signal to produce a score.
  if (hrv == null && sleep_hours == null && strain == null) return null;
  // Normalize each signal to a 0..100 score using clinically grounded ranges.
  const hrvScore = hrv != null ? Math.max(0, Math.min(100, (hrv / 100) * 100)) : null; // 100 ms ~ excellent
  const sleepScore =
    sleep_hours != null ? Math.max(0, Math.min(100, (sleep_hours / 8) * 100)) : null; // 8h target
  // Strain: lower is better in our framing; 21 (max WHOOP-style) → 0 score, 0 → 100.
  const strainScore =
    strain != null ? Math.max(0, Math.min(100, 100 - (strain / 21) * 100)) : null;

  let weighted = 0;
  let weightSum = 0;
  if (hrvScore != null) {
    weighted += hrvScore * 0.5;
    weightSum += 0.5;
  }
  if (sleepScore != null) {
    weighted += sleepScore * 0.35;
    weightSum += 0.35;
  }
  if (strainScore != null) {
    weighted += strainScore * 0.15;
    weightSum += 0.15;
  }
  if (weightSum === 0) return null;
  // Renormalize so missing signals don't artificially deflate the score.
  return Math.round((weighted / weightSum) * 10) / 10;
}

// 7-day exponential moving average (alpha = 2 / (N + 1) = 0.25 for N=7).
function computeEma7Day(prevEma: number | null, currentScore: number): number {
  const alpha = 2 / (7 + 1);
  if (prevEma == null) return currentScore;
  return Math.round((alpha * currentScore + (1 - alpha) * prevEma) * 10) / 10;
}

/**
 * POST /api/app-user/biometrics
 * Records a biometric session for an individual user, computes Neuro-Resilience
 * Score and rolling 7-day EMA, returns the result so the client can display it.
 */
router.post("/app-user/biometrics", async (req, res) => {
  const parsed = biometricsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: parsed.error.flatten(),
    });
  }
  const { user_id, hrv, sleep_hours, steps, strain_score, data_source } = parsed.data;

  try {
    const userExists = await query(`SELECT 1 FROM app_users WHERE id = $1`, [user_id]);
    if (userExists.rowCount === 0) {
      return res.status(404).json({ error: "User not registered" });
    }

    const score = computeNeuroResilienceScore({
      hrv: hrv ?? null,
      sleep_hours: sleep_hours ?? null,
      strain: strain_score ?? null,
    });

    let ema: number | null = null;
    if (score != null) {
      const prev = await query<{ ema_7day: number | null }>(
        `SELECT ema_7day FROM app_user_biometrics
         WHERE app_user_id = $1 AND ema_7day IS NOT NULL
         ORDER BY recorded_at DESC LIMIT 1`,
        [user_id],
      );
      ema = computeEma7Day(prev.rows[0]?.ema_7day ?? null, score);
    }

    const result = await query(
      `INSERT INTO app_user_biometrics
        (app_user_id, hrv, sleep_hours, steps, strain_score,
         neuro_resilience_score, ema_7day, data_source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, neuro_resilience_score, ema_7day, recorded_at`,
      [user_id, hrv ?? null, sleep_hours ?? null, steps ?? null, strain_score ?? null,
       score, ema, data_source],
    );

    let classification: "burnout_risk" | "recovery_needed" | "optimal" | "neutral" = "neutral";
    if (score != null) {
      if (score < 40) classification = "burnout_risk";
      else if (score < 60) classification = "recovery_needed";
      else if (score >= 75) classification = "optimal";
    }

    await auditLog(user_id, "biometrics_recorded", "app_user_biometrics", {
      score,
      ema,
      data_source,
    });

    return res.json({
      success: true,
      session_id: result.rows[0].id,
      neuro_resilience_score: score,
      ema_7day: ema,
      classification,
      recorded_at: result.rows[0].recorded_at,
    });
  } catch (err: any) {
    console.error("app_user/biometrics failed:", err.message);
    return res.status(500).json({ error: "Failed to record biometrics" });
  }
});

/**
 * GET /api/app-user/:id/baseline
 * Returns the user's most recent score, the 7-day EMA trend, recent sessions
 * count, and an AI-generated suggestion type based on the current trajectory.
 * This is what the dashboard calls on app start to drive personalization.
 */
router.get("/app-user/:id/baseline", async (req, res) => {
  const userId = String(req.params.id);
  if (!UUID_RE.test(userId)) {
    return res.status(400).json({ error: "Invalid user_id" });
  }
  try {
    const userRes = await query(
      `SELECT id, account_type, created_at, last_login
       FROM app_users WHERE id = $1`,
      [userId],
    );
    if (userRes.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const sessionsRes = await query<{
      hrv: number | null;
      sleep_hours: number | null;
      steps: number | null;
      neuro_resilience_score: number | null;
      ema_7day: number | null;
      recorded_at: string;
    }>(
      `SELECT hrv, sleep_hours, steps, neuro_resilience_score, ema_7day, recorded_at
       FROM app_user_biometrics
       WHERE app_user_id = $1
       ORDER BY recorded_at DESC
       LIMIT 30`,
      [userId],
    );

    const latest = sessionsRes.rows[0] ?? null;
    const sessionCount = sessionsRes.rowCount ?? 0;
    const score = latest?.neuro_resilience_score ?? null;
    const ema = latest?.ema_7day ?? null;

    let trend: "rising" | "falling" | "steady" | "insufficient_data" = "insufficient_data";
    if (sessionsRes.rows.length >= 2) {
      const recent = sessionsRes.rows[0]?.neuro_resilience_score;
      const previous = sessionsRes.rows[1]?.neuro_resilience_score;
      if (recent != null && previous != null) {
        const delta = recent - previous;
        if (delta > 3) trend = "rising";
        else if (delta < -3) trend = "falling";
        else trend = "steady";
      }
    }

    let suggestion: {
      type: "recovery" | "growth" | "burnout_alert" | "baseline_building";
      message: string;
    };
    if (sessionCount === 0) {
      suggestion = {
        type: "baseline_building",
        message:
          "Add your first biometrics to start your personalized AI baseline. The more you sync, the smarter it gets.",
      };
    } else if (score != null && score < 40) {
      suggestion = {
        type: "burnout_alert",
        message:
          "Your resilience is running low. Consider a recovery day — breathwork, a short walk, or earlier sleep tonight.",
      };
    } else if (score != null && score < 60) {
      suggestion = {
        type: "recovery",
        message:
          "Your trend suggests recovery work would help. Try a guided breath session or a gratitude reflection.",
      };
    } else {
      suggestion = {
        type: "growth",
        message:
          "You're in a strong window. Take on a focus challenge or a longer training session today.",
      };
    }

    // NOTE: We deliberately do NOT echo name/email here. The /baseline endpoint
    // is unauthenticated (keyed only by the device-issued UUID), and the
    // dashboard doesn't need the PII. Keep the response surface minimal so an
    // exposed UUID can only reveal a score, never identity.
    return res.json({
      success: true,
      account_type: userRes.rows[0].account_type,
      latest: latest
        ? {
            neuro_resilience_score: latest.neuro_resilience_score,
            ema_7day: latest.ema_7day,
            recorded_at: latest.recorded_at,
          }
        : null,
      trend,
      ema_7day: ema,
      session_count: sessionCount,
      suggestion,
      // Sanitized history: scores + timestamps only, never raw biometrics +
      // never the user's identity. The dashboard only needs the trend.
      history: sessionsRes.rows.map((r) => ({
        neuro_resilience_score: r.neuro_resilience_score,
        ema_7day: r.ema_7day,
        recorded_at: r.recorded_at,
      })),
    });
  } catch (err: any) {
    console.error("app_user/baseline failed:", err.message);
    return res.status(500).json({ error: "Failed to load baseline" });
  }
});

/**
 * POST /api/app-user/:id/feedback
 * Stores user feedback on an AI suggestion so the engine can refine future
 * suggestions per user.
 */
const feedbackSchema = z.object({
  suggestion_type: z.string().min(1).max(50),
  triggered_score: z.number().nullable().optional(),
  accepted: z.boolean(),
  feedback_rating: z.number().int().min(1).max(5).nullable().optional(),
});
router.post("/app-user/:id/feedback", async (req, res) => {
  const userId = String(req.params.id);
  if (!UUID_RE.test(userId)) return res.status(400).json({ error: "Invalid user_id" });
  const parsed = feedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }
  try {
    await query(
      `INSERT INTO app_user_ai_personalization
        (app_user_id, suggestion_type, suggestion_payload, triggered_score,
         accepted, feedback_rating, responded_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())`,
      [
        userId,
        parsed.data.suggestion_type,
        JSON.stringify({}),
        parsed.data.triggered_score ?? null,
        parsed.data.accepted,
        parsed.data.feedback_rating ?? null,
      ],
    );
    return res.json({ success: true });
  } catch (err: any) {
    console.error("app_user/feedback failed:", err.message);
    return res.status(500).json({ error: "Failed to record feedback" });
  }
});

// ---------- ZenPro Sprint Checklist endpoints (April 2026) ----------

const TOS_VERSION = "2026.04.29";
const PRIVACY_VERSION = "2026.04.29";

/** GET /api/app-user/:id/tos-status — has the user accepted the current legal docs? */
router.get("/app-user/:id/tos-status", requireDeviceSignature, async (req, res) => {
  const userId = String(req.params.id);
  if (!UUID_RE.test(userId)) return res.status(400).json({ error: "Invalid user_id" });
  try {
    const r = await query<{ tos_version: string; privacy_version: string; accepted_at: string }>(
      `SELECT tos_version, privacy_version, accepted_at
         FROM app_user_tos_acceptances
        WHERE app_user_id = $1
        ORDER BY accepted_at DESC
        LIMIT 1`,
      [userId],
    );
    const row = r.rows[0] ?? null;
    const current =
      row?.tos_version === TOS_VERSION && row?.privacy_version === PRIVACY_VERSION;
    return res.json({
      success: true,
      current_tos_version: TOS_VERSION,
      current_privacy_version: PRIVACY_VERSION,
      accepted: !!row && current,
      last_acceptance: row,
    });
  } catch (err: any) {
    console.error("app_user/tos-status failed:", err.message);
    return res.status(500).json({ error: "Failed to load ToS status" });
  }
});

/**
 * POST /api/app-user/:id/tos-accept — record a user's acceptance of the
 * current ToS + Privacy version. Idempotent: a duplicate accept on the same
 * version is a no-op (no INSERT) so we don't bloat the table on every launch.
 */
const tosAcceptSchema = z.object({
  tos_version: z.string().min(1).max(40),
  privacy_version: z.string().min(1).max(40),
});
router.post("/app-user/:id/tos-accept", requireDeviceSignature, async (req, res) => {
  const userId = String(req.params.id);
  if (!UUID_RE.test(userId)) return res.status(400).json({ error: "Invalid user_id" });
  const parsed = tosAcceptSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }
  try {
    const userExists = await query(`SELECT 1 FROM app_users WHERE id = $1`, [userId]);
    if (userExists.rowCount === 0) return res.status(404).json({ error: "User not registered" });

    const ip = (req.ip ?? req.headers["x-forwarded-for"] ?? null) as string | null;
    const ua = (req.headers["user-agent"] ?? null) as string | null;
    // ON CONFLICT DO NOTHING + the unique index from migrate.ts make this
    // idempotent at the DB level (no SELECT-then-INSERT race). When a
    // duplicate is suppressed, RETURNING yields zero rows.
    const result = await query(
      `INSERT INTO app_user_tos_acceptances
        (app_user_id, tos_version, privacy_version, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (app_user_id, tos_version, privacy_version) DO NOTHING
       RETURNING id`,
      [userId, parsed.data.tos_version, parsed.data.privacy_version, ip, ua],
    );
    const inserted = (result.rowCount ?? 0) > 0;
    if (inserted) {
      await auditLog(userId, "tos_accepted", "app_user_tos_acceptances", {
        tos_version: parsed.data.tos_version,
        privacy_version: parsed.data.privacy_version,
      });
    }
    return res.json({
      success: true,
      recorded: inserted,
      ...(inserted ? {} : { reason: "already_accepted" }),
    });
  } catch (err: any) {
    console.error("app_user/tos-accept failed:", err.message);
    return res.status(500).json({ error: "Failed to record acceptance" });
  }
});

/**
 * POST /api/app-user/:id/auth-event — log a login / logout / session refresh
 * event with device + version metadata. Lightweight; called from the mobile
 * lifecycle hooks, not from the user.
 */
const authEventSchema = z.object({
  event_type: z.enum([
    "login",
    "logout",
    "session_resume",
    "session_refresh",
    "session_timeout",
    "identity_reconciled",
  ]),
  device_id: z.string().max(120).nullable().optional(),
  device_platform: z.string().max(40).nullable().optional(),
  app_version: z.string().max(40).nullable().optional(),
});
router.post("/app-user/:id/auth-event", requireDeviceSignature, async (req, res) => {
  const userId = String(req.params.id);
  // For logout we still want to record even if the id format is suspect, so
  // we don't drop tail-end events. But we do enforce a basic shape.
  if (!UUID_RE.test(userId)) return res.status(400).json({ error: "Invalid user_id" });
  const parsed = authEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }
  try {
    const ip = (req.ip ?? req.headers["x-forwarded-for"] ?? null) as string | null;
    const ua = (req.headers["user-agent"] ?? null) as string | null;
    await query(
      `INSERT INTO app_user_auth_events
        (app_user_id, event_type, device_id, device_platform, app_version, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        parsed.data.event_type,
        parsed.data.device_id ?? null,
        parsed.data.device_platform ?? null,
        parsed.data.app_version ?? null,
        ip,
        ua,
      ],
    );
    return res.json({ success: true });
  } catch (err: any) {
    console.error("app_user/auth-event failed:", err.message);
    // Auth events must never block the user — return success-like 200 with a
    // logged warning so the client doesn't retry-loop.
    return res.status(200).json({ success: false, recorded: false });
  }
});

/**
 * POST /api/app-user/:id/sync-error — record a wearable SDK / API failure so
 * silent device sync problems surface in the admin dashboard (G12).
 */
const syncErrorSchema = z.object({
  device_source: z.string().min(1).max(40),
  error_code: z.string().max(80).nullable().optional(),
  error_message: z.string().min(1).max(500),
  payload_excerpt: z.string().max(500).nullable().optional(),
});
router.post("/app-user/:id/sync-error", requireDeviceSignature, async (req, res) => {
  const userId = String(req.params.id);
  if (!UUID_RE.test(userId)) return res.status(400).json({ error: "Invalid user_id" });
  const parsed = syncErrorSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }
  try {
    await query(
      `INSERT INTO wearable_sync_errors
        (app_user_id, device_source, error_code, error_message, payload_excerpt)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        parsed.data.device_source,
        parsed.data.error_code ?? null,
        parsed.data.error_message,
        parsed.data.payload_excerpt ?? null,
      ],
    );
    return res.json({ success: true });
  } catch (err: any) {
    console.error("app_user/sync-error failed:", err.message);
    return res.status(200).json({ success: false, recorded: false });
  }
});

/**
 * POST /api/app-user/:id/outcome — record the downstream effect of an AI
 * recommendation: what the user did, the pre/post resilience scores, and the
 * delta. Drives the model retraining pipeline (4.3).
 */
const outcomeSchema = z.object({
  personalization_id: z.number().int().positive().nullable().optional(),
  action_taken: z.string().min(1).max(80),
  pre_score: z.number().min(0).max(100).nullable().optional(),
  post_score: z.number().min(0).max(100).nullable().optional(),
  observed_window_hours: z.number().int().min(0).max(168).nullable().optional(),
  model_version: z.string().max(40).nullable().optional(),
});
router.post("/app-user/:id/outcome", requireDeviceSignature, async (req, res) => {
  const userId = String(req.params.id);
  if (!UUID_RE.test(userId)) return res.status(400).json({ error: "Invalid user_id" });
  const parsed = outcomeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }
  try {
    const userExists = await query(`SELECT 1 FROM app_users WHERE id = $1`, [userId]);
    if (userExists.rowCount === 0) return res.status(404).json({ error: "User not registered" });

    const pre = parsed.data.pre_score ?? null;
    const post = parsed.data.post_score ?? null;
    const delta = pre != null && post != null ? Math.round((post - pre) * 10) / 10 : null;

    const r = await query<{ id: number }>(
      `INSERT INTO ai_outcome_feedback
        (app_user_id, personalization_id, action_taken, pre_score, post_score,
         score_delta, observed_window_hours, model_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        userId,
        parsed.data.personalization_id ?? null,
        parsed.data.action_taken,
        pre,
        post,
        delta,
        parsed.data.observed_window_hours ?? null,
        parsed.data.model_version ?? null,
      ],
    );
    return res.json({ success: true, outcome_id: r.rows[0]?.id, delta });
  } catch (err: any) {
    console.error("app_user/outcome failed:", err.message);
    return res.status(500).json({ error: "Failed to record outcome" });
  }
});

// =====================================================================
// GDPR data-subject rights (Article 15 access / Article 17 erasure).
// Both routes require a valid device HMAC signature for the user being
// acted on. Erasure is implemented as ANONYMIZATION rather than hard
// delete so audit_logs and ON DELETE SET NULL FKs (auth events, sync
// errors) stay intact for HIPAA/SOC2 forensic integrity. Requested by
// Whitney as the GDPR rights surface advertised in README §7.
// =====================================================================

router.get("/app-user/:id/export", requireDeviceSignatureStrict, async (req, res) => {
  const userId = String(req.params.id);
  if (!UUID_RE.test(userId)) return res.status(400).json({ error: "Invalid user_id" });
  try {
    const userRes = await query(`SELECT * FROM app_users WHERE id = $1`, [userId]);
    if (userRes.rowCount === 0) return res.status(404).json({ error: "User not found" });

    const [biometrics, ai, tos, authEvents, syncErrors, outcomes] = await Promise.all([
      query(`SELECT * FROM app_user_biometrics WHERE app_user_id = $1 ORDER BY recorded_at DESC`, [userId]),
      query(`SELECT * FROM app_user_ai_personalization WHERE app_user_id = $1 ORDER BY triggered_at DESC`, [userId]),
      query(`SELECT * FROM app_user_tos_acceptances WHERE app_user_id = $1 ORDER BY accepted_at DESC`, [userId]),
      query(`SELECT * FROM app_user_auth_events WHERE app_user_id = $1 ORDER BY occurred_at DESC`, [userId]),
      query(`SELECT * FROM wearable_sync_errors WHERE app_user_id = $1 ORDER BY occurred_at DESC`, [userId]),
      query(`SELECT * FROM ai_outcome_feedback WHERE app_user_id = $1 ORDER BY recorded_at DESC`, [userId]),
    ]);

    await auditLog(userId, "gdpr_export_requested", "app_users", {
      counts: {
        biometrics: biometrics.rowCount ?? 0,
        ai_personalization: ai.rowCount ?? 0,
        tos_acceptances: tos.rowCount ?? 0,
        auth_events: authEvents.rowCount ?? 0,
        wearable_sync_errors: syncErrors.rowCount ?? 0,
        ai_outcome_feedback: outcomes.rowCount ?? 0,
      },
    });

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="neuroquest-export-${userId}.json"`,
    );
    return res.json({
      export_format_version: "1.0",
      exported_at: new Date().toISOString(),
      data_subject_id: userId,
      profile: userRes.rows[0],
      biometrics: biometrics.rows,
      ai_personalization: ai.rows,
      tos_acceptances: tos.rows,
      auth_events: authEvents.rows,
      wearable_sync_errors: syncErrors.rows,
      ai_outcome_feedback: outcomes.rows,
    });
  } catch (err: any) {
    console.error("gdpr_export failed:", err.message);
    return res.status(500).json({ error: "Export failed" });
  }
});

const deleteSchema = z.object({
  confirm: z.literal("DELETE_MY_DATA"),
});

router.post("/app-user/:id/delete", requireDeviceSignatureStrict, async (req, res) => {
  const userId = String(req.params.id);
  if (!UUID_RE.test(userId)) return res.status(400).json({ error: "Invalid user_id" });
  const parsed = deleteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Confirmation required",
      details: 'Body must include { "confirm": "DELETE_MY_DATA" }',
    });
  }
  try {
    const userRes = await query<{ id: string; email: string }>(
      `SELECT id, email FROM app_users WHERE id = $1`,
      [userId],
    );
    if (userRes.rowCount === 0) return res.status(404).json({ error: "User not found" });
    // Idempotency + tombstone: if already anonymized, do not re-randomize the
    // placeholder (would let an attacker brute-force fresh IDs to confirm an
    // ID was previously a real user via timing/audit traces).
    if (userRes.rows[0].email.startsWith("deleted_")) {
      return res.json({
        success: true,
        method: "already_anonymized",
        data_subject_id: userId,
      });
    }

    // Architect HIGH (Apr 30 2026): placeholders MUST NOT be derivable from
    // the PK, otherwise a re-register with the same ID could reattach
    // historical data. Use cryptographically random opaque tombstone IDs.
    const tombstone = randomBytes(16).toString("hex");
    const placeholderEmail = `deleted_${tombstone}@neuroquest.local`;
    const placeholderName = `deleted_${tombstone}`;

    // Anonymize PII on the parent row but KEEP the PK so child rows with
    // ON DELETE CASCADE survive (the data they hold is now de-identified
    // because biometrics/outcomes are not directly identifying without
    // the email/name). Audit-log integrity preserved.
    await query(
      `UPDATE app_users
       SET email = $1, name = $2, wearable_connected = false, wearable_type = NULL
       WHERE id = $3`,
      [placeholderEmail, placeholderName, userId],
    );
    // Strip request-time PII from log tables (IP / UA).
    await query(
      `UPDATE app_user_auth_events
       SET ip_address = NULL, user_agent = NULL, device_id = NULL
       WHERE app_user_id = $1`,
      [userId],
    );
    await query(
      `UPDATE app_user_tos_acceptances
       SET ip_address = NULL, user_agent = NULL
       WHERE app_user_id = $1`,
      [userId],
    );

    await auditLog(userId, "gdpr_erasure_anonymized", "app_users", {
      anonymized_email: placeholderEmail,
      anonymized_name: placeholderName,
      method: "anonymize_in_place",
      reason: "Preserve audit_logs and SET NULL FK integrity",
    });

    return res.json({
      success: true,
      method: "anonymize_in_place",
      data_subject_id: userId,
      anonymized_email: placeholderEmail,
    });
  } catch (err: any) {
    console.error("gdpr_delete failed:", err.message);
    return res.status(500).json({ error: "Erasure failed" });
  }
});

export default router;
