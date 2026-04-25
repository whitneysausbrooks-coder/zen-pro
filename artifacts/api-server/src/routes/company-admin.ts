import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "crypto";
import { query, auditLog, withTransaction } from "../lib/db";
import { checkSeatAvailability } from "../lib/seatEnforcement";

/** Sentinel error so withTransaction rolls back business-rule failures. */
class AddMemberError extends Error {
  status: number;
  extra: Record<string, unknown>;
  constructor(status: number, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.name = "AddMemberError";
    this.status = status;
    this.extra = extra;
  }
}

const router: IRouter = Router();

let warnedShortSecret = false;
function getSecret(): string {
  const secret = process.env.ADMIN_MASTER_KEY || process.env.ENTERPRISE_API_KEY;
  if (!secret) {
    // Fail closed — never sign or verify admin tokens with a known/guessable
    // value. A misconfigured deploy that loses both env vars must NOT silently
    // accept forged tokens.
    throw new Error(
      "Server misconfiguration: ADMIN_MASTER_KEY (or ENTERPRISE_API_KEY) is required for company admin authentication.",
    );
  }
  if (secret.length < 32 && !warnedShortSecret) {
    warnedShortSecret = true;
    console.warn(
      `[security] admin secret is only ${secret.length} chars — recommend rotating to a 32+ char value.`,
    );
  }
  return secret;
}

function signCompanyToken(companyId: string, email: string): string {
  const payload = `${companyId}:${email.toLowerCase()}:${Date.now()}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

function verifyCompanyToken(token: string): { companyId: string; email: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 4) return null;
    const [companyId, email, ts, sig] = parts;
    const payload = `${companyId}:${email}:${ts}`;
    const expected = createHmac("sha256", getSecret()).update(payload).digest("hex");
    const sigBuf = Buffer.from(sig, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expBuf)) return null;
    if (Date.now() - parseInt(ts) > 30 * 86400 * 1000) return null;
    return { companyId, email };
  } catch {
    return null;
  }
}

function requireCompanyAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["x-company-admin-token"] as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Missing admin token. Please log in." });
    return;
  }
  const decoded = verifyCompanyToken(token);
  if (!decoded) {
    res.status(401).json({ error: "Your session expired. Please log in again." });
    return;
  }
  (req as Request & { companyId?: string; adminEmail?: string }).companyId = decoded.companyId;
  (req as Request & { companyId?: string; adminEmail?: string }).adminEmail = decoded.email;
  next();
}

const loginSchema = z.object({
  admin_email: z.string().email(),
  invite_code: z.string().min(4).max(16),
});

router.post("/company-admin/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Please enter a valid email and company code." });
  }
  const { admin_email, invite_code } = parsed.data;
  try {
    const result = await query(
      `SELECT id, name, admin_email, pilot_status, suspended_at
       FROM companies WHERE invite_code = $1 LIMIT 1`,
      [invite_code.toUpperCase()],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "We couldn't find a company with that code." });
    }
    const company = result.rows[0];
    if (company.suspended_at) {
      return res.status(403).json({ error: "This account is suspended. Please contact support." });
    }
    if (!company.admin_email || company.admin_email.toLowerCase() !== admin_email.toLowerCase()) {
      await auditLog(null, "company_admin_login_failed", "companies", {
        company_id: company.id, attempted_email: admin_email,
      });
      return res.status(403).json({ error: "That email isn't authorized for this company." });
    }
    const token = signCompanyToken(company.id, admin_email);
    await auditLog(null, "company_admin_login", "companies", {
      company_id: company.id, admin_email,
    });
    return res.json({
      token,
      company_id: company.id,
      company_name: company.name,
      pilot_status: company.pilot_status,
    });
  } catch (err: any) {
    console.error("company-admin login error:", err.message);
    return res.status(500).json({ error: "Login failed. Please try again." });
  }
});

router.get("/company-admin/me", requireCompanyAdmin, async (req, res) => {
  const companyId = (req as Request & { companyId?: string }).companyId!;
  try {
    const r = await query(
      `SELECT id, name, industry, seat_count, seat_cap, invite_code, admin_email,
              pilot_status, pilot_started_at, pilot_ends_at, subscription_status,
              primary_color, logo_url
       FROM companies WHERE id = $1`,
      [companyId],
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Company not found" });
    const c = r.rows[0];
    const seatCount = await query(
      `SELECT COUNT(*)::int as count FROM enterprise_users WHERE company_id = $1`,
      [companyId],
    );
    const seatsUsed = seatCount.rows[0].count;
    const daysRemaining = c.pilot_ends_at
      ? Math.max(0, Math.ceil((new Date(c.pilot_ends_at).getTime() - Date.now()) / 86400000))
      : null;
    return res.json({
      company_id: c.id,
      company_name: c.name,
      industry: c.industry,
      invite_code: c.invite_code,
      admin_email: c.admin_email,
      seats_used: seatsUsed,
      seats_total: c.seat_count,
      seat_cap: c.seat_cap,
      pilot_status: c.pilot_status,
      pilot_started_at: c.pilot_started_at,
      pilot_ends_at: c.pilot_ends_at,
      pilot_days_remaining: daysRemaining,
      subscription_status: c.subscription_status,
      branding: { primary_color: c.primary_color, logo_url: c.logo_url },
      join_url: `${process.env.PUBLIC_BASE_URL || "https://neuroquestzen.pro"}/join`,
    });
  } catch (err: any) {
    console.error("company-admin me error:", err.message);
    return res.status(500).json({ error: "Failed to load company info" });
  }
});

router.get("/company-admin/team", requireCompanyAdmin, async (req, res) => {
  const companyId = (req as Request & { companyId?: string }).companyId!;
  try {
    const r = await query(
      `SELECT id, email, COALESCE(department, '—') as department, role,
              created_at as joined_at, last_login,
              (SELECT COUNT(*)::int FROM behaviors WHERE user_id = u.id) as activity_count,
              (SELECT MAX(created_at) FROM behaviors WHERE user_id = u.id) as last_activity
       FROM enterprise_users u
       WHERE company_id = $1
       ORDER BY created_at DESC`,
      [companyId],
    );
    return res.json({ team: r.rows, total: r.rows.length });
  } catch (err: any) {
    console.error("company-admin team error:", err.message);
    return res.status(500).json({ error: "Failed to load team roster" });
  }
});

router.get("/company-admin/wellness-summary", requireCompanyAdmin, async (req, res) => {
  const companyId = (req as Request & { companyId?: string }).companyId!;
  try {
    const employeeCount = await query(
      `SELECT COUNT(*)::int as count FROM enterprise_users WHERE company_id = $1`,
      [companyId],
    );
    const totalEmployees = employeeCount.rows[0].count;

    if (totalEmployees < 5) {
      return res.json({
        privacy_threshold_met: false,
        threshold: 5,
        total_employees: totalEmployees,
        message: `Aggregate wellness data appears once 5 or more employees have joined and been active. Currently: ${totalEmployees}.`,
      });
    }

    const agg = await query(
      `SELECT
         AVG(b.mood_score)::numeric(4,2) as avg_mood,
         AVG(b.engagement_score)::numeric(5,2) as avg_engagement,
         COUNT(DISTINCT b.user_id)::int as active_users,
         COUNT(*)::int as total_checkins
       FROM behaviors b
       JOIN enterprise_users u ON u.id = b.user_id
       WHERE u.company_id = $1
         AND b.created_at >= NOW() - INTERVAL '30 days'`,
      [companyId],
    );
    const a = agg.rows[0];

    const trendQ = await query(
      `SELECT
         DATE_TRUNC('day', b.created_at)::date as day,
         AVG(b.mood_score)::numeric(4,2) as avg_mood,
         AVG(b.engagement_score)::numeric(5,2) as avg_engagement,
         COUNT(*)::int as checkins
       FROM behaviors b
       JOIN enterprise_users u ON u.id = b.user_id
       WHERE u.company_id = $1 AND b.created_at >= NOW() - INTERVAL '14 days'
       GROUP BY day
       ORDER BY day`,
      [companyId],
    );

    return res.json({
      privacy_threshold_met: true,
      total_employees: totalEmployees,
      active_users_30d: a.active_users || 0,
      total_checkins_30d: a.total_checkins || 0,
      avg_mood_30d: a.avg_mood ? parseFloat(a.avg_mood) : null,
      avg_engagement_30d: a.avg_engagement ? parseFloat(a.avg_engagement) : null,
      participation_rate: totalEmployees > 0 ? Math.round(((a.active_users || 0) / totalEmployees) * 100) : 0,
      trend_14d: trendQ.rows,
    });
  } catch (err: any) {
    console.error("company-admin wellness error:", err.message);
    return res.status(500).json({ error: "Failed to load wellness summary" });
  }
});

/**
 * Wearable engagement summary for the HR admin dashboard.
 * Operational metrics (connected count, connection rate, sources, last sync)
 * are always returned. Personal-health aggregates (avg score, avg HRV/sleep/steps,
 * trend) are gated behind a 5-connected-employee privacy threshold so no
 * individual can be inferred from a small sample.
 */
router.get("/company-admin/wearable-engagement", requireCompanyAdmin, async (req, res) => {
  const companyId = (req as Request & { companyId?: string }).companyId!;
  try {
    const employeeCountQ = await query(
      `SELECT COUNT(*)::int AS count FROM enterprise_users WHERE company_id = $1`,
      [companyId],
    );
    const totalEmployees: number = employeeCountQ.rows[0].count;

    const PRIVACY_THRESHOLD = 5;

    // Headcount-only summary — safe to return at any cohort size
    // because connected_30d is just a count, not behavior.
    const headcountQ = await query(
      `SELECT COUNT(DISTINCT wd.user_id)::int AS connected_30d,
              COUNT(DISTINCT wd.user_id)
                FILTER (WHERE wd.recorded_at >= NOW() - INTERVAL '7 days')::int AS active_7d
         FROM wearable_data wd
         JOIN enterprise_users eu ON eu.id = wd.user_id
        WHERE eu.company_id = $1
          AND wd.recorded_at >= NOW() - INTERVAL '30 days'`,
      [companyId],
    );
    const h = headcountQ.rows[0];
    const connected: number = h.connected_30d || 0;
    const active7d: number = h.active_7d || 0;

    const connectionRate =
      totalEmployees > 0 ? Math.round((connected / totalEmployees) * 100) : 0;

    // Always-safe headcount metrics (no behavioral data).
    const baseSafe = {
      total_employees: totalEmployees,
      connected_30d: connected,
      connection_rate: connectionRate,
      privacy_threshold: PRIVACY_THRESHOLD,
    };

    // BELOW THRESHOLD: suppress all behavior signals (source breakdown,
    // sync timing, totals, active-7d) because in a tiny cohort they can
    // re-identify a specific employee (e.g., "1 connected, Garmin, 2 min ago"
    // = the person we know wears a Garmin watch).
    if (connected < PRIVACY_THRESHOLD) {
      return res.json({
        ...baseSafe,
        privacy_threshold_met: false,
        message:
          connected === 0
            ? "No employees have connected a wearable yet. Share the Wearable Setup Handout with your team to get started."
            : `Detailed engagement and personal-health aggregates appear once ${PRIVACY_THRESHOLD} or more employees have connected. Currently: ${connected}.`,
      });
    }

    // ABOVE THRESHOLD: also enforce that the 7-day active cohort is large
    // enough before exposing behavior aggregates computed from that window.
    const sevenDayCohortMet = active7d >= PRIVACY_THRESHOLD;

    // Behavioral operational metrics — only safe at threshold.
    const opsQ = await query(
      `SELECT COUNT(DISTINCT wd.user_id)
                FILTER (WHERE wd.recorded_at >= NOW() - INTERVAL '24 hours')::int AS synced_24h,
              MAX(wd.recorded_at) AS last_sync_at,
              COUNT(*)::int AS total_syncs_30d
         FROM wearable_data wd
         JOIN enterprise_users eu ON eu.id = wd.user_id
        WHERE eu.company_id = $1
          AND wd.recorded_at >= NOW() - INTERVAL '30 days'`,
      [companyId],
    );
    const ops = opsQ.rows[0];

    const sourcesQ = await query(
      `SELECT wd.source, COUNT(DISTINCT wd.user_id)::int AS users
         FROM wearable_data wd
         JOIN enterprise_users eu ON eu.id = wd.user_id
        WHERE eu.company_id = $1
          AND wd.recorded_at >= NOW() - INTERVAL '30 days'
        GROUP BY wd.source
        ORDER BY users DESC`,
      [companyId],
    );

    // Coarsen last_sync_at to a relative bucket so we never expose a
    // minute-precision timestamp that could be tied to one person's habits.
    function coarsenSync(iso: string | null): string | null {
      if (!iso) return null;
      const diffH = (Date.now() - new Date(iso).getTime()) / 3_600_000;
      if (diffH < 6) return "within last 6 hours";
      if (diffH < 24) return "within last 24 hours";
      if (diffH < 24 * 7) return "within last 7 days";
      return "more than 7 days ago";
    }

    const operational = {
      ...baseSafe,
      synced_24h: ops.synced_24h || 0,
      active_7d: active7d,
      last_sync_bucket: coarsenSync(ops.last_sync_at),
      total_syncs_30d: ops.total_syncs_30d || 0,
      sources: sourcesQ.rows.map((r) => ({ source: r.source, users: r.users })),
    };

    // Personal-health aggregates require BOTH 30-day connected ≥ 5 AND
    // 7-day active ≥ 5 (because the aggregates are computed from 7-day data).
    if (!sevenDayCohortMet) {
      return res.json({
        ...operational,
        privacy_threshold_met: false,
        message: `Personal-health aggregates appear once ${PRIVACY_THRESHOLD} or more employees have synced in the last 7 days. Currently: ${active7d}.`,
      });
    }

    // Per-metric k-anonymity: SQL AVG() ignores nulls, so we must enforce the
    // threshold on the COUNT of non-null contributing values for EACH metric
    // independently — otherwise a field with only 1–4 reporters would leak.
    const aggQ = await query(
      `WITH company_users AS (
         SELECT id FROM enterprise_users WHERE company_id = $1
       ),
       per_user_latest AS (
         SELECT DISTINCT ON (wd.user_id)
                wd.user_id,
                wd.neuro_resilience_score,
                wd.hrv,
                wd.sleep_duration_minutes,
                wd.steps
           FROM wearable_data wd
           JOIN company_users e ON e.id = wd.user_id
          WHERE wd.recorded_at >= NOW() - INTERVAL '7 days'
          ORDER BY wd.user_id, wd.recorded_at DESC
       )
       SELECT
         CASE WHEN COUNT(neuro_resilience_score) >= $2
              THEN AVG(neuro_resilience_score)::numeric(5,1) END AS avg_score,
         CASE WHEN COUNT(hrv) >= $2
              THEN AVG(hrv)::numeric(5,1) END AS avg_hrv,
         CASE WHEN COUNT(sleep_duration_minutes) >= $2
              THEN AVG(sleep_duration_minutes)::numeric(6,1) END AS avg_sleep_minutes,
         CASE WHEN COUNT(steps) >= $2
              THEN AVG(steps)::numeric(8,0) END AS avg_steps
       FROM per_user_latest`,
      [companyId, PRIVACY_THRESHOLD],
    );
    const a = aggQ.rows[0] || {};

    // Per-day k-anonymity: only emit a trend point if that day's distinct
    // user count meets the threshold; otherwise emit count + null score so
    // the UI can render a tick mark without revealing aggregate behavior.
    const trendQ = await query(
      `WITH company_users AS (
         SELECT id FROM enterprise_users WHERE company_id = $1
       ),
       day_user AS (
         SELECT DISTINCT ON (DATE_TRUNC('day', wd.recorded_at), wd.user_id)
                DATE_TRUNC('day', wd.recorded_at)::date AS day,
                wd.user_id,
                wd.neuro_resilience_score AS score
           FROM wearable_data wd
           JOIN company_users e ON e.id = wd.user_id
          WHERE wd.recorded_at >= NOW() - INTERVAL '7 days'
          ORDER BY DATE_TRUNC('day', wd.recorded_at), wd.user_id, wd.recorded_at DESC
       )
       SELECT day,
              COUNT(*)::int AS connected,
              COUNT(score)::int AS scored_count,
              AVG(score)::numeric(5,1) AS avg_score
         FROM day_user
         GROUP BY day
         ORDER BY day`,
      [companyId],
    );

    return res.json({
      ...operational,
      privacy_threshold_met: true,
      avg_resilience_score: a.avg_score != null ? parseFloat(a.avg_score) : null,
      avg_hrv: a.avg_hrv != null ? parseFloat(a.avg_hrv) : null,
      avg_sleep_minutes: a.avg_sleep_minutes != null ? parseFloat(a.avg_sleep_minutes) : null,
      avg_steps: a.avg_steps != null ? Math.round(parseFloat(a.avg_steps)) : null,
      trend_7d: trendQ.rows.map((r) => ({
        day: r.day,
        connected: r.connected,
        // Per-day, per-metric k-anon: gate on the count of NON-NULL scores
        // (not just total user count) to prevent leakage when only a subset
        // of that day's active users reported a resilience score.
        avg_score:
          r.scored_count >= PRIVACY_THRESHOLD && r.avg_score != null
            ? parseFloat(r.avg_score)
            : null,
      })),
    });
  } catch (err: any) {
    console.error("company-admin wearable-engagement error:", err.message);
    return res.status(500).json({ error: "Failed to load wearable engagement" });
  }
});

/**
 * Add a teammate by email. Idempotent (re-adding the same email is a no-op
 * but reports success so admin UX stays simple). Respects the company's
 * seat cap, and logs the action for auditing.
 */
router.post("/company-admin/team", requireCompanyAdmin, async (req, res) => {
  const companyId = (req as Request & { companyId?: string }).companyId!;
  const adminEmail = (req as Request & { adminEmail?: string }).adminEmail!;
  const schema = z.object({
    email: z.string().email().max(255),
    department: z.string().max(100).optional(),
    role: z.enum(["employee", "manager"]).default("employee"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  const email = parsed.data.email.trim().toLowerCase();
  try {
    // Belongs to another company? (read outside the txn — purely informational)
    const other = await query(
      `SELECT eu.id, c.name AS company_name
         FROM enterprise_users eu
         JOIN companies c ON c.id = eu.company_id
        WHERE eu.email = $1 AND eu.company_id <> $2 LIMIT 1`,
      [email, companyId],
    );
    if (other.rows.length > 0) {
      return res.status(409).json({
        error: `${email} is already a member of ${other.rows[0].company_name}. Ask them to leave that company first.`,
      });
    }

    // Atomic seat-cap enforcement: take a row lock on the company row so
    // two concurrent admins can't each pass the seat check and overflow
    // the cap (TOCTOU). Re-check after lock, then insert in the same txn.
    // Business-rule failures THROW so withTransaction rolls the txn back;
    // they're caught below and translated into HTTP responses.
    type AddResult =
      | { kind: "ok"; user_id: string }
      | { kind: "already"; user_id: string };
    const result: AddResult = await withTransaction(async (client) => {
      const companyRow = await client.query(
        `SELECT subscription_status, seat_count, seat_cap, suspended_at
           FROM companies
          WHERE id = $1
          FOR UPDATE`,
        [companyId],
      );
      if (companyRow.rows.length === 0) {
        throw new AddMemberError(404, "Company not found.");
      }
      const company = companyRow.rows[0];
      if (company.suspended_at) {
        throw new AddMemberError(
          403,
          "Account suspended due to payment failure. Please update billing.",
        );
      }
      if (
        company.subscription_status !== "active" &&
        company.subscription_status !== "trialing"
      ) {
        throw new AddMemberError(
          403,
          "No active subscription. Please subscribe to add team members.",
        );
      }

      // Idempotent: if the email is already on this company, succeed.
      const existing = await client.query(
        `SELECT id FROM enterprise_users WHERE email = $1 AND company_id = $2`,
        [email, companyId],
      );
      if (existing.rows.length > 0) {
        return { kind: "already", user_id: existing.rows[0].id };
      }

      const countRow = await client.query(
        `SELECT COUNT(*)::int AS count FROM enterprise_users WHERE company_id = $1`,
        [companyId],
      );
      const currentEmployees = countRow.rows[0].count as number;
      const seatLimit = Math.min(company.seat_count || 0, company.seat_cap || 10000);
      if (currentEmployees >= seatLimit) {
        throw new AddMemberError(
          403,
          `You've used all ${seatLimit} seats. Add more seats in billing or remove a member first.`,
          { seats_used: currentEmployees, seats_total: seatLimit },
        );
      }

      const insert = await client.query(
        `INSERT INTO enterprise_users (email, company_id, role, department)
           VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [email, companyId, parsed.data.role, parsed.data.department || null],
      );
      return { kind: "ok", user_id: insert.rows[0].id };
    });

    if (result.kind === "already") {
      return res.json({ success: true, already_member: true, user_id: result.user_id });
    }
    await auditLog(result.user_id, "company_admin_added_employee", "enterprise_users", {
      company_id: companyId, email, added_by: adminEmail,
    });
    return res.json({ success: true, user_id: result.user_id });
  } catch (err: any) {
    if (err instanceof AddMemberError) {
      return res.status(err.status).json({ error: err.message, ...err.extra });
    }
    console.error("company-admin add error:", err.message);
    return res.status(500).json({ error: "Failed to add team member." });
  }
});

router.delete("/company-admin/team/:userId", requireCompanyAdmin, async (req, res) => {
  const companyId = (req as Request & { companyId?: string }).companyId!;
  const adminEmail = (req as Request & { adminEmail?: string }).adminEmail!;
  const { userId } = req.params;
  try {
    const check = await query(
      `SELECT id, email FROM enterprise_users WHERE id = $1 AND company_id = $2`,
      [userId, companyId],
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: "Employee not found in your company." });
    }
    await query(`DELETE FROM enterprise_users WHERE id = $1 AND company_id = $2`, [userId, companyId]);
    await auditLog(null, "company_admin_removed_employee", "enterprise_users", {
      company_id: companyId, removed_email: check.rows[0].email, removed_by: adminEmail,
    });
    return res.json({ success: true });
  } catch (err: any) {
    console.error("company-admin remove error:", err.message);
    return res.status(500).json({ error: "Failed to remove employee" });
  }
});

export default router;
