import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { query, withTransaction } from "../lib/db";
import {
  compassionConfig,
  currentPeriod,
  buildSettlementLink,
} from "../lib/everyOrg";

const router: IRouter = Router();

/**
 * Record a real, business-funded micro-donation when a player hits a Compassion
 * Milestone in the Play-tab game. Enforces the HARD monthly budget under a row
 * lock so concurrent plays / bots can never overspend the giving budget. When
 * the cap is reached the milestone still celebrates, but no further real money
 * accrues (`capped: true`).
 */
router.post("/donations/compassion-milestone", async (req, res) => {
  try {
    const cfg = compassionConfig();
    const period = currentPeriod();
    const sessionId =
      typeof req.body?.session_id === "string" && req.body.session_id.trim()
        ? String(req.body.session_id).slice(0, 128)
        : null;
    const milestoneKind =
      typeof req.body?.milestone_kind === "string" && req.body.milestone_kind.trim()
        ? String(req.body.milestone_kind).slice(0, 64)
        : "reels_three_match";

    const outcome = await withTransaction(async (client) => {
      // Ensure the period budget row exists, then lock it so the check-and-accrue
      // below is atomic against concurrent milestones.
      await client.query(
        `INSERT INTO compassion_budget (period, budget_cents)
         VALUES ($1, $2)
         ON CONFLICT (period) DO NOTHING`,
        [period, cfg.monthlyBudgetCents]
      );
      const { rows } = await client.query<{ accrued_cents: number }>(
        `SELECT accrued_cents FROM compassion_budget WHERE period = $1 FOR UPDATE`,
        [period]
      );
      const accrued = rows[0]?.accrued_cents ?? 0;
      const budget = cfg.monthlyBudgetCents;

      if (accrued + cfg.milestoneCents > budget) {
        // Keep the stored cap in sync with config even when capped.
        await client.query(
          `UPDATE compassion_budget SET budget_cents = $2, updated_at = now() WHERE period = $1`,
          [period, budget]
        );
        return {
          donated_cents: 0,
          capped: true,
          monthly_total_cents: accrued,
          monthly_budget_cents: budget,
          monthly_remaining_cents: Math.max(0, budget - accrued),
        };
      }

      const newAccrued = accrued + cfg.milestoneCents;
      await client.query(
        `UPDATE compassion_budget
            SET accrued_cents = $2, budget_cents = $3, updated_at = now()
          WHERE period = $1`,
        [period, newAccrued, budget]
      );
      await client.query(
        `INSERT INTO compassion_donations
           (session_id, period, amount_cents, nonprofit_slug, milestone_kind, status)
         VALUES ($1, $2, $3, $4, $5, 'accrued')`,
        [sessionId, period, cfg.milestoneCents, cfg.nonprofitSlug, milestoneKind]
      );
      return {
        donated_cents: cfg.milestoneCents,
        capped: false,
        monthly_total_cents: newAccrued,
        monthly_budget_cents: budget,
        monthly_remaining_cents: Math.max(0, budget - newAccrued),
      };
    });

    return res.json({ ok: true, nonprofit: cfg.nonprofitSlug, ...outcome });
  } catch (err) {
    console.error("Compassion milestone error:", err);
    return res.status(500).json({ error: "Could not record milestone" });
  }
});

/**
 * Public impact summary for the Play tab / impact UI: how much real,
 * business-funded giving the community has driven, plus this month's budget
 * headroom.
 */
router.get("/donations/compassion-impact", async (_req, res) => {
  try {
    const cfg = compassionConfig();
    const period = currentPeriod();
    const [{ rows: monthRows }, { rows: allRows }] = await Promise.all([
      query<{ total: string | null; supporters: string | null }>(
        `SELECT COALESCE(SUM(amount_cents),0) AS total,
                COUNT(DISTINCT session_id) AS supporters
           FROM compassion_donations WHERE period = $1`,
        [period]
      ),
      query<{ all_time: string | null; settled: string | null }>(
        `SELECT COALESCE(SUM(amount_cents),0) AS all_time,
                COALESCE(SUM(amount_cents) FILTER (WHERE status = 'settled'),0) AS settled
           FROM compassion_donations`
      ),
    ]);

    const monthTotal = Number(monthRows[0]?.total ?? 0);
    return res.json({
      nonprofit: cfg.nonprofitSlug,
      this_month_cents: monthTotal,
      monthly_budget_cents: cfg.monthlyBudgetCents,
      monthly_remaining_cents: Math.max(0, cfg.monthlyBudgetCents - monthTotal),
      supporters_this_month: Number(monthRows[0]?.supporters ?? 0),
      all_time_cents: Number(allRows[0]?.all_time ?? 0),
      settled_cents: Number(allRows[0]?.settled ?? 0),
      milestone_cents: cfg.milestoneCents,
    });
  } catch (err) {
    console.error("Compassion impact error:", err);
    return res.status(500).json({ error: "Could not load impact" });
  }
});

/**
 * Admin: settle accrued donations to the nonprofit via every.org. Groups all
 * `accrued` rows into a batch, marks them `settling`, and returns an every.org
 * donate link the business completes for the aggregate amount. every.org's
 * webhook then confirms and flips the batch to `settled`.
 * Guarded by the ADMIN_MASTER_KEY secret (x-admin-key header).
 */
router.post("/admin/donations/settle", async (req, res) => {
  const masterKey = process.env.ADMIN_MASTER_KEY;
  const provided = req.header("x-admin-key");
  if (!masterKey || provided !== masterKey) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const cfg = compassionConfig();
    const batchId = randomUUID();
    // Atomically claim every currently-`accrued` row into this batch and compute
    // the settlement total from the EXACT rows claimed. Doing the claim + sum in
    // one statement (instead of SELECT-then-UPDATE) guarantees the donate-link
    // amount matches the rows assigned to the batch, even if concurrent settle
    // calls or new milestones race in. A row can only be claimed once because the
    // UPDATE filters on `status = 'accrued'`.
    const { rows } = await query<{ amount_cents: number }>(
      `UPDATE compassion_donations
          SET status = 'settling', batch_id = $1
        WHERE status = 'accrued'
        RETURNING amount_cents`,
      [batchId]
    );
    const totalCents = rows.reduce((sum, r) => sum + Number(r.amount_cents ?? 0), 0);
    const count = rows.length;
    if (count === 0 || totalCents <= 0) {
      return res.json({ ok: true, nothing_to_settle: true });
    }
    return res.json({
      ok: true,
      batch_id: batchId,
      amount_cents: totalCents,
      donations_in_batch: count,
      nonprofit: cfg.nonprofitSlug,
      settlement_link: buildSettlementLink(totalCents, batchId),
    });
  } catch (err) {
    console.error("Compassion settle error:", err);
    return res.status(500).json({ error: "Could not settle" });
  }
});

export default router;
