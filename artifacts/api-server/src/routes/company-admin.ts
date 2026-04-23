import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "crypto";
import { query, auditLog } from "../lib/db";

const router: IRouter = Router();

function getSecret(): string {
  return process.env.ADMIN_MASTER_KEY || process.env.ENTERPRISE_API_KEY || "fallback-dev-only";
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
