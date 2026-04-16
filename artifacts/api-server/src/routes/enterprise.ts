import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { query, auditLog } from "../lib/db";
import {
  calculateFullResilience,
  detectBurnoutTrend,
  analyzeBurnout,
  calculateCohesionDelta,
  runResetProtocol,
} from "../lib/scoringEngine";

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
    return res.status(500).json({ error: "Failed to save behaviors" });
  }
});

router.post("/enterprise/score", async (req, res) => {
  const parsed = scoreRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

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

    const result = await query(
      `INSERT INTO resilience_scores (user_id, eri, cps, nsb, cohesion, wri, burnout_risk)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
      [parsed.data.user_id, scores.eri, scores.cps, scores.nsb, scores.cohesion, scores.wri, scores.burnoutRisk]
    );

    await auditLog(parsed.data.user_id, "score_calculated", "resilience_scores", { wri: scores.wri, burnout_risk: scores.burnoutRisk });

    return res.json({
      success: true,
      scores: { ...scores, id: result.rows[0].id, created_at: result.rows[0].created_at },
    });
  } catch (err: any) {
    console.error("Error calculating score:", err.message);
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
      `SELECT id, eri, cps, nsb, cohesion, wri, burnout_risk, created_at
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
    const wriValues = result.rows.map((r: any) => r.wri).reverse();
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
      `SELECT rs.wri, rs.burnout_risk, rs.eri, rs.cps, rs.nsb, rs.cohesion, rs.created_at
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

    const rows = latestScores.rows;
    const totalEmployees = rows.length;
    const avgWri = totalEmployees > 0 ? rows.reduce((s: number, r: any) => s + parseFloat(r.wri), 0) / totalEmployees : 0;
    const avgBurnoutRisk = totalEmployees > 0 ? rows.reduce((s: number, r: any) => s + parseFloat(r.burnout_risk), 0) / totalEmployees : 0;

    const wriValues = rows.map((r: any) => parseFloat(r.wri));
    const burnoutAnalysis = analyzeBurnout(wriValues);

    const executive = {
      avg_wri: Math.round(avgWri * 100) / 100,
      avg_burnout_risk: Math.round(avgBurnoutRisk * 100) / 100,
      total_employees: totalEmployees,
      burnout_severity: burnoutAnalysis.severity,
      burnout_alert: burnoutAnalysis.alert,
      trend_7d: trend7d.rows,
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

      await auditLog(null, "dashboard_viewed", "companies", { company_id: companyId, view: "manager" });

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

    await auditLog(null, "dashboard_viewed", "companies", { company_id: companyId, view: "executive" });
    return res.json({ view: "executive", ...executive });
  } catch (err: any) {
    console.error("Error fetching dashboard:", err.message);
    return res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

router.get("/enterprise/reset-protocol", (_req, res) => {
  return res.json(runResetProtocol());
});

router.get("/enterprise/audit-log", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  try {
    const result = await query(
      `SELECT id, user_id, action, resource, details, ip_address, created_at
       FROM audit_logs ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return res.json({ logs: result.rows });
  } catch (err: any) {
    console.error("Error fetching audit logs:", err.message);
    return res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

export default router;
