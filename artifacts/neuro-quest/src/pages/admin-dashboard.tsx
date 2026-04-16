import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface TrendDay {
  day: string;
  avg_wri: string;
  avg_burnout_risk: string;
  avg_cohesion: string;
}

interface RiskFactor {
  factor: string;
  affected_employees: number;
}

interface OutcomeMetrics {
  burnout_change_30d: number | null;
  wri_change_30d: number | null;
  projected_retention_impact: number | null;
}

interface DashboardData {
  view: "executive" | "manager";
  avg_wri: number;
  avg_burnout_risk: number;
  total_employees: number;
  burnout_severity: "low" | "moderate" | "high" | "critical";
  burnout_alert: string | null;
  trend_7d: TrendDay[];
  top_risk_factors?: RiskFactor[];
  outcomes?: OutcomeMetrics;
  projected_burnout_7d?: number | null;
  projected_burnout_30d?: number | null;
  trend_direction?: string;
  engine_version?: string;
  high_risk_employees?: number;
  high_risk_label?: string;
  team_cohesion?: number;
  cohesion_delta?: number;
  cohesion_label?: string;
}

interface BillingData {
  has_subscription: boolean;
  company_name?: string;
  seats?: number;
  per_seat_price?: number;
  monthly_total?: number;
  current_period_end?: string;
  status?: string;
}

interface SeatStatus {
  status: string;
  is_active: boolean;
  is_suspended: boolean;
  is_past_due: boolean;
  seats_used: number;
  seats_total: number;
  dunning_attempts: number;
}

interface WebhookMetrics {
  total_24h: number;
  success_24h: number;
  failure_24h: number;
  success_rate_24h: number;
  avg_processing_ms_24h: number;
  dlq_pending: number;
  dlq_permanent_failures: number;
}

interface InvoiceEntry {
  id: string;
  number: string | null;
  status: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  created: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  tax: number | null;
  subtotal: number;
  total: number;
}

interface RevenueData {
  as_of: string;
  total_recognized: number;
  total_deferred: number;
  total_contract_value: number;
  percent_recognized: number;
  active_companies: number;
  active_schedules: number;
  mtd: { recognized: number; count: number; recognized_display: string };
  ytd: { recognized: number; count: number; recognized_display: string };
  lifetime: { recognized: number; billed: number; refunded: number; recognized_display: string; billed_display: string; refunded_display: string };
  companies: Array<{
    company_id: string;
    company_name: string;
    subscription_id: string;
    seat_count: number;
    total_amount: number;
    recognized: number;
    deferred: number;
    percent_recognized: number;
    daily_rate: number;
    period_start: string;
    period_end: string;
    status: string;
  }>;
}

interface RevenueMonth {
  month: string;
  recognized: number;
  billed: number;
  refunded: number;
  deferred_released: number;
  seat_changes: number;
  net: number;
}

interface JournalEntry {
  id: string;
  entry_date: string;
  entry_type: string;
  amount: number;
  description: string;
  company_name: string | null;
  seat_count: number | null;
  invoice_id: string | null;
}

interface AuditEntry {
  id: string;
  user_id: string | null;
  action: string;
  resource: string;
  details: Record<string, any> | null;
  created_at: string;
}

const severityColors: Record<string, string> = {
  low: "#4ADE80",
  moderate: "#FBBF24",
  high: "#F97316",
  critical: "#EF4444",
};

const trendDirectionLabels: Record<string, { label: string; color: string }> = {
  improving: { label: "Improving", color: "#4ADE80" },
  stable: { label: "Stable", color: "#60A5FA" },
  declining: { label: "Declining", color: "#F97316" },
  critical_decline: { label: "Critical Decline", color: "#EF4444" },
};

function MetricCard({
  label,
  value,
  subtitle,
  color,
  badge,
  large,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  color: string;
  badge?: { text: string; color: string };
  large?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 backdrop-blur-sm"
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-[11px] font-medium tracking-[0.15em] text-white/35 uppercase">
          {label}
        </p>
        {badge && (
          <span
            className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider"
            style={{ backgroundColor: badge.color + "18", color: badge.color }}
          >
            {badge.text}
          </span>
        )}
      </div>
      <p className={`font-bold ${large ? "text-4xl" : "text-3xl"}`} style={{ color }}>
        {value}
      </p>
      {subtitle && (
        <p className="text-[11px] text-white/25 mt-2">{subtitle}</p>
      )}
    </motion.div>
  );
}

function TrendLineChart({ data }: { data: TrendDay[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-white/25 text-sm">
        No trend data available for the last 7 days
      </div>
    );
  }

  const chartData = data.map((d) => ({
    day: new Date(d.day).toLocaleDateString("en", { month: "short", day: "numeric" }),
    WRI: parseFloat(d.avg_wri),
    "Burnout Risk": parseFloat(d.avg_burnout_risk),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis
          dataKey="day"
          tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
          axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
          axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(10,10,20,0.95)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "10px",
            fontSize: "12px",
            color: "#fff",
          }}
          itemStyle={{ color: "#fff" }}
          labelStyle={{ color: "rgba(255,255,255,0.5)", marginBottom: "4px" }}
        />
        <Legend
          wrapperStyle={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}
          iconType="circle"
          iconSize={6}
        />
        <Line
          type="monotone"
          dataKey="WRI"
          stroke="#4ADE80"
          strokeWidth={2}
          dot={{ r: 3, fill: "#4ADE80", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#4ADE80" }}
        />
        <Line
          type="monotone"
          dataKey="Burnout Risk"
          stroke="#F87171"
          strokeWidth={2}
          strokeDasharray="6 3"
          dot={{ r: 3, fill: "#F87171", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#F87171" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function OutcomeCard({ outcomes }: { outcomes: OutcomeMetrics }) {
  const items = [
    {
      label: "Burnout Risk Change (30d)",
      value: outcomes.burnout_change_30d,
      suffix: "%",
      good: (v: number) => v < 0,
      icon: "📉",
    },
    {
      label: "WRI Change (30d)",
      value: outcomes.wri_change_30d,
      suffix: "%",
      good: (v: number) => v > 0,
      icon: "📈",
    },
    {
      label: "Projected Retention Impact",
      value: outcomes.projected_retention_impact,
      suffix: "%",
      good: (v: number) => v > 0,
      icon: "👥",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item) => {
        const val = item.value;
        const hasData = val !== null && val !== undefined;
        const isGood = hasData && item.good(val);
        const color = hasData ? (isGood ? "#4ADE80" : "#F87171") : "rgba(255,255,255,0.25)";
        return (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4"
          >
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-sm">{item.icon}</span>
              <p className="text-[10px] font-medium tracking-[0.12em] text-white/30 uppercase">
                {item.label}
              </p>
            </div>
            <p className="text-2xl font-bold" style={{ color }}>
              {hasData ? `${val > 0 ? "+" : ""}${val}${item.suffix}` : "—"}
            </p>
            {hasData && (
              <p className="text-[10px] mt-1" style={{ color: color + "80" }}>
                {isGood ? "Positive trend" : "Needs attention"}
              </p>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function RiskFactorsPanel({ factors }: { factors: RiskFactor[] }) {
  if (factors.length === 0) return null;
  return (
    <div className="space-y-2">
      {factors.map((f, i) => (
        <div
          key={i}
          className="flex items-center justify-between bg-white/[0.02] border border-white/[0.04] rounded-lg px-4 py-2.5"
        >
          <span className="text-xs text-white/50">{f.factor}</span>
          <span className="text-[10px] font-medium text-white/30">
            {f.affected_employees} employee{f.affected_employees !== 1 ? "s" : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [seatStatus, setSeatStatus] = useState<SeatStatus | null>(null);
  const [webhookMetrics, setWebhookMetrics] = useState<WebhookMetrics | null>(null);
  const [invoices, setInvoices] = useState<InvoiceEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [revenueMonthly, setRevenueMonthly] = useState<RevenueMonth[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [activeView, setActiveView] = useState<"executive" | "manager">("executive");

  const headers = { "x-enterprise-key": apiKey };

  const fetchDashboard = async (id: string, view: "executive" | "manager") => {
    if (!id || !apiKey) return;
    setLoading(true);
    try {
      const [dashRes, billingRes, seatRes, metricsRes, invoiceRes, auditRes, revSummaryRes, revMonthlyRes, revJournalRes] = await Promise.all([
        fetch(`${BASE}/api/enterprise/company/${id}/dashboard?view=${view}`, { headers }),
        fetch(`${BASE}/api/stripe-enterprise/billing/${id}`, { headers }),
        fetch(`${BASE}/api/enterprise/seats/${id}`, { headers }),
        fetch(`${BASE}/api/stripe-enterprise/webhook-metrics`, { headers }),
        fetch(`${BASE}/api/stripe-enterprise/invoices/${id}`, { headers }),
        fetch(`${BASE}/api/enterprise/audit-log?limit=20`, { headers }),
        fetch(`${BASE}/api/enterprise/revenue/summary`, { headers }),
        fetch(`${BASE}/api/enterprise/revenue/waterfall`, { headers }),
        fetch(`${BASE}/api/enterprise/revenue/journal?limit=10`, { headers }),
      ]);

      if (dashRes.ok) {
        setDashboard(await dashRes.json());
      } else if (dashRes.status === 401) {
        setDashboard(null);
        alert("Invalid API key");
      }

      if (billingRes.ok) setBilling(await billingRes.json());
      if (seatRes.ok) setSeatStatus(await seatRes.json());
      if (metricsRes.ok) setWebhookMetrics(await metricsRes.json());
      if (invoiceRes.ok) {
        const data = await invoiceRes.json();
        setInvoices(data.invoices || []);
      }
      if (auditRes.ok) {
        const data = await auditRes.json();
        setAuditLogs(data.logs || []);
      }
      if (revSummaryRes.ok) setRevenueData(await revSummaryRes.json());
      if (revMonthlyRes.ok) {
        const data = await revMonthlyRes.json();
        setRevenueMonthly(data.months || []);
      }
      if (revJournalRes.ok) {
        const data = await revJournalRes.json();
        setJournalEntries(data.entries || []);
      }
    } catch {}
    setLoading(false);
  };

  const triggerReconciliation = async () => {
    setReconciling(true);
    try {
      await fetch(`${BASE}/api/enterprise/reconcile`, { method: "POST", headers });
      fetchDashboard(companyId, activeView);
    } catch {}
    setReconciling(false);
  };

  const loadAll = (view: "executive" | "manager") => {
    setActiveView(view);
    fetchDashboard(companyId, view);
  };

  const sevColor = dashboard ? severityColors[dashboard.burnout_severity] || "#999" : "#999";
  const trendInfo = dashboard?.trend_direction ? trendDirectionLabels[dashboard.trend_direction] : null;

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white antialiased">
      <div className="max-w-[1100px] mx-auto px-8 py-14">

        <div className="flex items-start justify-between mb-10">
          <div>
            <p className="text-[11px] font-medium tracking-[0.25em] text-indigo-400/70 uppercase mb-2">
              Enterprise Admin
            </p>
            <h1 className="text-[28px] font-semibold text-white/90 tracking-tight">
              Workforce Resilience Dashboard
            </h1>
            {dashboard?.engine_version && (
              <p className="text-[10px] text-white/20 mt-1">Engine v{dashboard.engine_version}</p>
            )}
          </div>
          <button
            onClick={() => navigate("/")}
            className="text-xs text-white/30 hover:text-white/60 transition mt-2"
          >
            ← Back to app
          </button>
        </div>

        <div className="mb-10 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] text-white/30 mb-1.5 block tracking-wide uppercase">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter enterprise API key"
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white placeholder-white/15 focus:outline-none focus:border-indigo-400/30 transition"
              />
            </div>
            <div>
              <label className="text-[11px] text-white/30 mb-1.5 block tracking-wide uppercase">Company ID</label>
              <input
                type="text"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                placeholder="Enter company UUID"
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white placeholder-white/15 focus:outline-none focus:border-indigo-400/30 transition"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => loadAll("executive")}
              disabled={loading || !companyId || !apiKey}
              className={`px-5 py-2.5 rounded-lg text-xs font-medium transition disabled:opacity-30 ${
                activeView === "executive"
                  ? "bg-indigo-500/20 border border-indigo-400/30 text-indigo-300"
                  : "bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-white/60"
              }`}
            >
              {loading && activeView === "executive" ? "Loading..." : "Executive View"}
            </button>
            <button
              onClick={() => loadAll("manager")}
              disabled={loading || !companyId || !apiKey}
              className={`px-5 py-2.5 rounded-lg text-xs font-medium transition disabled:opacity-30 ${
                activeView === "manager"
                  ? "bg-indigo-500/20 border border-indigo-400/30 text-indigo-300"
                  : "bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-white/60"
              }`}
            >
              {loading && activeView === "manager" ? "Loading..." : "Manager View"}
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {dashboard && (
            <motion.div
              key={dashboard.view}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="space-y-5"
            >
              {dashboard.burnout_alert && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-xl p-4 border flex items-start gap-3"
                  style={{
                    borderColor: sevColor + "30",
                    backgroundColor: sevColor + "08",
                  }}
                >
                  <span className="text-base mt-0.5">⚠</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white/75">{dashboard.burnout_alert}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                        style={{
                          backgroundColor: sevColor + "15",
                          color: sevColor,
                          border: `1px solid ${sevColor}25`,
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sevColor }} />
                        {dashboard.burnout_severity} risk
                      </span>
                      {trendInfo && (
                        <span
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                          style={{ color: trendInfo.color, backgroundColor: trendInfo.color + "15" }}
                        >
                          Trend: {trendInfo.label}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  label="Workforce Resilience"
                  value={dashboard.avg_wri.toFixed(1)}
                  subtitle="Average WRI across all employees"
                  color="#4ADE80"
                  large
                />
                <MetricCard
                  label="Burnout Risk"
                  value={`${dashboard.avg_burnout_risk.toFixed(1)}%`}
                  subtitle="Company-wide average"
                  color={dashboard.avg_burnout_risk > 50 ? "#EF4444" : dashboard.avg_burnout_risk > 35 ? "#FBBF24" : "#4ADE80"}
                  badge={{ text: dashboard.burnout_severity, color: sevColor }}
                />
                <MetricCard
                  label="Employees Enrolled"
                  value={dashboard.total_employees}
                  color="#A78BFA"
                />
                {dashboard.view === "manager" && dashboard.high_risk_employees !== undefined ? (
                  <MetricCard
                    label="High Risk"
                    value={dashboard.high_risk_label || "0"}
                    subtitle="Above 70% burnout threshold"
                    color="#EF4444"
                  />
                ) : (
                  <MetricCard
                    label="Risk Level"
                    value={dashboard.burnout_severity.charAt(0).toUpperCase() + dashboard.burnout_severity.slice(1)}
                    color={sevColor}
                  />
                )}
              </div>

              {dashboard.outcomes && (
                <div>
                  <p className="text-[11px] font-medium tracking-[0.15em] text-white/35 uppercase mb-3">
                    Measurable Outcomes (30-Day)
                  </p>
                  <OutcomeCard outcomes={dashboard.outcomes} />
                </div>
              )}

              {dashboard.projected_burnout_7d !== null && dashboard.projected_burnout_7d !== undefined && (
                <div className="grid grid-cols-2 gap-4">
                  <MetricCard
                    label="Projected Risk (7 Days)"
                    value={`${dashboard.projected_burnout_7d}%`}
                    subtitle="Linear regression on recent data"
                    color={dashboard.projected_burnout_7d > 60 ? "#EF4444" : dashboard.projected_burnout_7d > 35 ? "#FBBF24" : "#4ADE80"}
                  />
                  <MetricCard
                    label="Projected Risk (30 Days)"
                    value={`${dashboard.projected_burnout_30d ?? "—"}%`}
                    subtitle="Based on current trajectory"
                    color={(dashboard.projected_burnout_30d ?? 0) > 60 ? "#EF4444" : (dashboard.projected_burnout_30d ?? 0) > 35 ? "#FBBF24" : "#4ADE80"}
                  />
                </div>
              )}

              {dashboard.view === "manager" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <MetricCard
                    label="Team Cohesion"
                    value={dashboard.team_cohesion?.toFixed(1) || "—"}
                    subtitle="Average across team members"
                    color="#60A5FA"
                  />
                  <MetricCard
                    label="Cohesion Trend"
                    value={dashboard.cohesion_label || "—"}
                    color={(dashboard.cohesion_delta ?? 0) >= 0 ? "#4ADE80" : "#EF4444"}
                    badge={
                      dashboard.cohesion_delta !== undefined
                        ? {
                            text: dashboard.cohesion_delta >= 0 ? "improving" : "declining",
                            color: dashboard.cohesion_delta >= 0 ? "#4ADE80" : "#EF4444",
                          }
                        : undefined
                    }
                  />
                </div>
              )}

              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
                <p className="text-[11px] font-medium tracking-[0.15em] text-white/35 uppercase mb-5">
                  7-Day Trend
                </p>
                <TrendLineChart data={dashboard.trend_7d} />
              </div>

              {dashboard.top_risk_factors && dashboard.top_risk_factors.length > 0 && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
                  <p className="text-[11px] font-medium tracking-[0.15em] text-white/35 uppercase mb-4">
                    Top Risk Factors (Explainability)
                  </p>
                  <RiskFactorsPanel factors={dashboard.top_risk_factors} />
                </div>
              )}

              {(billing || seatStatus) && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium tracking-[0.15em] text-white/35 uppercase">
                      Billing & Seats
                    </p>
                    <button
                      onClick={triggerReconciliation}
                      disabled={reconciling}
                      className="text-[10px] font-medium px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/40 hover:text-white/60 transition disabled:opacity-30"
                    >
                      {reconciling ? "Syncing..." : "Reconcile with Stripe"}
                    </button>
                  </div>

                  {billing?.has_subscription ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-white/70">
                          {billing.seats} seats · ${billing.monthly_total}/mo
                        </p>
                        <p className="text-xs text-white/30 mt-1">
                          Renews {billing.current_period_end ? new Date(billing.current_period_end).toLocaleDateString() : "—"}
                        </p>
                      </div>
                      <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-emerald-400/15 text-emerald-400 border border-emerald-400/20">
                        Active
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-white/40">No active subscription · $12/seat/month</p>
                  )}

                  {seatStatus && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
                        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Seats Used</p>
                        <p className="text-lg font-bold text-white/80">
                          {seatStatus.seats_used}<span className="text-white/30">/{seatStatus.seats_total || "—"}</span>
                        </p>
                      </div>
                      <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
                        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Status</p>
                        <p className={`text-lg font-bold ${
                          seatStatus.is_active ? "text-emerald-400" :
                          seatStatus.is_suspended ? "text-red-400" :
                          seatStatus.is_past_due ? "text-amber-400" :
                          "text-white/40"
                        }`}>
                          {seatStatus.status}
                        </p>
                      </div>
                      <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
                        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Dunning</p>
                        <p className={`text-lg font-bold ${
                          seatStatus.dunning_attempts >= 3 ? "text-red-400" :
                          seatStatus.dunning_attempts > 0 ? "text-amber-400" :
                          "text-emerald-400"
                        }`}>
                          {seatStatus.dunning_attempts > 0 ? `${seatStatus.dunning_attempts}/3 fails` : "Clean"}
                        </p>
                      </div>
                    </div>
                  )}

                  {seatStatus?.is_suspended && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                      <p className="text-xs text-red-300 font-medium">
                        Account suspended — 3 consecutive payment failures. Employee access restricted until billing is resolved.
                      </p>
                    </div>
                  )}

                  {seatStatus?.is_past_due && !seatStatus.is_suspended && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
                      <p className="text-xs text-amber-300 font-medium">
                        Payment past due — {seatStatus.dunning_attempts} failed attempt{seatStatus.dunning_attempts !== 1 ? "s" : ""}. Account will be suspended after 3 failures.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {webhookMetrics && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">
                  <p className="text-[11px] font-medium tracking-[0.15em] text-white/35 uppercase">
                    Webhook Health (24h)
                  </p>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
                      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Events</p>
                      <p className="text-lg font-bold text-white/80">{webhookMetrics.total_24h}</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
                      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Success Rate</p>
                      <p className={`text-lg font-bold ${webhookMetrics.success_rate_24h >= 99 ? "text-emerald-400" : webhookMetrics.success_rate_24h >= 95 ? "text-amber-400" : "text-red-400"}`}>
                        {webhookMetrics.success_rate_24h}%
                      </p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
                      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Avg Latency</p>
                      <p className="text-lg font-bold text-white/80">{webhookMetrics.avg_processing_ms_24h}ms</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
                      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">DLQ Pending</p>
                      <p className={`text-lg font-bold ${webhookMetrics.dlq_pending > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                        {webhookMetrics.dlq_pending}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {revenueData && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium tracking-[0.15em] text-white/35 uppercase">
                      Revenue Recognition (ASC 606)
                    </p>
                    <span className="text-[10px] text-white/20">
                      {new Date(revenueData.as_of).toLocaleString()} · {revenueData.active_schedules} active schedules
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
                      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Contract Value</p>
                      <p className="text-lg font-bold text-white/80">
                        ${revenueData.total_contract_value.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
                      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Recognized</p>
                      <p className="text-lg font-bold text-emerald-400">
                        ${revenueData.total_recognized.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
                      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Deferred</p>
                      <p className="text-lg font-bold text-amber-400">
                        ${revenueData.total_deferred.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
                      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">% Recognized</p>
                      <p className="text-lg font-bold text-indigo-400">
                        {revenueData.percent_recognized}%
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
                      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">MTD Recognized</p>
                      <p className="text-md font-bold text-emerald-300">${revenueData.mtd.recognized_display}</p>
                      <p className="text-[9px] text-white/20">{revenueData.mtd.count} entries</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
                      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">YTD Recognized</p>
                      <p className="text-md font-bold text-emerald-300">${revenueData.ytd.recognized_display}</p>
                      <p className="text-[9px] text-white/20">{revenueData.ytd.count} entries</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
                      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Lifetime</p>
                      <p className="text-md font-bold text-emerald-300">${revenueData.lifetime.recognized_display}</p>
                      <p className="text-[9px] text-white/20">billed: ${revenueData.lifetime.billed_display} · refunded: ${revenueData.lifetime.refunded_display}</p>
                    </div>
                  </div>

                  {revenueData.total_contract_value > 0 && (
                    <div className="relative h-3 bg-white/[0.04] rounded-full overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700"
                        style={{ width: `${revenueData.percent_recognized}%` }}
                      />
                    </div>
                  )}

                  {revenueData.companies.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] text-white/25 uppercase tracking-wider">Per-Company Schedule Breakdown</p>
                      {revenueData.companies.map((c, i) => (
                        <div key={`${c.company_id}-${i}`} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.04] rounded-lg px-4 py-2.5">
                          <div>
                            <p className="text-xs text-white/60">{c.company_name}</p>
                            <p className="text-[10px] text-white/25 mt-0.5">
                              {c.seat_count} seats · ${(c.daily_rate / 100).toFixed(2)}/day · {c.status}
                            </p>
                            <p className="text-[9px] text-white/15 mt-0.5">
                              {new Date(c.period_start).toLocaleDateString()} - {new Date(c.period_end).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-4 text-right">
                            <div>
                              <p className="text-xs text-emerald-400">${(c.recognized / 100).toFixed(2)}</p>
                              <p className="text-[9px] text-white/20">recognized</p>
                            </div>
                            <div>
                              <p className="text-xs text-amber-400">${(c.deferred / 100).toFixed(2)}</p>
                              <p className="text-[9px] text-white/20">deferred</p>
                            </div>
                            <span className="text-[10px] font-medium text-indigo-400/70 min-w-[3rem] text-right">
                              {c.percent_recognized}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {revenueMonthly.length > 0 && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
                  <p className="text-[11px] font-medium tracking-[0.15em] text-white/35 uppercase mb-4">
                    Revenue Waterfall (Monthly)
                  </p>
                  <div className="space-y-2">
                    {revenueMonthly.map((m) => (
                      <div key={m.month} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.04] rounded-lg px-4 py-2.5">
                        <span className="text-xs text-white/60 min-w-[4rem]">{m.month}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-emerald-400">${(m.recognized / 100).toFixed(2)} rec</span>
                          {m.billed > 0 && <span className="text-[10px] text-blue-400">+${(m.billed / 100).toFixed(2)} billed</span>}
                          {m.refunded > 0 && <span className="text-[10px] text-red-400">-${(m.refunded / 100).toFixed(2)} refund</span>}
                          {m.seat_changes !== 0 && <span className="text-[10px] text-purple-400">{m.seat_changes > 0 ? "+" : ""}${(m.seat_changes / 100).toFixed(2)} seats</span>}
                          {m.deferred_released > 0 && <span className="text-[10px] text-amber-400">${(m.deferred_released / 100).toFixed(2)} released</span>}
                          <span className="text-[10px] font-medium text-white/50">net: ${(m.net / 100).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {journalEntries.length > 0 && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[11px] font-medium tracking-[0.15em] text-white/35 uppercase">
                      Revenue Journal (Recent)
                    </p>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch(`${BASE}/api/enterprise/revenue/journal?format=csv`, { headers });
                          if (res.ok) {
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = "revenue_journal_export.csv";
                            a.click();
                            URL.revokeObjectURL(url);
                          }
                        } catch {}
                      }}
                      className="text-[10px] text-indigo-400/60 hover:text-indigo-400 transition"
                    >
                      Export CSV
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {journalEntries.map((e) => (
                      <div key={e.id} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.04] rounded-lg px-4 py-2">
                        <div className="flex-1">
                          <p className="text-xs text-white/50">{e.description}</p>
                          <p className="text-[10px] text-white/20 mt-0.5">
                            {new Date(e.entry_date).toLocaleDateString()} · {e.company_name || "—"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-medium ${e.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {e.amount >= 0 ? "+" : ""}${(e.amount / 100).toFixed(2)}
                          </span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full ${
                            e.entry_type === "recognition" ? "bg-emerald-400/15 text-emerald-400" :
                            e.entry_type === "billing" ? "bg-blue-400/15 text-blue-400" :
                            e.entry_type === "seat_change" ? "bg-purple-400/15 text-purple-400" :
                            e.entry_type === "cancellation" ? "bg-red-400/15 text-red-400" :
                            e.entry_type === "refund" ? "bg-red-300/15 text-red-300" :
                            e.entry_type === "deferred_release" ? "bg-amber-400/15 text-amber-400" :
                            "bg-white/5 text-white/30"
                          }`}>
                            {e.entry_type.replace(/_/g, " ")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {invoices.length > 0 && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
                  <p className="text-[11px] font-medium tracking-[0.15em] text-white/35 uppercase mb-4">
                    Invoice History
                  </p>
                  <div className="space-y-2">
                    {invoices.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.04] rounded-lg px-4 py-3">
                        <div>
                          <p className="text-xs text-white/60">{inv.number || inv.id}</p>
                          <p className="text-[10px] text-white/30 mt-0.5">
                            {new Date(inv.created).toLocaleDateString()}
                            {inv.tax ? ` · Tax: $${(inv.tax / 100).toFixed(2)}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-medium ${inv.status === "paid" ? "text-emerald-400" : inv.status === "open" ? "text-amber-400" : "text-white/40"}`}>
                            ${(inv.total / 100).toFixed(2)}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                            inv.status === "paid" ? "bg-emerald-400/15 text-emerald-400" :
                            inv.status === "open" ? "bg-amber-400/15 text-amber-400" :
                            "bg-white/5 text-white/30"
                          }`}>
                            {inv.status}
                          </span>
                          {inv.invoice_pdf && (
                            <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer"
                               className="text-[10px] text-indigo-400/60 hover:text-indigo-400 transition">
                              PDF
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-white/20 text-xs">🔒</span>
                  <p className="text-[11px] font-medium tracking-[0.15em] text-white/35 uppercase">
                    Data Privacy
                  </p>
                </div>
                <p className="text-xs text-white/30 leading-relaxed">
                  All metrics are aggregated and anonymized. No individual biometric data
                  is accessible through this dashboard. Employee-level data is never exposed
                  to employers. Full audit trail maintained for SOC 2 compliance.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {auditLogs.length > 0 && (
          <div className="mt-14">
            <h2 className="text-sm font-medium text-white/50 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400/60" />
              Audit Log
            </h2>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.05]">
                    <th className="text-left px-5 py-3 text-[10px] text-white/30 font-medium uppercase tracking-wider">Time</th>
                    <th className="text-left px-5 py-3 text-[10px] text-white/30 font-medium uppercase tracking-wider">Action</th>
                    <th className="text-left px-5 py-3 text-[10px] text-white/30 font-medium uppercase tracking-wider">Resource</th>
                    <th className="text-left px-5 py-3 text-[10px] text-white/30 font-medium uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="border-b border-white/[0.03] hover:bg-white/[0.015] transition">
                      <td className="px-5 py-3 text-white/40 text-xs">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-white/60 text-xs">{log.action}</td>
                      <td className="px-5 py-3 text-white/40 text-xs">{log.resource}</td>
                      <td className="px-5 py-3 text-white/25 text-[11px] max-w-[200px] truncate">
                        {log.details ? JSON.stringify(log.details) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
