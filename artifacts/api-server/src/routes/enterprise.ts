import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { createHash } from "crypto";
import { query, auditLog } from "../lib/db";
import pool from "../lib/db";
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
  getRevenueSummary,
  getRevenueWaterfall,
  getRevenueJournal,
  runDailyRecognition,
} from "../lib/revenueRecognition";

const router: IRouter = Router();

function requireEnterpriseAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers["x-enterprise-key"] as string;
  const validKey = process.env.ENTERPRISE_API_KEY;
  const masterKey = process.env.ADMIN_MASTER_KEY;
  const ok = (validKey && apiKey === validKey) || (masterKey && apiKey === masterKey);
  if (!ok) {
    res.status(401).json({ error: "Unauthorized: valid x-enterprise-key header required" });
    return;
  }
  next();
}

const SSO_PUBLIC_PATHS = [
  "/enterprise/sso/.well-known/openid-configuration",
  "/enterprise/sso/authorize",
  "/enterprise/sso/callback",
  "/enterprise/sso/token",
  "/enterprise/sso/userinfo",
  "/enterprise/sso/jwks",
  "/enterprise/inquiry",
  "/enterprise/lookup-invite",
  "/enterprise/join",
];

router.use("/enterprise/{*path}", (req: Request, res: Response, next: NextFunction) => {
  const fullPath = (req.originalUrl || req.url).split("?")[0];
  if (SSO_PUBLIC_PATHS.some((p) => fullPath === p || fullPath.endsWith(p))) {
    return next();
  }
  requireEnterpriseAuth(req, res, next);
});

router.post("/enterprise/inquiry", async (req: Request, res: Response) => {
  const schema = z.object({
    contact_name: z.string().min(1).max(200),
    company: z.string().min(1).max(200),
    work_email: z.string().email().max(200),
    team_size: z.string().min(1).max(100),
    tier: z.string().max(50).optional(),
    message: z.string().max(2000).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Please complete all required fields." });
  }
  try {
    const { contact_name, company, work_email, team_size, tier, message } = parsed.data;
    const result = await query(
      `INSERT INTO enterprise_inquiries (contact_name, company, work_email, team_size, tier, message)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, created_at`,
      [contact_name, company, work_email, team_size, tier || null, message || null]
    );
    await auditLog(null, "enterprise_inquiry_received", "enterprise_inquiries", {
      company, work_email, team_size, tier,
    });
    console.log(`[ENTERPRISE LEAD] ${company} (${contact_name} <${work_email}>) — ${team_size} — tier: ${tier || "n/a"}`);
    return res.json({ success: true, id: result.rows[0].id });
  } catch (err: any) {
    console.error("Enterprise inquiry save failed:", err.message);
    return res.status(500).json({ error: "Could not save inquiry. Please email admin@neuroquestllc.info directly." });
  }
});

router.get("/enterprise/lookup-invite", async (req: Request, res: Response) => {
  const code = String(req.query.code || "").trim().toUpperCase();
  if (!code || code.length < 4 || code.length > 12) {
    return res.status(400).json({ valid: false, error: "Invalid code format" });
  }
  try {
    const result = await query(
      `SELECT id, name, pilot_status, pilot_ends_at, primary_color, logo_url
       FROM companies WHERE invite_code = $1`,
      [code]
    );
    if (result.rows.length === 0) {
      return res.json({ valid: false, error: "Code not found" });
    }
    const c = result.rows[0];
    return res.json({
      valid: true,
      company_id: c.id,
      company_name: c.name,
      pilot_status: c.pilot_status,
      pilot_ends_at: c.pilot_ends_at,
      branding: { primary_color: c.primary_color, logo_url: c.logo_url },
    });
  } catch (err: any) {
    console.error("Invite lookup failed:", err.message);
    return res.status(500).json({ valid: false, error: "Lookup failed" });
  }
});

router.post("/enterprise/join", async (req: Request, res: Response) => {
  const schema = z.object({
    invite_code: z.string().min(4).max(12),
    email: z.string().email(),
    name: z.string().min(1).max(200).optional(),
    department: z.string().max(100).optional(),
    idp_subject: z.string().max(255).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Please enter a valid code and email." });
  }
  const code = parsed.data.invite_code.trim().toUpperCase();
  const email = parsed.data.email.trim().toLowerCase();
  try {
    const companyResult = await query(
      `SELECT id, name, pilot_status, pilot_ends_at, seat_count
       FROM companies WHERE invite_code = $1`,
      [code]
    );
    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: "That company code wasn't found. Please check with your admin." });
    }
    const company = companyResult.rows[0];
    if (company.pilot_ends_at && new Date(company.pilot_ends_at) < new Date()) {
      return res.status(403).json({ error: "This pilot has ended. Please contact your admin to renew." });
    }
    const seatCheck = await checkSeatAvailability(company.id);
    if (!seatCheck.allowed) {
      const existing = await query(
        `SELECT id FROM enterprise_users WHERE email = $1 AND company_id = $2`,
        [email, company.id]
      );
      if (existing.rows.length === 0) {
        return res.status(403).json({
          error: `Your company has used all ${seatCheck.seat_count} seats. Please ask your admin to add more.`,
          seats_used: seatCheck.current_employees,
          seats_total: seatCheck.seat_count,
        });
      }
    }
    const result = await query(
      `INSERT INTO enterprise_users (email, company_id, role, department, idp_subject)
       VALUES ($1, $2, 'employee', $3, $4)
       ON CONFLICT (email) DO UPDATE
         SET company_id = EXCLUDED.company_id,
             department = COALESCE(EXCLUDED.department, enterprise_users.department),
             idp_subject = COALESCE(EXCLUDED.idp_subject, enterprise_users.idp_subject),
             last_login = now()
       RETURNING id, company_id, role`,
      [email, company.id, parsed.data.department || null, parsed.data.idp_subject || null]
    );
    await auditLog(result.rows[0].id, "enterprise_user_joined", "enterprise_users", {
      company_id: company.id, company_name: company.name, email,
    });
    return res.json({
      success: true,
      user_id: result.rows[0].id,
      company_id: company.id,
      company_name: company.name,
      role: result.rows[0].role,
    });
  } catch (err: any) {
    console.error("Enterprise join failed:", err.message);
    return res.status(500).json({ error: "Could not join company. Please try again." });
  }
});

router.post("/enterprise/onboard-pilot", async (req: Request, res: Response) => {
  const schema = z.object({
    company_name: z.string().min(1).max(200),
    admin_email: z.string().email(),
    seats: z.number().int().min(1).max(10000).default(50),
    pilot_days: z.number().int().min(1).max(365).default(75),
    industry: z.string().max(100).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { company_name, admin_email, seats, pilot_days, industry } = parsed.data;
  try {
    let inviteCode = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = Array.from({ length: 8 }, () =>
        "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]
      ).join("");
      const exists = await query(
        `SELECT 1 FROM companies WHERE invite_code = $1`, [candidate]
      );
      if (exists.rows.length === 0) { inviteCode = candidate; break; }
    }
    if (!inviteCode) return res.status(500).json({ error: "Could not generate unique invite code" });

    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + pilot_days * 86400000);

    const result = await query(
      `INSERT INTO companies (name, industry, seat_count, seat_cap, invite_code, admin_email,
          pilot_status, pilot_started_at, pilot_ends_at, subscription_status, billing_period_end)
       VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8,'trialing',$8)
       RETURNING id, invite_code, pilot_started_at, pilot_ends_at`,
      [company_name, industry || null, seats, seats, inviteCode, admin_email, startedAt, endsAt]
    );
    const company = result.rows[0];
    await auditLog(null, "pilot_company_onboarded", "companies", {
      company_id: company.id, company_name, admin_email, seats, pilot_days, invite_code: inviteCode,
    });
    return res.json({
      success: true,
      company_id: company.id,
      company_name,
      admin_email,
      invite_code: inviteCode,
      seats,
      pilot_started_at: company.pilot_started_at,
      pilot_ends_at: company.pilot_ends_at,
    });
  } catch (err: any) {
    console.error("Pilot onboarding failed:", err.message);
    return res.status(500).json({ error: "Failed to onboard pilot company" });
  }
});

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

router.get("/enterprise/team-heatmap/:companyId", async (req, res) => {
  const companyId = req.params.companyId;
  if (!z.string().uuid().safeParse(companyId).success) {
    return res.status(400).json({ error: "Invalid company ID" });
  }

  try {
    const departmentScores = await query(
      `SELECT
         COALESCE(u.department, 'Unassigned') as department,
         COUNT(DISTINCT u.id) as employee_count,
         ROUND(AVG(w.neuro_resilience_score)::numeric, 1) as avg_resilience_score,
         ROUND(MIN(w.neuro_resilience_score)::numeric, 1) as min_score,
         ROUND(MAX(w.neuro_resilience_score)::numeric, 1) as max_score,
         ROUND(STDDEV(w.neuro_resilience_score)::numeric, 1) as score_stddev,
         ROUND(AVG(w.hrv)::numeric, 1) as avg_hrv,
         ROUND(AVG(w.sleep_duration_minutes)::numeric, 0) as avg_sleep_minutes,
         ROUND(AVG(w.steps)::numeric, 0) as avg_steps,
         COUNT(*) FILTER (WHERE w.neuro_resilience_score < 40) as critical_count,
         COUNT(*) FILTER (WHERE w.neuro_resilience_score >= 40 AND w.neuro_resilience_score < 55) as low_count,
         COUNT(*) FILTER (WHERE w.neuro_resilience_score >= 55 AND w.neuro_resilience_score < 70) as moderate_count,
         COUNT(*) FILTER (WHERE w.neuro_resilience_score >= 70 AND w.neuro_resilience_score < 85) as good_count,
         COUNT(*) FILTER (WHERE w.neuro_resilience_score >= 85) as excellent_count
       FROM enterprise_users u
       JOIN LATERAL (
         SELECT neuro_resilience_score, hrv, sleep_duration_minutes, steps
         FROM wearable_data wd
         WHERE wd.user_id = u.id
         ORDER BY wd.recorded_at DESC
         LIMIT 1
       ) w ON TRUE
       WHERE u.company_id = $1
       GROUP BY COALESCE(u.department, 'Unassigned')
       ORDER BY avg_resilience_score ASC`,
      [companyId]
    );

    const trendData = await query(
      `SELECT
         COALESCE(u.department, 'Unassigned') as department,
         DATE(w.recorded_at) as date,
         ROUND(AVG(w.neuro_resilience_score)::numeric, 1) as avg_score
       FROM enterprise_users u
       JOIN wearable_data w ON w.user_id = u.id
       WHERE u.company_id = $1
         AND w.recorded_at >= NOW() - INTERVAL '14 days'
       GROUP BY COALESCE(u.department, 'Unassigned'), DATE(w.recorded_at)
       ORDER BY department, date`,
      [companyId]
    );

    const trendByDept: Record<string, Array<{ date: string; avg_score: number }>> = {};
    for (const row of trendData.rows) {
      const dept = row.department;
      if (!trendByDept[dept]) trendByDept[dept] = [];
      trendByDept[dept].push({ date: row.date, avg_score: parseFloat(row.avg_score) });
    }

    const companyWide = await query(
      `SELECT
         COUNT(DISTINCT u.id) as total_employees,
         ROUND(AVG(w.neuro_resilience_score)::numeric, 1) as company_avg_score,
         COUNT(*) FILTER (WHERE w.neuro_resilience_score < 40) as company_critical,
         COUNT(*) FILTER (WHERE w.neuro_resilience_score < 55) as company_at_risk
       FROM enterprise_users u
       JOIN LATERAL (
         SELECT neuro_resilience_score
         FROM wearable_data wd
         WHERE wd.user_id = u.id
         ORDER BY wd.recorded_at DESC
         LIMIT 1
       ) w ON TRUE
       WHERE u.company_id = $1`,
      [companyId]
    );

    const summary = companyWide.rows[0] || { total_employees: 0, company_avg_score: 0, company_critical: 0, company_at_risk: 0 };

    const departments = departmentScores.rows.map((dept: any) => {
      const score = parseFloat(dept.avg_resilience_score);
      let riskLevel: string;
      let color: string;
      if (score < 40) { riskLevel = "critical"; color = "#DC2626"; }
      else if (score < 55) { riskLevel = "high"; color = "#EA580C"; }
      else if (score < 70) { riskLevel = "moderate"; color = "#D97706"; }
      else if (score < 85) { riskLevel = "good"; color = "#16A34A"; }
      else { riskLevel = "excellent"; color = "#059669"; }

      return {
        department: dept.department,
        employee_count: parseInt(dept.employee_count),
        avg_resilience_score: score,
        min_score: parseFloat(dept.min_score),
        max_score: parseFloat(dept.max_score),
        score_spread: parseFloat(dept.score_stddev) || 0,
        risk_level: riskLevel,
        heatmap_color: color,
        distribution: {
          critical: parseInt(dept.critical_count),
          low: parseInt(dept.low_count),
          moderate: parseInt(dept.moderate_count),
          good: parseInt(dept.good_count),
          excellent: parseInt(dept.excellent_count),
        },
        biometric_averages: {
          hrv_ms: parseFloat(dept.avg_hrv) || 0,
          sleep_minutes: parseInt(dept.avg_sleep_minutes) || 0,
          steps: parseInt(dept.avg_steps) || 0,
        },
        trend_14d: trendByDept[dept.department] || [],
      };
    });

    const alertDepts = departments.filter((d: any) => d.risk_level === "critical" || d.risk_level === "high");

    await auditLog(null, "team_heatmap_viewed", "companies", {
      company_id: companyId,
      departments_count: departments.length,
      alert_departments: alertDepts.length,
    });

    return res.json({
      company_id: companyId,
      generated_at: new Date().toISOString(),
      scoring_weights: { hrv: 0.50, sleep: 0.35, activity: 0.15 },
      privacy_note: "All scores are anonymized and aggregated at department level. No individual employee data is exposed.",
      company_summary: {
        total_employees: parseInt(summary.total_employees),
        company_avg_score: parseFloat(summary.company_avg_score) || 0,
        employees_critical: parseInt(summary.company_critical),
        employees_at_risk: parseInt(summary.company_at_risk),
      },
      departments,
      alerts: alertDepts.map((d: any) => ({
        department: d.department,
        risk_level: d.risk_level,
        avg_score: d.avg_resilience_score,
        employee_count: d.employee_count,
        recommendation: d.risk_level === "critical"
          ? `${d.department} is in critical burnout territory (avg score ${d.avg_resilience_score}). Immediate intervention recommended: reduce workload, mandate recovery days, and consider 1:1 wellness check-ins.`
          : `${d.department} is showing elevated burnout risk (avg score ${d.avg_resilience_score}). Monitor closely and consider preemptive wellness programming.`,
      })),
    });
  } catch (err: any) {
    console.error("Error generating team heatmap:", err.message);
    return res.status(500).json({ error: "Failed to generate team heatmap" });
  }
});

router.put("/enterprise/users/:userId/department", async (req, res) => {
  const userId = req.params.userId;
  if (!z.string().uuid().safeParse(userId).success) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  const schema = z.object({ department: z.string().min(1).max(100) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const result = await query(
      `UPDATE enterprise_users SET department = $1 WHERE id = $2 RETURNING id, email, department`,
      [parsed.data.department, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    await auditLog(userId, "department_assigned", "enterprise_users", { department: parsed.data.department });
    return res.json({ success: true, user: result.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to update department" });
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

router.get("/enterprise/companies", async (_req, res) => {
  try {
    const r = await query(
      `SELECT c.id, c.name, c.industry, c.invite_code, c.admin_email,
              c.pilot_status, c.pilot_started_at, c.pilot_ends_at,
              c.subscription_status, c.seat_count, c.suspended_at,
              (SELECT COUNT(*)::int FROM enterprise_users WHERE company_id = c.id) as seats_used,
              CASE WHEN c.pilot_ends_at IS NOT NULL
                THEN GREATEST(0, EXTRACT(DAY FROM (c.pilot_ends_at - NOW()))::int)
                ELSE NULL END as days_remaining
       FROM companies c
       ORDER BY c.created_at DESC`,
    );
    return res.json({ companies: r.rows, total: r.rows.length });
  } catch (err: any) {
    console.error("companies list error:", err.message);
    return res.status(500).json({ error: "Failed to load companies" });
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
    const summary = await getRevenueSummary();
    await auditLog(null, "revenue_summary_viewed", "revenue_recognition");
    return res.json({
      ...summary,
      currency: "usd",
      current_period: {
        ...summary.current_period,
        total_contract_value_display: (summary.current_period.total_contract_value / 100).toFixed(2),
        recognized_display: (summary.current_period.recognized / 100).toFixed(2),
        deferred_display: (summary.current_period.deferred / 100).toFixed(2),
      },
      mtd: {
        ...summary.mtd,
        recognized_display: (summary.mtd.recognized / 100).toFixed(2),
      },
      ytd: {
        ...summary.ytd,
        recognized_display: (summary.ytd.recognized / 100).toFixed(2),
      },
      lifetime: {
        ...summary.lifetime,
        recognized_display: (summary.lifetime.recognized / 100).toFixed(2),
        billed_display: (summary.lifetime.billed / 100).toFixed(2),
        refunded_display: (summary.lifetime.refunded / 100).toFixed(2),
      },
      total_recognized: summary.current_period.recognized / 100,
      total_deferred: summary.current_period.deferred / 100,
      total_contract_value: summary.current_period.total_contract_value / 100,
      percent_recognized: summary.current_period.percent_recognized,
      active_companies: summary.companies.length,
      companies: summary.companies.map((c) => ({
        ...c,
        total_amount_display: (c.total_amount / 100).toFixed(2),
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

router.get("/enterprise/revenue/waterfall", async (req, res) => {
  try {
    const months = Math.min(parseInt(req.query.months as string) || 12, 24);
    const waterfall = await getRevenueWaterfall(months);
    await auditLog(null, "revenue_waterfall_viewed", "revenue_recognition");
    return res.json({
      months: waterfall.map((m) => ({
        ...m,
        recognized_display: (m.recognized / 100).toFixed(2),
        billed_display: (m.billed / 100).toFixed(2),
        refunded_display: (m.refunded / 100).toFixed(2),
        net_display: (m.net / 100).toFixed(2),
      })),
    });
  } catch (err: any) {
    console.error("Revenue waterfall error:", err.message);
    return res.status(500).json({ error: "Failed to fetch revenue waterfall" });
  }
});

router.get("/enterprise/revenue/journal", async (req, res) => {
  try {
    const companyId = req.query.company_id as string | undefined;
    const entryType = req.query.entry_type as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
    const format = req.query.format as string | undefined;

    if (companyId && !z.string().uuid().safeParse(companyId).success) {
      return res.status(400).json({ error: "Invalid company ID" });
    }

    const result = await getRevenueJournal({ companyId, entryType, limit, offset });
    await auditLog(null, "revenue_journal_viewed", "revenue_journal");

    if (format === "csv") {
      const csvHeader = "date,company,type,amount_cents,amount_usd,description,subscription_id,seats,invoice_id,schedule_id\n";
      const csvRows = result.entries.map((e: any) =>
        [
          e.entry_date, e.company_name || e.company_id, e.entry_type,
          e.amount, (e.amount / 100).toFixed(2), (e.description || "").replace(/"/g, '""'),
          e.subscription_id || "", e.seat_count || "", e.invoice_id || "",
          e.schedule_id || "",
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

router.post("/enterprise/revenue/run-recognition", async (_req, res) => {
  try {
    const result = await runDailyRecognition();
    await auditLog(null, "revenue_recognition_manual_run", "revenue_recognition", result);
    return res.json({
      success: true,
      ...result,
      total_recognized_display: (result.total_recognized_today / 100).toFixed(2),
    });
  } catch (err: any) {
    console.error("Revenue recognition run error:", err.message);
    return res.status(500).json({ error: "Failed to run revenue recognition" });
  }
});

import {
  wearableDataSchema,
  ingestWearableData,
  getWearableHistory,
  getWearableTrend,
  computeNeuroResilienceScore,
} from "../lib/wearableIntegration";

router.post("/enterprise/wearable", async (req, res) => {
  const parsed = wearableDataSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const result = await ingestWearableData(parsed.data);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error("Wearable ingest error:", err.message);
    return res.status(500).json({ error: "Failed to ingest wearable data" });
  }
});

router.get("/enterprise/wearable/:userId", async (req, res) => {
  const userId = req.params.userId;
  if (!z.string().uuid().safeParse(userId).success) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  try {
    const limitParam = Math.min(Math.max(parseInt(req.query.limit as string) || 30, 1), 200);
    const history = await getWearableHistory(userId, limitParam);
    return res.json({ user_id: userId, data: history });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch wearable data" });
  }
});

router.get("/enterprise/wearable/:userId/trend", async (req, res) => {
  const userId = req.params.userId;
  if (!z.string().uuid().safeParse(userId).success) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  try {
    const daysParam = Math.min(Math.max(parseInt(req.query.days as string) || 7, 1), 90);
    const trend = await getWearableTrend(userId, daysParam);
    return res.json({ user_id: userId, ...trend });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch wearable trend" });
  }
});

/**
 * Mobile-friendly wearable sync.
 * Identifies the user by work email (cached on device after first save),
 * resolves their enterprise_users.id, and ingests via the standard pipeline.
 * Mounted at /api/wearable/sync.
 */
router.post("/wearable/sync", async (req, res) => {
  const schema = z.object({
    email: z.string().email().max(255),
    invite_code: z.string().min(4).max(32),
    source: z.enum(["apple_health", "health_connect", "google_fit", "fitbit", "garmin", "whoop", "oura", "manual"]).default("apple_health"),
    hrv: z.number().min(0).max(300).nullable().optional(),
    sleep_duration: z.number().min(0).max(1440).nullable().optional(),
    steps: z.number().int().min(0).max(200000).nullable().optional(),
    recorded_at: z.string().datetime().optional(),
  }).refine(
    (d) => d.hrv != null || d.sleep_duration != null || d.steps != null,
    { message: "Provide at least one of hrv, sleep_duration, or steps" }
  );

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const email = parsed.data.email.toLowerCase();
  const inviteCode = parsed.data.invite_code.toUpperCase();

  try {
    const lookup = await query(
      `SELECT eu.id AS user_id,
              c.id AS company_id,
              c.pilot_status,
              c.subscription_status,
              c.suspended_at,
              c.pilot_ends_at,
              c.invite_code
         FROM enterprise_users eu
         JOIN companies c ON c.id = eu.company_id
        WHERE LOWER(eu.email) = $1
          AND UPPER(c.invite_code) = $2
        LIMIT 1`,
      [email, inviteCode]
    );

    if (lookup.rows.length === 0) {
      return res.status(404).json({
        error: "Email and invite code don't match a NeuroQuest pilot member. Double-check your work email and the code your admin shared.",
      });
    }

    const u = lookup.rows[0];
    if (u.suspended_at) {
      return res.status(403).json({ error: "Your company's account is currently suspended." });
    }
    const pilotActive =
      u.pilot_status === "active" && u.pilot_ends_at && new Date(u.pilot_ends_at) > new Date();
    const subActive = u.subscription_status === "trialing" || u.subscription_status === "active";
    if (!pilotActive && !subActive) {
      return res.status(403).json({ error: "Your company's pilot or subscription is not active." });
    }

    const result = await ingestWearableData({
      user_id: u.user_id,
      hrv: parsed.data.hrv ?? null,
      sleep_duration: parsed.data.sleep_duration ?? null,
      steps: parsed.data.steps ?? null,
      source: parsed.data.source,
      recorded_at: parsed.data.recorded_at,
    });

    return res.json({
      success: true,
      neuro_resilience_score: result.neuro_resilience.neuro_resilience_score,
      classification: result.neuro_resilience.classification,
      imputed_metrics: result.imputed_metrics,
    });
  } catch (err: any) {
    console.error("Mobile wearable sync error:", err.message);
    return res.status(500).json({ error: "Failed to sync wearable data" });
  }
});

router.post("/enterprise/wearable/score", async (req, res) => {
  const schema = z.object({
    hrv: z.number().min(0).max(300).nullable().optional(),
    sleep_duration: z.number().min(0).max(1440).nullable().optional(),
    steps: z.number().int().min(0).max(200000).nullable().optional(),
  }).refine(
    (data) => data.hrv != null || data.sleep_duration != null || data.steps != null,
    { message: "At least one metric (hrv, sleep_duration, or steps) must be provided" }
  );
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const result = computeNeuroResilienceScore(parsed.data.hrv, parsed.data.sleep_duration, parsed.data.steps);
  return res.json(result);
});

router.post("/account/delete", async (req: Request, res: Response) => {
  const schema = z.object({
    email: z.string().email(),
    invite_code: z.string().min(4).max(12),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Email and invite code are required to delete your account." });
  }
  const code = parsed.data.invite_code.trim().toUpperCase();
  const email = parsed.data.email.trim().toLowerCase();

  const generic404 = "The email and invite code combination doesn't match any account on file.";
  const client = await pool.connect();
  try {
    const companyResult = await client.query(
      `SELECT id FROM companies WHERE invite_code = $1`,
      [code]
    );
    if (companyResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: generic404 });
    }
    const companyId = companyResult.rows[0].id;

    const userResult = await client.query(
      `SELECT id FROM enterprise_users WHERE email = $1 AND company_id = $2`,
      [email, companyId]
    );
    if (userResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: generic404 });
    }
    const userId = userResult.rows[0].id;
    const emailHash = createHash("sha256").update(email).digest("hex").slice(0, 16);

    await client.query("BEGIN");

    const userScopedTables = [
      "iap_transactions",
      "iap_entitlements",
      "resilience_scores",
      "biometrics",
      "behaviors",
      "user_baselines",
      "user_spin_balance",
      "wearable_data",
      "sso_sessions",
    ];
    const deleted: Record<string, number> = {};
    const failures: string[] = [];
    for (const table of userScopedTables) {
      try {
        const r = await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
        deleted[table] = r.rowCount || 0;
      } catch (e: any) {
        failures.push(`${table}: ${e.message}`);
      }
    }
    if (failures.length > 0) {
      throw new Error(`Required user-data deletes failed: ${failures.join("; ")}`);
    }

    await client.query(`DELETE FROM audit_logs WHERE user_id = $1`, [userId]);

    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource, details, created_at)
       VALUES (NULL, 'account_deleted', 'enterprise_users', $1::jsonb, now())`,
      [JSON.stringify({ email_hash: emailHash, company_id: companyId, deleted_counts: deleted })]
    );

    const userDel = await client.query(`DELETE FROM enterprise_users WHERE id = $1`, [userId]);
    deleted.enterprise_users = userDel.rowCount || 0;

    const usersDel = await client.query(`DELETE FROM users WHERE email = $1`, [email]);
    deleted.users = usersDel.rowCount || 0;

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Your account and all associated health and activity data have been permanently deleted from our servers.",
      records_removed: deleted,
    });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Account deletion failed:", err.message);
    return res.status(500).json({ error: "Could not delete account. Please contact admin@neuroquestllc.info." });
  } finally {
    client.release();
  }
});

export default router;
