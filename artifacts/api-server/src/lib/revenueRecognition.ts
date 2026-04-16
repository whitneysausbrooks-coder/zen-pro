import { query, auditLog, withTransaction } from "./db";

const PRICE_PER_SEAT_CENTS = 1200;

interface RevenueSnapshot {
  company_id: string;
  subscription_id: string | null;
  period_start: Date;
  period_end: Date;
  seat_count: number;
  total_contract_value: number;
  revenue_recognized: number;
  revenue_deferred: number;
  daily_rate: number;
}

interface RevenueSummary {
  total_recognized: number;
  total_deferred: number;
  total_contract_value: number;
  companies: Array<{
    company_id: string;
    company_name: string;
    subscription_id: string | null;
    seat_count: number;
    period_start: string | null;
    period_end: string | null;
    contract_value: number;
    recognized: number;
    deferred: number;
    percent_recognized: number;
    daily_rate: number;
  }>;
}

interface MonthlyBreakdown {
  month: string;
  recognized: number;
  deferred: number;
  new_bookings: number;
  cancellations: number;
  seat_changes: number;
  refunds: number;
}

function daysBetween(start: Date, end: Date): number {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

function daysElapsed(start: Date, now: Date, end: Date): number {
  const elapsed = Math.ceil((Math.min(now.getTime(), end.getTime()) - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, elapsed);
}

export function calculateRevenueAllocation(
  seatCount: number,
  periodStart: Date,
  periodEnd: Date,
  asOfDate: Date = new Date()
): RevenueSnapshot & { percent_recognized: number } {
  const totalValue = seatCount * PRICE_PER_SEAT_CENTS;
  const totalDays = daysBetween(periodStart, periodEnd);
  const dailyRate = Math.round(totalValue / totalDays);
  const elapsed = daysElapsed(periodStart, asOfDate, periodEnd);
  const recognized = Math.min(dailyRate * elapsed, totalValue);
  const deferred = Math.max(0, totalValue - recognized);

  return {
    company_id: "",
    subscription_id: null,
    period_start: periodStart,
    period_end: periodEnd,
    seat_count: seatCount,
    total_contract_value: totalValue,
    revenue_recognized: recognized,
    revenue_deferred: deferred,
    daily_rate: dailyRate,
    percent_recognized: totalDays > 0 ? Math.round((elapsed / totalDays) * 10000) / 100 : 0,
  };
}

export async function recordRevenueEvent(
  companyId: string,
  entryType: string,
  amountCents: number,
  description: string,
  metadata?: Record<string, any>
): Promise<void> {
  await query(
    `INSERT INTO revenue_journal (company_id, entry_date, entry_type, amount, description, subscription_id, seat_count, invoice_id, metadata)
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

  await auditLog(null, "revenue_event_recorded", "revenue_journal", {
    company_id: companyId,
    entry_type: entryType,
    amount_cents: amountCents,
    description,
  });
}

export async function snapshotRevenueRecognition(companyId: string): Promise<void> {
  const companyRes = await query(
    `SELECT id, subscription_id, subscription_status, seat_count, billing_period_end
     FROM companies WHERE id = $1`,
    [companyId]
  );

  if (companyRes.rows.length === 0) return;
  const company = companyRes.rows[0];

  if (!company.subscription_id || !company.billing_period_end || company.subscription_status === "canceled") {
    return;
  }

  const periodEnd = new Date(company.billing_period_end);
  const totalDays = 30;
  const periodStart = new Date(periodEnd.getTime() - totalDays * 24 * 60 * 60 * 1000);
  const seats = company.seat_count || 0;

  const alloc = calculateRevenueAllocation(seats, periodStart, periodEnd);

  await query(
    `INSERT INTO revenue_recognition (company_id, subscription_id, period_start, period_end, seat_count, total_contract_value, revenue_recognized, revenue_deferred, daily_rate, event_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'snapshot')`,
    [
      companyId,
      company.subscription_id,
      periodStart,
      periodEnd,
      seats,
      alloc.total_contract_value,
      alloc.revenue_recognized,
      alloc.revenue_deferred,
      alloc.daily_rate,
    ]
  );
}

export async function getCurrentRevenueSummary(): Promise<RevenueSummary> {
  const companies = await query(
    `SELECT c.id, c.name, c.subscription_id, c.subscription_status, c.seat_count, c.billing_period_end
     FROM companies c
     WHERE c.subscription_status IN ('active', 'past_due')
       AND c.subscription_id IS NOT NULL
       AND c.billing_period_end IS NOT NULL`
  );

  let totalRecognized = 0;
  let totalDeferred = 0;
  let totalContractValue = 0;
  const now = new Date();

  const companyBreakdowns = companies.rows.map((c: any) => {
    const periodEnd = new Date(c.billing_period_end);
    const totalDays = 30;
    const periodStart = new Date(periodEnd.getTime() - totalDays * 24 * 60 * 60 * 1000);
    const seats = c.seat_count || 0;
    const alloc = calculateRevenueAllocation(seats, periodStart, periodEnd, now);

    totalRecognized += alloc.revenue_recognized;
    totalDeferred += alloc.revenue_deferred;
    totalContractValue += alloc.total_contract_value;

    return {
      company_id: c.id,
      company_name: c.name,
      subscription_id: c.subscription_id,
      seat_count: seats,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      contract_value: alloc.total_contract_value,
      recognized: alloc.revenue_recognized,
      deferred: alloc.revenue_deferred,
      percent_recognized: alloc.percent_recognized,
      daily_rate: alloc.daily_rate,
    };
  });

  return {
    total_recognized: totalRecognized,
    total_deferred: totalDeferred,
    total_contract_value: totalContractValue,
    companies: companyBreakdowns,
  };
}

export async function getMonthlyRevenueBreakdown(monthsBack: number = 12): Promise<MonthlyBreakdown[]> {
  const safeMonths = Math.max(1, Math.min(Math.floor(monthsBack), 24));
  const result = await query(
    `SELECT
       TO_CHAR(entry_date, 'YYYY-MM') as month,
       SUM(CASE WHEN entry_type IN ('invoice_paid', 'recognition_daily') THEN amount ELSE 0 END) as recognized,
       SUM(CASE WHEN entry_type = 'new_subscription' THEN amount ELSE 0 END) as new_bookings,
       SUM(CASE WHEN entry_type = 'cancellation' THEN amount ELSE 0 END) as cancellations,
       SUM(CASE WHEN entry_type = 'seat_change' THEN amount ELSE 0 END) as seat_changes,
       SUM(CASE WHEN entry_type = 'refund' THEN amount ELSE 0 END) as refunds
     FROM revenue_journal
     WHERE entry_date >= CURRENT_DATE - ($1 || ' months')::INTERVAL
     GROUP BY TO_CHAR(entry_date, 'YYYY-MM')
     ORDER BY month ASC`,
    [safeMonths]
  );

  return result.rows.map((r: any) => ({
    month: r.month,
    recognized: parseInt(r.recognized) || 0,
    deferred: 0,
    new_bookings: parseInt(r.new_bookings) || 0,
    cancellations: Math.abs(parseInt(r.cancellations) || 0),
    seat_changes: parseInt(r.seat_changes) || 0,
    refunds: Math.abs(parseInt(r.refunds) || 0),
  }));
}

export async function getRevenueJournal(
  companyId?: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ entries: any[]; total: number }> {
  const conditions: string[] = [];
  const params: any[] = [];

  if (companyId) {
    params.push(companyId);
    conditions.push(`rj.company_id = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

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

export async function recordSubscriptionRevenue(
  companyId: string,
  subscriptionId: string,
  seats: number,
  amountPaid: number,
  invoiceId?: string
): Promise<void> {
  await recordRevenueEvent(
    companyId,
    "invoice_paid",
    amountPaid,
    `Invoice paid: ${seats} seats at $${(PRICE_PER_SEAT_CENTS / 100).toFixed(2)}/seat`,
    { subscription_id: subscriptionId, seat_count: seats, invoice_id: invoiceId }
  );
}

export async function recordNewSubscription(
  companyId: string,
  subscriptionId: string,
  seats: number
): Promise<void> {
  const totalValue = seats * PRICE_PER_SEAT_CENTS;
  await recordRevenueEvent(
    companyId,
    "new_subscription",
    totalValue,
    `New subscription: ${seats} seats at $${(PRICE_PER_SEAT_CENTS / 100).toFixed(2)}/seat = $${(totalValue / 100).toFixed(2)}/mo`,
    { subscription_id: subscriptionId, seat_count: seats }
  );
}

export async function recordSeatChange(
  companyId: string,
  subscriptionId: string,
  previousSeats: number,
  newSeats: number
): Promise<void> {
  const delta = newSeats - previousSeats;
  const deltaValue = delta * PRICE_PER_SEAT_CENTS;
  await recordRevenueEvent(
    companyId,
    "seat_change",
    deltaValue,
    `Seat change: ${previousSeats} → ${newSeats} (${delta > 0 ? "+" : ""}${delta} seats, ${delta > 0 ? "+" : ""}$${(deltaValue / 100).toFixed(2)}/mo)`,
    { subscription_id: subscriptionId, seat_count: newSeats, previous_seats: previousSeats }
  );
}

export async function recordCancellation(
  companyId: string,
  subscriptionId: string,
  seats: number
): Promise<void> {
  const lostRevenue = seats * PRICE_PER_SEAT_CENTS;
  await recordRevenueEvent(
    companyId,
    "cancellation",
    -lostRevenue,
    `Subscription canceled: ${seats} seats, -$${(lostRevenue / 100).toFixed(2)}/mo lost`,
    { subscription_id: subscriptionId, seat_count: seats }
  );
}

export async function recordRefund(
  companyId: string,
  amountRefunded: number,
  invoiceId?: string
): Promise<void> {
  await recordRevenueEvent(
    companyId,
    "refund",
    -amountRefunded,
    `Refund issued: -$${(amountRefunded / 100).toFixed(2)}`,
    { invoice_id: invoiceId }
  );
}
