import { query, auditLog, withTransaction } from "./db";
import type pg from "pg";

const PRICE_PER_SEAT_CENTS = 1200;

function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function startOfYear(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
}

export async function createRevenueSchedule(
  companyId: string,
  subscriptionId: string,
  periodStart: Date,
  periodEnd: Date,
  seatCount: number,
  reason: string,
  parentScheduleId?: string
): Promise<string> {
  const totalAmount = seatCount * PRICE_PER_SEAT_CENTS;
  const totalDays = daysBetween(periodStart, periodEnd);
  const dailyRate = Math.round(totalAmount / totalDays);

  const result = await query(
    `INSERT INTO revenue_schedules
       (company_id, subscription_id, period_start, period_end, seat_count,
        total_amount, recognized_to_date, deferred_balance, daily_rate,
        status, modification_reason, parent_schedule_id)
     VALUES ($1, $2, $3, $4, $5, $6, 0, $6, $7, 'active', $8, $9)
     RETURNING id`,
    [companyId, subscriptionId, periodStart, periodEnd, seatCount,
     totalAmount, dailyRate, reason, parentScheduleId || null]
  );

  const scheduleId = result.rows[0].id;

  await auditLog(null, "revenue_schedule_created", "revenue_schedules", {
    schedule_id: scheduleId,
    company_id: companyId,
    subscription_id: subscriptionId,
    period_start: toDateStr(periodStart),
    period_end: toDateStr(periodEnd),
    seat_count: seatCount,
    total_amount: totalAmount,
    daily_rate: dailyRate,
    reason,
  });

  return scheduleId;
}

export async function handleNewSubscription(
  companyId: string,
  subscriptionId: string,
  periodStart: Date,
  periodEnd: Date,
  seatCount: number,
  amountBilled: number
): Promise<void> {
  await createRevenueSchedule(
    companyId, subscriptionId, periodStart, periodEnd, seatCount,
    "new_subscription"
  );

  await recordJournalEntry(companyId, "billing", amountBilled,
    `Invoice billed: ${seatCount} seats × $${(PRICE_PER_SEAT_CENTS / 100).toFixed(2)} = $${(amountBilled / 100).toFixed(2)} (deferred)`,
    { subscription_id: subscriptionId, seat_count: seatCount }
  );
}

export async function handleSeatChangeProspective(
  companyId: string,
  subscriptionId: string,
  newSeatCount: number,
  previousSeatCount: number
): Promise<void> {
  const activeSchedules = await query(
    `SELECT id, period_start, period_end, seat_count, total_amount, recognized_to_date, deferred_balance, daily_rate
     FROM revenue_schedules
     WHERE company_id = $1 AND subscription_id = $2 AND status = 'active'
     ORDER BY created_at DESC LIMIT 1`,
    [companyId, subscriptionId]
  );

  if (activeSchedules.rows.length === 0) return;

  const schedule = activeSchedules.rows[0];
  const now = new Date();
  const periodEnd = new Date(schedule.period_end);

  if (now >= periodEnd) return;

  const remainingDays = daysBetween(now, periodEnd);
  const oldRemainingValue = schedule.daily_rate * remainingDays;
  const newRemainingValue = Math.round((newSeatCount * PRICE_PER_SEAT_CENTS) / daysBetween(new Date(schedule.period_start), periodEnd)) * remainingDays;
  const newDailyRate = Math.round(newRemainingValue / remainingDays);
  const newTotalAmount = schedule.recognized_to_date + newRemainingValue;
  const adjustment = newRemainingValue - oldRemainingValue;

  await withTransaction(async (client: pg.PoolClient) => {
    await client.query(
      `UPDATE revenue_schedules
       SET status = 'superseded', updated_at = NOW(), modification_reason = 'seat_change_superseded'
       WHERE id = $1`,
      [schedule.id]
    );

    await client.query(
      `INSERT INTO revenue_schedules
         (company_id, subscription_id, period_start, period_end, seat_count,
          total_amount, recognized_to_date, deferred_balance, daily_rate,
          status, last_recognized_date, modification_reason, parent_schedule_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10, $11, $12)`,
      [companyId, subscriptionId, now, periodEnd, newSeatCount,
       newTotalAmount, schedule.recognized_to_date, newRemainingValue,
       newDailyRate, schedule.last_recognized_date,
       `seat_change: ${previousSeatCount} → ${newSeatCount}`,
       schedule.id]
    );
  });

  await recordJournalEntry(companyId, "seat_change", adjustment,
    `Seat change: ${previousSeatCount} → ${newSeatCount} (prospective, ${remainingDays}d remaining, rate ${(schedule.daily_rate / 100).toFixed(2)} → ${(newDailyRate / 100).toFixed(2)}/day)`,
    { subscription_id: subscriptionId, seat_count: newSeatCount, previous_seats: previousSeatCount, remaining_days: remainingDays }
  );

  await auditLog(null, "revenue_schedule_modified", "revenue_schedules", {
    company_id: companyId,
    old_schedule_id: schedule.id,
    previous_seats: previousSeatCount,
    new_seats: newSeatCount,
    adjustment_cents: adjustment,
    new_daily_rate: newDailyRate,
    remaining_days: remainingDays,
    treatment: "prospective",
  });
}

export async function handleCancellation(
  companyId: string,
  subscriptionId: string,
  effectiveEndDate?: Date
): Promise<void> {
  const schedules = await query(
    `SELECT id, recognized_to_date, deferred_balance, seat_count
     FROM revenue_schedules
     WHERE company_id = $1 AND subscription_id = $2 AND status = 'active'`,
    [companyId, subscriptionId]
  );

  for (const sched of schedules.rows) {
    const releasedDeferred = sched.deferred_balance;

    await withTransaction(async (client: pg.PoolClient) => {
      if (effectiveEndDate) {
        await client.query(
          `UPDATE revenue_schedules
           SET period_end = $1, status = 'canceled', deferred_balance = 0, updated_at = NOW(),
               modification_reason = 'canceled'
           WHERE id = $2`,
          [effectiveEndDate, sched.id]
        );
      } else {
        await client.query(
          `UPDATE revenue_schedules
           SET status = 'canceled', deferred_balance = 0, updated_at = NOW(),
               modification_reason = 'canceled'
           WHERE id = $1`,
          [sched.id]
        );
      }
    });

    if (releasedDeferred > 0) {
      await recordJournalEntry(companyId, "deferred_release", releasedDeferred,
        `Cancellation: released $${(releasedDeferred / 100).toFixed(2)} deferred revenue (non-refundable)`,
        { subscription_id: subscriptionId, seat_count: sched.seat_count }
      );
    }

    await recordJournalEntry(companyId, "cancellation", 0,
      `Subscription canceled: ${sched.seat_count} seats, recognition stopped`,
      { subscription_id: subscriptionId, seat_count: sched.seat_count }
    );
  }

  await auditLog(null, "revenue_schedule_canceled", "revenue_schedules", {
    company_id: companyId,
    subscription_id: subscriptionId,
    schedules_canceled: schedules.rows.length,
  });
}

export async function handleInvoicePaid(
  companyId: string,
  subscriptionId: string,
  periodStart: Date,
  periodEnd: Date,
  seatCount: number,
  amountPaid: number,
  invoiceId: string
): Promise<void> {
  const existing = await query(
    `SELECT id FROM revenue_schedules
     WHERE company_id = $1 AND subscription_id = $2 AND status = 'active'
       AND period_start <= $3 AND period_end >= $4`,
    [companyId, subscriptionId, periodEnd, periodStart]
  );

  if (existing.rows.length === 0) {
    await createRevenueSchedule(
      companyId, subscriptionId, periodStart, periodEnd, seatCount,
      "invoice_paid_new_period"
    );
  }

  await recordJournalEntry(companyId, "billing", amountPaid,
    `Invoice paid #${invoiceId}: ${seatCount} seats, $${(amountPaid / 100).toFixed(2)} billed (deferred)`,
    { subscription_id: subscriptionId, seat_count: seatCount, invoice_id: invoiceId }
  );
}

export async function handleRefund(
  companyId: string,
  amountRefunded: number,
  subscriptionId?: string,
  invoiceId?: string
): Promise<void> {
  if (subscriptionId) {
    const sched = await query(
      `SELECT id, deferred_balance, recognized_to_date
       FROM revenue_schedules
       WHERE company_id = $1 AND subscription_id = $2 AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`,
      [companyId, subscriptionId]
    );

    if (sched.rows.length > 0) {
      const s = sched.rows[0];
      const deferredReduction = Math.min(amountRefunded, s.deferred_balance);
      const recognizedReduction = amountRefunded - deferredReduction;

      await query(
        `UPDATE revenue_schedules
         SET deferred_balance = deferred_balance - $1,
             recognized_to_date = GREATEST(0, recognized_to_date - $2),
             total_amount = total_amount - $3,
             updated_at = NOW()
         WHERE id = $4`,
        [deferredReduction, recognizedReduction, amountRefunded, s.id]
      );
    }
  }

  await recordJournalEntry(companyId, "refund", -amountRefunded,
    `Refund: -$${(amountRefunded / 100).toFixed(2)}`,
    { subscription_id: subscriptionId, invoice_id: invoiceId }
  );

  await auditLog(null, "revenue_refund_recorded", "revenue_schedules", {
    company_id: companyId,
    amount_refunded: amountRefunded,
    subscription_id: subscriptionId,
    invoice_id: invoiceId,
  });
}

export async function handleSuspension(companyId: string, subscriptionId: string): Promise<void> {
  await query(
    `UPDATE revenue_schedules SET status = 'paused', updated_at = NOW(), modification_reason = 'suspended'
     WHERE company_id = $1 AND subscription_id = $2 AND status = 'active'`,
    [companyId, subscriptionId]
  );

  await auditLog(null, "revenue_recognition_paused", "revenue_schedules", {
    company_id: companyId,
    subscription_id: subscriptionId,
    reason: "account_suspended",
  });
}

export async function handleReactivation(companyId: string, subscriptionId: string): Promise<void> {
  await query(
    `UPDATE revenue_schedules SET status = 'active', updated_at = NOW(), modification_reason = 'reactivated'
     WHERE company_id = $1 AND subscription_id = $2 AND status = 'paused'`,
    [companyId, subscriptionId]
  );

  await auditLog(null, "revenue_recognition_resumed", "revenue_schedules", {
    company_id: companyId,
    subscription_id: subscriptionId,
  });
}

export async function runDailyRecognition(asOfDate?: Date): Promise<{
  schedules_processed: number;
  total_recognized_today: number;
  errors: string[];
}> {
  const today = asOfDate || new Date();
  const todayStr = toDateStr(today);
  const result = { schedules_processed: 0, total_recognized_today: 0, errors: [] as string[] };

  const schedules = await query(
    `SELECT rs.id, rs.company_id, rs.subscription_id, rs.period_start, rs.period_end,
            rs.seat_count, rs.total_amount, rs.recognized_to_date, rs.deferred_balance,
            rs.daily_rate, rs.last_recognized_date
     FROM revenue_schedules rs
     WHERE rs.status = 'active'
       AND rs.period_start <= $1
       AND rs.period_end > $1
       AND (rs.last_recognized_date IS NULL OR rs.last_recognized_date < $1)`,
    [todayStr]
  );

  for (const sched of schedules.rows) {
    try {
      const lastRecDate = sched.last_recognized_date
        ? new Date(sched.last_recognized_date)
        : new Date(sched.period_start);
      const daysSinceLast = daysBetween(lastRecDate, today);
      const recognizeAmount = Math.min(
        sched.daily_rate * daysSinceLast,
        sched.deferred_balance
      );

      if (recognizeAmount <= 0) continue;

      await withTransaction(async (client: pg.PoolClient) => {
        await client.query(
          `UPDATE revenue_schedules
           SET recognized_to_date = recognized_to_date + $1,
               deferred_balance = GREATEST(0, deferred_balance - $1),
               last_recognized_date = $2,
               updated_at = NOW()
           WHERE id = $3`,
          [recognizeAmount, todayStr, sched.id]
        );

        await client.query(
          `INSERT INTO revenue_journal
             (company_id, entry_date, entry_type, amount, description,
              subscription_id, seat_count, schedule_id, metadata)
           VALUES ($1, $2, 'recognition', $3, $4, $5, $6, $7, $8)`,
          [
            sched.company_id,
            todayStr,
            recognizeAmount,
            `Daily recognition: ${daysSinceLast}d × $${(sched.daily_rate / 100).toFixed(2)}/day = $${(recognizeAmount / 100).toFixed(2)}`,
            sched.subscription_id,
            sched.seat_count,
            sched.id,
            JSON.stringify({
              days_recognized: daysSinceLast,
              daily_rate: sched.daily_rate,
              before_recognized: sched.recognized_to_date,
              after_recognized: sched.recognized_to_date + recognizeAmount,
              before_deferred: sched.deferred_balance,
              after_deferred: Math.max(0, sched.deferred_balance - recognizeAmount),
            }),
          ]
        );
      });

      result.schedules_processed++;
      result.total_recognized_today += recognizeAmount;
    } catch (err: any) {
      result.errors.push(`Schedule ${sched.id}: ${err.message}`);
    }
  }

  const expiredSchedules = await query(
    `SELECT id, company_id, deferred_balance, seat_count, subscription_id
     FROM revenue_schedules
     WHERE status = 'active' AND period_end <= $1 AND deferred_balance > 0`,
    [todayStr]
  );

  for (const sched of expiredSchedules.rows) {
    try {
      await withTransaction(async (client: pg.PoolClient) => {
        await client.query(
          `UPDATE revenue_schedules
           SET recognized_to_date = recognized_to_date + deferred_balance,
               deferred_balance = 0,
               last_recognized_date = $1,
               status = 'completed',
               updated_at = NOW()
           WHERE id = $2`,
          [todayStr, sched.id]
        );

        await client.query(
          `INSERT INTO revenue_journal
             (company_id, entry_date, entry_type, amount, description,
              subscription_id, seat_count, schedule_id)
           VALUES ($1, $2, 'recognition', $3, $4, $5, $6, $7)`,
          [
            sched.company_id,
            todayStr,
            sched.deferred_balance,
            `Period-end catch-up recognition: $${(sched.deferred_balance / 100).toFixed(2)} (rounding)`,
            sched.subscription_id,
            sched.seat_count,
            sched.id,
          ]
        );
      });

      result.schedules_processed++;
      result.total_recognized_today += sched.deferred_balance;
    } catch (err: any) {
      result.errors.push(`Expired schedule ${sched.id}: ${err.message}`);
    }
  }

  if (result.schedules_processed > 0) {
    await auditLog(null, "daily_recognition_complete", "revenue_schedules", {
      date: todayStr,
      schedules_processed: result.schedules_processed,
      total_recognized_cents: result.total_recognized_today,
      total_recognized_usd: (result.total_recognized_today / 100).toFixed(2),
      errors: result.errors.length,
    });
  }

  return result;
}

async function recordJournalEntry(
  companyId: string,
  entryType: string,
  amountCents: number,
  description: string,
  metadata?: Record<string, any>
): Promise<void> {
  await query(
    `INSERT INTO revenue_journal
       (company_id, entry_date, entry_type, amount, description,
        subscription_id, seat_count, invoice_id, metadata)
     VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8)`,
    [
      companyId,
      entryType,
      amountCents,
      description,
      metadata?.subscription_id || null,
      metadata?.seat_count || null,
      metadata?.invoice_id || null,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );
}

export async function getRevenueSummary(): Promise<{
  as_of: string;
  current_period: { total_contract_value: number; recognized: number; deferred: number; percent_recognized: number };
  mtd: { recognized: number; count: number };
  ytd: { recognized: number; count: number };
  lifetime: { recognized: number; billed: number; refunded: number };
  active_schedules: number;
  companies: Array<{
    company_id: string;
    company_name: string;
    subscription_id: string;
    seat_count: number;
    period_start: string;
    period_end: string;
    total_amount: number;
    recognized: number;
    deferred: number;
    daily_rate: number;
    percent_recognized: number;
    status: string;
  }>;
}> {
  const now = new Date();
  const mtdStart = startOfMonth(now);
  const ytdStart = startOfYear(now);

  const [schedules, mtdRec, ytdRec, lifetimeRec, lifetimeBilled, lifetimeRefunded] = await Promise.all([
    query(
      `SELECT rs.*, c.name as company_name
       FROM revenue_schedules rs
       LEFT JOIN companies c ON c.id = rs.company_id
       WHERE rs.status IN ('active', 'paused')
       ORDER BY rs.created_at DESC`
    ),
    query(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as cnt
       FROM revenue_journal
       WHERE entry_type = 'recognition' AND entry_date >= $1`,
      [toDateStr(mtdStart)]
    ),
    query(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as cnt
       FROM revenue_journal
       WHERE entry_type = 'recognition' AND entry_date >= $1`,
      [toDateStr(ytdStart)]
    ),
    query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM revenue_journal WHERE entry_type = 'recognition'`
    ),
    query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM revenue_journal WHERE entry_type = 'billing'`
    ),
    query(
      `SELECT COALESCE(SUM(ABS(amount)), 0) as total
       FROM revenue_journal WHERE entry_type = 'refund'`
    ),
  ]);

  let totalContract = 0;
  let totalRecognized = 0;
  let totalDeferred = 0;

  const companies = schedules.rows.map((s: any) => {
    totalContract += s.total_amount;
    totalRecognized += s.recognized_to_date;
    totalDeferred += s.deferred_balance;

    return {
      company_id: s.company_id,
      company_name: s.company_name || "Unknown",
      subscription_id: s.subscription_id,
      seat_count: s.seat_count,
      period_start: new Date(s.period_start).toISOString(),
      period_end: new Date(s.period_end).toISOString(),
      total_amount: s.total_amount,
      recognized: s.recognized_to_date,
      deferred: s.deferred_balance,
      daily_rate: s.daily_rate,
      percent_recognized: s.total_amount > 0
        ? Math.round((s.recognized_to_date / s.total_amount) * 10000) / 100
        : 0,
      status: s.status,
    };
  });

  return {
    as_of: now.toISOString(),
    current_period: {
      total_contract_value: totalContract,
      recognized: totalRecognized,
      deferred: totalDeferred,
      percent_recognized: totalContract > 0
        ? Math.round((totalRecognized / totalContract) * 10000) / 100
        : 0,
    },
    mtd: {
      recognized: parseInt(mtdRec.rows[0].total) || 0,
      count: parseInt(mtdRec.rows[0].cnt) || 0,
    },
    ytd: {
      recognized: parseInt(ytdRec.rows[0].total) || 0,
      count: parseInt(ytdRec.rows[0].cnt) || 0,
    },
    lifetime: {
      recognized: parseInt(lifetimeRec.rows[0].total) || 0,
      billed: parseInt(lifetimeBilled.rows[0].total) || 0,
      refunded: parseInt(lifetimeRefunded.rows[0].total) || 0,
    },
    active_schedules: schedules.rows.filter((s: any) => s.status === "active").length,
    companies,
  };
}

export async function getRevenueWaterfall(monthsBack: number = 12): Promise<Array<{
  month: string;
  recognized: number;
  billed: number;
  refunded: number;
  deferred_released: number;
  seat_changes: number;
  net: number;
}>> {
  const safeMonths = Math.max(1, Math.min(Math.floor(monthsBack), 24));
  const result = await query(
    `SELECT
       TO_CHAR(entry_date, 'YYYY-MM') as month,
       COALESCE(SUM(CASE WHEN entry_type = 'recognition' THEN amount ELSE 0 END), 0) as recognized,
       COALESCE(SUM(CASE WHEN entry_type = 'billing' THEN amount ELSE 0 END), 0) as billed,
       COALESCE(SUM(CASE WHEN entry_type = 'refund' THEN ABS(amount) ELSE 0 END), 0) as refunded,
       COALESCE(SUM(CASE WHEN entry_type = 'deferred_release' THEN amount ELSE 0 END), 0) as deferred_released,
       COALESCE(SUM(CASE WHEN entry_type = 'seat_change' THEN amount ELSE 0 END), 0) as seat_changes
     FROM revenue_journal
     WHERE entry_date >= CURRENT_DATE - ($1 || ' months')::INTERVAL
     GROUP BY TO_CHAR(entry_date, 'YYYY-MM')
     ORDER BY month ASC`,
    [safeMonths]
  );

  return result.rows.map((r: any) => {
    const recognized = parseInt(r.recognized) || 0;
    const refunded = parseInt(r.refunded) || 0;
    return {
      month: r.month,
      recognized,
      billed: parseInt(r.billed) || 0,
      refunded,
      deferred_released: parseInt(r.deferred_released) || 0,
      seat_changes: parseInt(r.seat_changes) || 0,
      net: recognized - refunded,
    };
  });
}

export async function getRevenueJournal(
  opts: { companyId?: string; entryType?: string; limit?: number; offset?: number; format?: string } = {}
): Promise<{ entries: any[]; total: number }> {
  const conditions: string[] = [];
  const params: any[] = [];

  if (opts.companyId) {
    params.push(opts.companyId);
    conditions.push(`rj.company_id = $${params.length}`);
  }
  if (opts.entryType) {
    params.push(opts.entryType);
    conditions.push(`rj.entry_type = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.min(opts.limit || 50, 200);
  const offset = Math.max(opts.offset || 0, 0);

  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const [entries, count] = await Promise.all([
    query(
      `SELECT rj.*, c.name as company_name
       FROM revenue_journal rj
       LEFT JOIN companies c ON c.id = rj.company_id
       ${whereClause}
       ORDER BY rj.entry_date DESC, rj.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    ),
    query(
      `SELECT COUNT(*) as total FROM revenue_journal rj ${whereClause}`,
      params.slice(0, conditions.length)
    ),
  ]);

  return {
    entries: entries.rows,
    total: parseInt(count.rows[0].total) || 0,
  };
}

export function startDailyRecognitionScheduler(): void {
  const INTERVAL = 60 * 60 * 1000;
  let lastRunDate = "";

  const run = async () => {
    const todayStr = toDateStr(new Date());
    if (todayStr === lastRunDate) return;

    try {
      console.log(`[Revenue] Running daily recognition for ${todayStr}...`);
      const result = await runDailyRecognition();
      lastRunDate = todayStr;
      console.log(
        `[Revenue] Complete: ${result.schedules_processed} schedules, ` +
        `$${(result.total_recognized_today / 100).toFixed(2)} recognized, ` +
        `${result.errors.length} errors`
      );
    } catch (err: any) {
      console.error("[Revenue] Daily recognition error:", err.message);
    }
  };

  setTimeout(run, 45000);
  setInterval(run, INTERVAL);
}
