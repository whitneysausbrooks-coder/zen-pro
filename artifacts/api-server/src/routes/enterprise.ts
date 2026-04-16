import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { query, auditLog } from "../lib/db";
import {
  calculateFullResilience,
  detectBurnoutTrend,
  analyzeBurnoutV2,
  analyzeBurnout,
  calculateCohesionDelta,
  calculateOutcomes,
  computeBaseline,
  linearRegression,
  runResetProtocol,
  ENGINE_VERSION,
  type PersonalBaseline,
} from "../lib/scoringEngine";
import { checkSeatAvailability, getCompanyBillingStatus } from "../lib/seatEnforcement";
import { runReconciliation } from "../lib/billingReconciliation";
import {
  getCurrentRevenueSummary,
  getMonthlyRevenueBreakdown,
  getRevenueJournal,
  snapshotRevenueRecognition,
} from "../lib/revenueRecognition";

const router: IRouter = Router();

function requireEnterpriseAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers["x-enterprise-key"] as string;
  const validKey = process.env.ENTERPRISE_API_KEY;
  if (!validKey || apiKey !== validKey) {
    res.status(401).json({ error: "Unauthorized: valid x-enterprise-key header required" });
    return;
  }
  next();
}

router.use("/enterprise/{*path}", requireEnterpriseAuth);

const biometricsSchema = z.object({
  user_id: z.string().uuid(),
  hrv: z.number().min(0).max(300),
  resting_hr: z.number().min(20).max(220),
  sleep_hours: z.number().min(0).max(24),
  sleep_score: z.number().min(0).max(100),
});

const behaviorsSchema = z.object({
  user_id: z.string().uuid(),
  mood_score: z.number().int().min(1).max(10),
  engagement_score: z.number().min(0).max(100),
});

const scoreRequestSchema = z.object({
  user_id: z.string().uuid(),
  cohesion: z.number().min(0).max(100).default(50),
});

router.post("/enterprise/users", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    company_id: z.string().uuid().optional(),
    role: z.enum(["employee", "manager", "admin"]).default("employee"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    if (parsed.data.company_id) {
      const seatCheck = await checkSeatAvailability(parsed.data.company_id);
      if (!seatCheck.allowed) {
        await auditLog(null, "user_create_blocked_seats", "enterprise_users", {
          email: parsed.data.email,
          company_id: parsed.data.company_id,
          reason: seatCheck.reason,
          seats_used: seatCheck.current_employees,
          seats_total: seatCheck.seat_count,
        });
        return res.status(403).json({
          error: seatCheck.reason,
          seats_used: seatCheck.current_employees,
          seats_total: seatCheck.seat_count,
        });
      }
    }

    const result = await query(
      `INSERT INTO enterprise_users (email, company_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
       RETURNING id, email, company_id, role, created_at`,
      [parsed.data.email, parsed.data.company_id || null, parsed.data.role]
    );
    await auditLog(result.rows[0].id, "user_created", "enterprise_users", { email: parsed.data.email });
    return res.json({ success: true, user: result.rows[0] });
  } catch (err: any) {
    console.error("Error creating user:", err.message);
    await auditLog(null, "user_create_failed", "enterprise_users", { error: err.message });
    return res.status(500).json({ error: "Failed to create user" });
  }
});

router.post("/enterprise/companies", async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).max(200),
    industry: z.string().max(100).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const result = await query(
      `INSERT INTO companies (name, industry) VALUES ($1, $2) RETURNING *`,
      [parsed.data.name, parsed.data.industry || null]
    );
    await auditLog(null, "company_created", "companies", { name: parsed.data.name });
    return res.json({ success: true, company: result.rows[0] });
  } catch (err: any) {
    console.error("Error creating company:", err.message);
    await auditLog(null, "company_create_failed", "companies", { error: err.message });
    return res.status(500).json({ error: "Failed to create company" });
  }
});

router.post("/enterprise/biometrics", async (req, res) => {
  const parsed = biometricsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const result = await query(
      `INSERT INTO biometrics (user_id, hrv, resting_hr, sleep_hours, sleep_score)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, recorded_at`,
      [parsed.data.user_id, parsed.data.hrv, parsed.data.resting_hr, parsed.data.sleep_hours, parsed.data.sleep_score]
    );
    await auditLog(parsed.data.user_id, "biometrics_submitted", "biometrics");
    return res.json({ success: true, id: result.rows[0].id, recorded_at: result.rows[0].recorded_at });
  } catch (err: any) {
    console.error("Error saving biometrics:", err.message);
    await auditLog(parsed.data.user_id, "biometrics_submit_failed", "biometrics", { error: err.message });
    return res.status(500).json({ error: "Failed to save biometrics" });
  }
});

router.post("/enterprise/behaviors", async (req, res) => {
  const parsed = behaviorsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const result = await query(
      `INSERT INTO behaviors (user_id, mood_score, engagement_score)
       VALUES ($1, $2, $3) RETURNING id, created_at`,
      [parsed.data.user_id, parsed.data.mood_score, parsed.data.engagement_score]
    );
    await auditLog(parsed.data.user_id, "behavior_submitted", "behaviors");
    return res.json({ success: true, id: result.rows[0].id, created_at: result.rows[0].created_at });
  } catch (err: any) {
    console.error("Error saving behaviors:", err.message);
    await auditLog(parsed.data.user_id, "behavior_submit_failed", "behaviors", { error: err.message });
    return res.status(500).json({ error: "Failed to save behaviors" });
  }
});

async function getOrBuildBaseline(userId: string): Promise<PersonalBaseline | null> {
  try {
    const existing = await query(
      `SELECT avg_wri, avg_nsb, avg_hrv, avg_sleep_hours, avg_sleep_score, data_points, established
       FROM user_baselines WHERE user_id = $1`,
      [userId]
    );
    if (existing.rows.length > 0 && existing.rows[0].established) {
      return existing.rows[0] as PersonalBaseline;
    }

    const history = await query(
      `SELECT rs.wri, rs.nsb, b.hrv, b.sleep_hours, b.sleep_score
       FROM resilience_scores rs
       LEFT JOIN biometrics b ON b.user_id = rs.user_id
         AND DATE(b.recorded_at) = DATE(rs.created_at)
       WHERE rs.user_id = $1
       ORDER BY rs.created_at ASC`,
      [userId]
    );

    if (history.rows.length < 3) return null;

    const wriH = history.rows.map((r: any) => parseFloat(r.wri));
    const nsbH = history.rows.map((r: any) => parseFloat(r.nsb));
    const hrvH = history.rows.filter((r: any) => r.hrv != null).map((r: any) => parseFloat(r.hrv));
    const sleepHH = history.rows.filter((r: any) => r.sleep_hours != null).map((r: any) => parseFloat(r.sleep_hours));
    const sleepSH = history.rows.filter((r: any) => r.sleep_score != null).map((r: any) => parseFloat(r.sleep_score));

    const bl = computeBaseline(wriH, nsbH, hrvH, sleepHH, sleepSH);

    await query(
      `INSERT INTO user_baselines (user_id, avg_wri, avg_nsb, avg_hrv, avg_sleep_hours, avg_sleep_score, data_points, established, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         avg_wri = EXCLUDED.avg_wri, avg_nsb = EXCLUDED.avg_nsb, avg_hrv = EXCLUDED.avg_hrv,
         avg_sleep_hours = EXCLUDED.avg_sleep_hours, avg_sleep_score = EXCLUDED.avg_sleep_score,
         data_points = EXCLUDED.data_points, established = EXCLUDED.established, updated_at = NOW()`,
      [userId, bl.avg_wri, bl.avg_nsb, bl.avg_hrv, bl.avg_sleep_hours, bl.avg_sleep_score, bl.data_points, bl.established]
    );

    return bl.established ? bl : null;
  } catch (err: any) {
    console.error("Error building baseline:", err.message);
    return null;
  }
}

router.post("/enterprise/score", async (req, res) => {
  const parsed = scoreRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const startTime = Date.now();

  try {
    const bio = await query(
      `SELECT hrv, resting_hr, sleep_hours, sleep_score FROM biometrics
       WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
      [parsed.data.user_id]
    );
    if (bio.rows.length === 0) return res.status(404).json({ error: "No biometric data found" });

    const beh = await query(
      `SELECT mood_score, engagement_score FROM behaviors
       WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [parsed.data.user_id]
    );
    if (beh.rows.length === 0) return res.status(404).json({ error: "No behavioral data found" });

    const { hrv, resting_hr, sleep_hours, sleep_score } = bio.rows[0];
    const { mood_score, engagement_score } = beh.rows[0];

    const scores = calculateFullResilience(
      hrv, resting_hr, mood_score, engagement_score,
      sleep_hours, sleep_score, parsed.data.cohesion
    );

    const wriHistoryRes = await query(
      `SELECT wri FROM resilience_scores WHERE user_id = $1 ORDER BY created_at DESC LIMIT 14`,
      [parsed.data.user_id]
    );
    const wriHistory = wriHistoryRes.rows.map((r: any) => parseFloat(r.wri)).reverse();
    wriHistory.push(scores.wri);

    const prevBioRes = await query(
      `SELECT hrv FROM biometrics WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 1 OFFSET 1`,
      [parsed.data.user_id]
    );
    const previousHRV = prevBioRes.rows.length > 0 ? parseFloat(prevBioRes.rows[0].hrv) : undefined;

    const baseline = await getOrBuildBaseline(parsed.data.user_id);

    const burnoutAnalysis = analyzeBurnoutV2({
      wriHistory,
      currentNSB: scores.nsb,
      currentHRV: hrv,
      previousHRV,
      currentSleepHours: sleep_hours,
      baseline,
    });

    const result = await query(
      `INSERT INTO resilience_scores (user_id, eri, cps, nsb, cohesion, wri, burnout_risk, engine_version, reasons)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, created_at`,
      [
        parsed.data.user_id, scores.eri, scores.cps, scores.nsb, scores.cohesion,
        scores.wri, burnoutAnalysis.risk, ENGINE_VERSION,
        JSON.stringify(burnoutAnalysis.reasons),
      ]
    );

    const latency = Date.now() - startTime;
    await auditLog(parsed.data.user_id, "score_calculated_v2", "resilience_scores", {
      wri: scores.wri,
      burnout_risk: burnoutAnalysis.risk,
      engine_version: ENGINE_VERSION,
      latency_ms: latency,
      reasons_count: burnoutAnalysis.reasons.length,
    });

    return res.json({
      success: true,
      scores: {
        ...scores,
        burnoutRisk: burnoutAnalysis.risk,
        id: result.rows[0].id,
        created_at: result.rows[0].created_at,
      },
      burnout_analysis: burnoutAnalysis,
      engine_version: ENGINE_VERSION,
    });
  } catch (err: any) {
    console.error("Error calculating score:", err.message);
    await auditLog(parsed.data.user_id, "score_calculation_failed", "resilience_scores", { error: err.message });
    return res.status(500).json({ error: "Failed to calculate score" });
  }
});

router.get("/enterprise/scores/:userId", async (req, res) => {
  const userId = req.params.userId;
  if (!z.string().uuid().safeParse(userId).success) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  try {
    const result = await query(
      `SELECT id, eri, cps, nsb, cohesion, wri, burnout_risk, engine_version, reasons, created_at
       FROM resilience_scores WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30`,
      [userId]
    );
    await auditLog(userId, "scores_viewed", "resilience_scores");
    return res.json({ scores: result.rows });
  } catch (err: any) {
    console.error("Error fetching scores:", err.message);
    return res.status(500).json({ error: "Failed to fetch scores" });
  }
});

router.get("/enterprise/burnout-analysis/:userId", async (req, res) => {
  const userId = req.params.userId;
  if (!z.string().uuid().safeParse(userId).success) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  try {
    const wriRes = await query(
      `SELECT wri FROM resilience_scores WHERE user_id = $1 ORDER BY created_at DESC LIMIT 14`,
      [userId]
    );
    const wriValues = wriRes.rows.map((r: any) => parseFloat(r.wri)).reverse();

    const bioRes = await query(
      `SELECT hrv, sleep_hours FROM biometrics WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 2`,
      [userId]
    );

    const currentHRV = bioRes.rows.length > 0 ? parseFloat(bioRes.rows[0].hrv) : undefined;
    const previousHRV = bioRes.rows.length > 1 ? parseFloat(bioRes.rows[1].hrv) : undefined;
    const currentSleepHours = bioRes.rows.length > 0 ? parseFloat(bioRes.rows[0].sleep_hours) : undefined;

    const latestScore = await query(
      `SELECT nsb FROM resilience_scores WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    const currentNSB = latestScore.rows.length > 0 ? parseFloat(latestScore.rows[0].nsb) : undefined;

    const baseline = await getOrBuildBaseline(userId);

    const analysis = analyzeBurnoutV2({
      wriHistory: wriValues,
      currentNSB,
      currentHRV,
      previousHRV,
      currentSleepHours,
      baseline,
    });

    await auditLog(userId, "burnout_analysis_viewed", "resilience_scores", {
      risk: analysis.risk,
      severity: analysis.severity,
    });

    return res.json(analysis);
  } catch (err: any) {
    console.error("Error running burnout analysis:", err.message);
    return res.status(500).json({ error: "Failed to run burnout analysis" });
  }
});

router.get("/enterprise/burnout-trend/:userId", async (req, res) => {
  const userId = req.params.userId;
  if (!z.string().uuid().safeParse(userId).success) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  try {
    const result = await query(
      `SELECT wri FROM resilience_scores WHERE user_id = $1 ORDER BY created_at DESC LIMIT 7`,
      [userId]
    );
    const wriValues = result.rows.map((r: any) => parseFloat(r.wri)).reverse();
    const trending = detectBurnoutTrend(wriValues);

    return res.json({
      trend_detected: trending,
      recent_scores: wriValues,
      alert: trending ? "Downward trend detected over 3+ days. Consider wellness intervention." : null,
    });
  } catch (err: any) {
    console.error("Error checking burnout trend:", err.message);
    return res.status(500).json({ error: "Failed to check burnout trend" });
  }
});

router.get("/enterprise/baseline/:userId", async (req, res) => {
  const userId = req.params.userId;
  if (!z.string().uuid().safeParse(userId).success) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  try {
    const baseline = await getOrBuildBaseline(userId);
    if (!baseline) {
      return res.json({ established: false, message: "Need at least 14 data points to establish baseline" });
    }
    return res.json(baseline);
  } catch (err: any) {
    console.error("Error fetching baseline:", err.message);
    return res.status(500).json({ error: "Failed to fetch baseline" });
  }
});

router.get("/enterprise/company/:companyId/metrics", async (req, res) => {
  const companyId = req.params.companyId;
  if (!z.string().uuid().safeParse(companyId).success) {
    return res.status(400).json({ error: "Invalid company ID" });
  }

  try {
    const result = await query(
      `SELECT
         COUNT(DISTINCT rs.user_id) as total_employees,
         ROUND(AVG(rs.wri)::numeric, 2) as avg_wri,
         ROUND(AVG(rs.burnout_risk)::numeric, 2) as avg_burnout_risk,
         ROUND(AVG(rs.eri)::numeric, 2) as avg_eri,
         ROUND(AVG(rs.cps)::numeric, 2) as avg_cps,
         ROUND(AVG(rs.nsb)::numeric, 2) as avg_nsb,
         COUNT(*) FILTER (WHERE rs.burnout_risk > 70) as high_risk_count,
         COUNT(*) FILTER (WHERE rs.burnout_risk BETWEEN 40 AND 70) as moderate_risk_count,
         COUNT(*) FILTER (WHERE rs.burnout_risk < 40) as low_risk_count
       FROM resilience_scores rs
       JOIN enterprise_users u ON rs.user_id = u.id
       WHERE u.company_id = $1
         AND rs.created_at = (
           SELECT MAX(rs2.created_at)
           FROM resilience_scores rs2
           WHERE rs2.user_id = rs.user_id
         )`,
      [companyId]
    );

    await auditLog(null, "company_metrics_viewed", "companies", { company_id: companyId });

    return res.json({
      company_id: companyId,
      metrics: result.rows[0] || {
        total_employees: 0, avg_wri: 0, avg_burnout_risk: 0,
        high_risk_count: 0, moderate_risk_count: 0, low_risk_count: 0,
      },
    });
  } catch (err: any) {
    console.error("Error fetching company metrics:", err.message);
    return res.status(500).json({ error: "Failed to fetch company metrics" });
  }
});

router.get("/enterprise/company/:companyId/dashboard", async (req, res) => {
  const companyId = req.params.companyId;
  if (!z.string().uuid().safeParse(companyId).success) {
    return res.status(400).json({ error: "Invalid company ID" });
  }
  const view = (req.query.view as string) || "executive";

  try {
    const latestScores = await query(
      `SELECT rs.user_id, rs.wri, rs.burnout_risk, rs.eri, rs.cps, rs.nsb, rs.cohesion, rs.reasons, rs.engine_version, rs.created_at
       FROM resilience_scores rs
       JOIN enterprise_users u ON rs.user_id = u.id
       WHERE u.company_id = $1
         AND rs.created_at = (SELECT MAX(rs2.created_at) FROM resilience_scores rs2 WHERE rs2.user_id = rs.user_id)`,
      [companyId]
    );

    const trend7d = await query(
      `SELECT
         DATE(rs.created_at) as day,
         ROUND(AVG(rs.wri)::numeric, 2) as avg_wri,
         ROUND(AVG(rs.burnout_risk)::numeric, 2) as avg_burnout_risk,
         ROUND(AVG(rs.cohesion)::numeric, 2) as avg_cohesion
       FROM resilience_scores rs
       JOIN enterprise_users u ON rs.user_id = u.id
       WHERE u.company_id = $1
         AND rs.created_at >= NOW() - INTERVAL '7 days'
       GROUP BY DATE(rs.created_at)
       ORDER BY day ASC`,
      [companyId]
    );

    const recentAvg = await query(
      `SELECT ROUND(AVG(rs.wri)::numeric, 2) as avg_wri, ROUND(AVG(rs.burnout_risk)::numeric, 2) as avg_burnout
       FROM resilience_scores rs
       JOIN enterprise_users u ON rs.user_id = u.id
       WHERE u.company_id = $1 AND rs.created_at >= NOW() - INTERVAL '7 days'`,
      [companyId]
    );

    const historicAvg = await query(
      `SELECT ROUND(AVG(rs.wri)::numeric, 2) as avg_wri, ROUND(AVG(rs.burnout_risk)::numeric, 2) as avg_burnout
       FROM resilience_scores rs
       JOIN enterprise_users u ON rs.user_id = u.id
       WHERE u.company_id = $1
         AND rs.created_at >= NOW() - INTERVAL '37 days'
         AND rs.created_at < NOW() - INTERVAL '7 days'`,
      [companyId]
    );

    const rows = latestScores.rows;
    const totalEmployees = rows.length;
    const avgWri = totalEmployees > 0 ? rows.reduce((s: number, r: any) => s + parseFloat(r.wri), 0) / totalEmployees : 0;
    const avgBurnoutRisk = totalEmployees > 0 ? rows.reduce((s: number, r: any) => s + parseFloat(r.burnout_risk), 0) / totalEmployees : 0;

    const trend14d = await query(
      `SELECT
         DATE(rs.created_at) as day,
         ROUND(AVG(rs.wri)::numeric, 2) as avg_wri,
         ROUND(AVG(rs.burnout_risk)::numeric, 2) as avg_burnout_risk
       FROM resilience_scores rs
       JOIN enterprise_users u ON rs.user_id = u.id
       WHERE u.company_id = $1
         AND rs.created_at >= NOW() - INTERVAL '14 days'
       GROUP BY DATE(rs.created_at)
       ORDER BY day ASC`,
      [companyId]
    );

    const temporalWriSeries = trend14d.rows.map((r: any) => parseFloat(r.avg_wri));
    const burnoutAnalysis = analyzeBurnoutV2({ wriHistory: temporalWriSeries });

    const allReasons = rows
      .filter((r: any) => r.reasons)
      .flatMap((r: any) => {
        try { return typeof r.reasons === "string" ? JSON.parse(r.reasons) : r.reasons; }
        catch { return []; }
      });

    const reasonFrequency: Record<string, number> = {};
    for (const r of allReasons) {
      if (r.factor && r.factor !== "Base WRI inverse") {
        reasonFrequency[r.factor] = (reasonFrequency[r.factor] || 0) + 1;
      }
    }
    const topReasons = Object.entries(reasonFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([factor, count]) => ({ factor, affected_employees: count }));

    const recentWri = parseFloat(recentAvg.rows[0]?.avg_wri || "0");
    const recentBurnout = parseFloat(recentAvg.rows[0]?.avg_burnout || "0");
    const histWri = parseFloat(historicAvg.rows[0]?.avg_wri || "0");
    const histBurnout = parseFloat(historicAvg.rows[0]?.avg_burnout || "0");

    const outcomes = calculateOutcomes(recentBurnout, histBurnout, recentWri, histWri);

    const executive = {
      avg_wri: Math.round(avgWri * 100) / 100,
      avg_burnout_risk: Math.round(avgBurnoutRisk * 100) / 100,
      total_employees: totalEmployees,
      burnout_severity: burnoutAnalysis.severity,
      burnout_alert: burnoutAnalysis.alert,
      trend_7d: trend7d.rows,
      top_risk_factors: topReasons,
      outcomes,
      projected_burnout_7d: burnoutAnalysis.projected_7d,
      projected_burnout_30d: burnoutAnalysis.projected_30d,
      trend_direction: burnoutAnalysis.trend_direction,
      engine_version: ENGINE_VERSION,
    };

    if (view === "manager") {
      const highRisk = rows.filter((r: any) => parseFloat(r.burnout_risk) > 70).length;
      const cohesionValues = rows.map((r: any) => parseFloat(r.cohesion));
      const currentCohesion = cohesionValues.length > 0 ? cohesionValues.reduce((a: number, b: number) => a + b, 0) / cohesionValues.length : 0;

      const prevCohesion = await query(
        `SELECT ROUND(AVG(rs.cohesion)::numeric, 2) as avg_cohesion
         FROM resilience_scores rs
         JOIN enterprise_users u ON rs.user_id = u.id
         WHERE u.company_id = $1
           AND rs.created_at >= NOW() - INTERVAL '14 days'
           AND rs.created_at < NOW() - INTERVAL '7 days'`,
        [companyId]
      );

      const previousCoh = parseFloat(prevCohesion.rows[0]?.avg_cohesion || "0");
      const cohesionDelta = calculateCohesionDelta(currentCohesion, previousCoh);

      await auditLog(null, "dashboard_viewed", "companies", { company_id: companyId, view: "manager", engine_version: ENGINE_VERSION });

      return res.json({
        view: "manager",
        ...executive,
        high_risk_employees: highRisk,
        high_risk_label: `${highRisk} employee${highRisk !== 1 ? "s" : ""} (anonymized)`,
        team_cohesion: Math.round(currentCohesion * 100) / 100,
        cohesion_delta: cohesionDelta,
        cohesion_label: `Team Cohesion ${cohesionDelta >= 0 ? "+" : ""}${cohesionDelta}%`,
      });
    }

    await auditLog(null, "dashboard_viewed", "companies", { company_id: companyId, view: "executive", engine_version: ENGINE_VERSION });
    return res.json({ view: "executive", ...executive });
  } catch (err: any) {
    console.error("Error fetching dashboard:", err.message);
    await auditLog(null, "dashboard_fetch_failed", "companies", { error: err.message, company_id: companyId });
    return res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

router.get("/enterprise/reset-protocol", (_req, res) => {
  return res.json(runResetProtocol());
});

router.get("/enterprise/seats/:companyId", async (req, res) => {
  const companyId = req.params.companyId;
  if (!z.string().uuid().safeParse(companyId).success) {
    return res.status(400).json({ error: "Invalid company ID" });
  }

  try {
    const status = await getCompanyBillingStatus(companyId);
    return res.json(status);
  } catch (err: any) {
    console.error("Error checking seats:", err.message);
    return res.status(500).json({ error: "Failed to check seat status" });
  }
});

router.post("/enterprise/reconcile", async (_req, res) => {
  try {
    const result = await runReconciliation();
    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error("Reconciliation error:", err.message);
    return res.status(500).json({ error: "Reconciliation failed" });
  }
});

router.get("/enterprise/audit-log", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
  const action = req.query.action as string | undefined;
  const resource = req.query.resource as string | undefined;
  const since = req.query.since as string | undefined;
  const format = req.query.format as string | undefined;

  try {
    let whereClause = "";
    const params: any[] = [];
    const conditions: string[] = [];

    if (action) {
      params.push(action);
      conditions.push(`action = $${params.length}`);
    }
    if (resource) {
      params.push(resource);
      conditions.push(`resource = $${params.length}`);
    }
    if (since) {
      params.push(new Date(since));
      conditions.push(`created_at >= $${params.length}`);
    }

    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(" AND ")}`;
    }

    params.push(limit);
    const limitParam = params.length;
    params.push(offset);
    const offsetParam = params.length;

    const result = await query(
      `SELECT id, user_id, action, resource, details, ip_address, created_at
       FROM audit_logs ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`,
      params.slice(0, params.length - 2)
    );

    if (format === "csv") {
      const csvHeader = "id,user_id,action,resource,details,ip_address,created_at\n";
      const csvRows = result.rows.map((r: any) =>
        [r.id, r.user_id || "", r.action, r.resource,
         JSON.stringify(r.details || {}).replace(/"/g, '""'),
         r.ip_address || "", r.created_at].map(v => `"${v}"`).join(",")
      ).join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=audit_log_export.csv");
      return res.send(csvHeader + csvRows);
    }

    return res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset,
    });
  } catch (err: any) {
    console.error("Error fetching audit logs:", err.message);
    return res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

router.get("/enterprise/revenue/summary", async (_req, res) => {
  try {
    const summary = await getCurrentRevenueSummary();
    await auditLog(null, "revenue_summary_viewed", "revenue_recognition");
    return res.json({
      as_of: new Date().toISOString(),
      currency: "usd",
      total_recognized_cents: summary.total_recognized,
      total_deferred_cents: summary.total_deferred,
      total_contract_value_cents: summary.total_contract_value,
      total_recognized: summary.total_recognized / 100,
      total_deferred: summary.total_deferred / 100,
      total_contract_value: summary.total_contract_value / 100,
      percent_recognized: summary.total_contract_value > 0
        ? Math.round((summary.total_recognized / summary.total_contract_value) * 10000) / 100
        : 0,
      active_companies: summary.companies.length,
      companies: summary.companies.map((c) => ({
        ...c,
        contract_value_display: (c.contract_value / 100).toFixed(2),
        recognized_display: (c.recognized / 100).toFixed(2),
        deferred_display: (c.deferred / 100).toFixed(2),
        daily_rate_display: (c.daily_rate / 100).toFixed(2),
      })),
    });
  } catch (err: any) {
    console.error("Revenue summary error:", err.message);
    return res.status(500).json({ error: "Failed to fetch revenue summary" });
  }
});

router.get("/enterprise/revenue/monthly", async (req, res) => {
  try {
    const months = Math.min(parseInt(req.query.months as string) || 12, 24);
    const breakdown = await getMonthlyRevenueBreakdown(months);
    await auditLog(null, "revenue_monthly_viewed", "revenue_recognition");
    return res.json({
      months: breakdown.map((m) => ({
        ...m,
        recognized_display: (m.recognized / 100).toFixed(2),
        new_bookings_display: (m.new_bookings / 100).toFixed(2),
        cancellations_display: (m.cancellations / 100).toFixed(2),
        seat_changes_display: (m.seat_changes / 100).toFixed(2),
        refunds_display: (m.refunds / 100).toFixed(2),
      })),
    });
  } catch (err: any) {
    console.error("Revenue monthly error:", err.message);
    return res.status(500).json({ error: "Failed to fetch monthly revenue" });
  }
});

router.get("/enterprise/revenue/journal", async (req, res) => {
  try {
    const companyId = req.query.company_id as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
    const format = req.query.format as string | undefined;

    if (companyId && !z.string().uuid().safeParse(companyId).success) {
      return res.status(400).json({ error: "Invalid company ID" });
    }

    const result = await getRevenueJournal(companyId, limit, offset);
    await auditLog(null, "revenue_journal_viewed", "revenue_journal");

    if (format === "csv") {
      const csvHeader = "date,company,type,amount_cents,amount_usd,description,subscription_id,seats,invoice_id\n";
      const csvRows = result.entries.map((e: any) =>
        [
          e.entry_date, e.company_name || e.company_id, e.entry_type,
          e.amount, (e.amount / 100).toFixed(2), (e.description || "").replace(/"/g, '""'),
          e.subscription_id || "", e.seat_count || "", e.invoice_id || "",
        ].map(v => `"${v}"`).join(",")
      ).join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=revenue_journal_export.csv");
      return res.send(csvHeader + csvRows);
    }

    return res.json({
      entries: result.entries,
      total: result.total,
      limit,
      offset,
    });
  } catch (err: any) {
    console.error("Revenue journal error:", err.message);
    return res.status(500).json({ error: "Failed to fetch revenue journal" });
  }
});

router.post("/enterprise/revenue/snapshot/:companyId", async (req, res) => {
  const companyId = req.params.companyId;
  if (!z.string().uuid().safeParse(companyId).success) {
    return res.status(400).json({ error: "Invalid company ID" });
  }

  try {
    await snapshotRevenueRecognition(companyId);
    await auditLog(null, "revenue_snapshot_created", "revenue_recognition", { company_id: companyId });
    return res.json({ success: true, company_id: companyId, snapshot_at: new Date().toISOString() });
  } catch (err: any) {
    console.error("Revenue snapshot error:", err.message);
    return res.status(500).json({ error: "Failed to create revenue snapshot" });
  }
});

export default router;
