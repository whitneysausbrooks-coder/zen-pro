import { Router, type IRouter } from "express";
import { z } from "zod";
import { query, auditLog } from "../lib/db";

const router: IRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const registerSchema = z.object({
  user_id: z.string().regex(UUID_RE, "Invalid user_id (must be a v4 UUID)"),
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Invalid email").max(254),
  account_type: z.enum(["individual"]).default("individual"),
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
    const result = await query(
      `INSERT INTO app_users (id, email, name, account_type, last_login)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (id) DO UPDATE
         SET email = EXCLUDED.email,
             name = EXCLUDED.name,
             last_login = now()
       RETURNING id, email, name, account_type, created_at, last_login,
                 onboarding_complete, wearable_connected, wearable_type`,
      [user_id, normEmail, name, account_type],
    );
    await auditLog(user_id, "app_user_registered", "app_users", { account_type });
    return res.json({ success: true, user: result.rows[0] });
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
      `UPDATE app_users SET last_login = now() WHERE id = $1 RETURNING id`,
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
  const userId = req.params.id;
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
  const userId = req.params.id;
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

export default router;
