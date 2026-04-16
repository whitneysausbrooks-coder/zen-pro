import { query } from "./db";

export interface SeatCheck {
  allowed: boolean;
  current_employees: number;
  seat_count: number;
  seat_cap: number;
  subscription_status: string;
  reason?: string;
}

export async function checkSeatAvailability(companyId: string): Promise<SeatCheck> {
  const companyResult = await query(
    `SELECT subscription_status, seat_count, seat_cap, suspended_at FROM companies WHERE id = $1`,
    [companyId]
  );

  if (companyResult.rows.length === 0) {
    return {
      allowed: false,
      current_employees: 0,
      seat_count: 0,
      seat_cap: 0,
      subscription_status: "none",
      reason: "Company not found",
    };
  }

  const company = companyResult.rows[0];

  if (company.suspended_at) {
    return {
      allowed: false,
      current_employees: 0,
      seat_count: company.seat_count || 0,
      seat_cap: company.seat_cap || 0,
      subscription_status: "suspended",
      reason: "Account suspended due to payment failure. Please update billing.",
    };
  }

  if (company.subscription_status !== "active" && company.subscription_status !== "trialing") {
    const employeeCount = await query(
      `SELECT COUNT(*) as count FROM enterprise_users WHERE company_id = $1`,
      [companyId]
    );
    return {
      allowed: false,
      current_employees: parseInt(employeeCount.rows[0].count),
      seat_count: company.seat_count || 0,
      seat_cap: company.seat_cap || 0,
      subscription_status: company.subscription_status || "none",
      reason: "No active subscription. Subscribe to add employees.",
    };
  }

  const employeeCount = await query(
    `SELECT COUNT(*) as count FROM enterprise_users WHERE company_id = $1`,
    [companyId]
  );
  const currentEmployees = parseInt(employeeCount.rows[0].count);
  const seatLimit = Math.min(company.seat_count || 0, company.seat_cap || 10000);

  if (currentEmployees >= seatLimit) {
    return {
      allowed: false,
      current_employees: currentEmployees,
      seat_count: company.seat_count,
      seat_cap: company.seat_cap,
      subscription_status: company.subscription_status,
      reason: `Seat limit reached (${currentEmployees}/${seatLimit}). Upgrade your plan to add more employees.`,
    };
  }

  return {
    allowed: true,
    current_employees: currentEmployees,
    seat_count: company.seat_count,
    seat_cap: company.seat_cap,
    subscription_status: company.subscription_status,
  };
}

export async function getCompanyBillingStatus(companyId: string): Promise<{
  status: string;
  is_active: boolean;
  is_suspended: boolean;
  is_past_due: boolean;
  seats_used: number;
  seats_total: number;
  dunning_attempts: number;
}> {
  const companyResult = await query(
    `SELECT subscription_status, seat_count, dunning_attempts, suspended_at FROM companies WHERE id = $1`,
    [companyId]
  );

  if (companyResult.rows.length === 0) {
    return {
      status: "none",
      is_active: false,
      is_suspended: false,
      is_past_due: false,
      seats_used: 0,
      seats_total: 0,
      dunning_attempts: 0,
    };
  }

  const company = companyResult.rows[0];
  const employeeCount = await query(
    `SELECT COUNT(*) as count FROM enterprise_users WHERE company_id = $1`,
    [companyId]
  );

  return {
    status: company.subscription_status || "none",
    is_active: company.subscription_status === "active",
    is_suspended: !!company.suspended_at,
    is_past_due: company.subscription_status === "past_due",
    seats_used: parseInt(employeeCount.rows[0].count),
    seats_total: company.seat_count || 0,
    dunning_attempts: company.dunning_attempts || 0,
  };
}
