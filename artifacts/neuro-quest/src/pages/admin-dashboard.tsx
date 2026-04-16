import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface TrendDay {
  day: string;
  avg_wri: string;
  avg_burnout_risk: string;
  avg_cohesion: string;
}

interface DashboardData {
  view: "executive" | "manager";
  avg_wri: number;
  avg_burnout_risk: number;
  total_employees: number;
  burnout_severity: "low" | "moderate" | "high" | "critical";
  burnout_alert: string | null;
  trend_7d: TrendDay[];
  high_risk_employees?: number;
  high_risk_label?: string;
  team_cohesion?: number;
  cohesion_delta?: number;
  cohesion_label?: string;
}

interface AuditEntry {
  id: string;
  user_id: string | null;
  action: string;
  resource: string;
  details: Record<string, any> | null;
  created_at: string;
}

function MetricCard({
  label,
  value,
  subtitle,
  color,
  badge,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  color: string;
  badge?: { text: string; color: string };
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 backdrop-blur"
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold tracking-[0.15em] text-white/40 uppercase mb-2">
          {label}
        </p>
        {badge && (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
            style={{ backgroundColor: badge.color + "22", color: badge.color }}
          >
            {badge.text}
          </span>
        )}
      </div>
      <p className="text-3xl font-bold" style={{ color }}>
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-white/30 mt-1">{subtitle}</p>
      )}
    </motion.div>
  );
}

function TrendChart({ data }: { data: TrendDay[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-white/30 text-sm">
        No trend data available for the last 7 days
      </div>
    );
  }

  const maxWri = 100;
  const chartHeight = 140;

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-1 h-[140px]">
        {data.map((d, i) => {
          const wri = parseFloat(d.avg_wri);
          const burnout = parseFloat(d.avg_burnout_risk);
          const wriH = (wri / maxWri) * chartHeight;
          const burnoutH = (burnout / maxWri) * chartHeight;
          return (
            <div key={i} className="flex-1 flex gap-0.5 items-end h-full group relative">
              <div
                className="flex-1 rounded-t bg-emerald-400/60 transition-all hover:bg-emerald-400/80"
                style={{ height: `${wriH}px` }}
              />
              <div
                className="flex-1 rounded-t bg-red-400/40 transition-all hover:bg-red-400/60"
                style={{ height: `${burnoutH}px` }}
              />
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                WRI: {wri.toFixed(1)} · Burn: {burnout.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-1">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-white/30">
            {new Date(d.day).toLocaleDateString("en", { weekday: "short" })}
          </div>
        ))}
      </div>
      <div className="flex gap-4 justify-center text-xs text-white/40">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400/60" /> WRI
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-400/40" /> Burnout Risk
        </span>
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    low: "#4ADE80",
    moderate: "#FBBF24",
    high: "#F97316",
    critical: "#EF4444",
  };
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
      style={{
        backgroundColor: (colors[severity] || "#999") + "18",
        color: colors[severity] || "#999",
        border: `1px solid ${colors[severity] || "#999"}33`,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors[severity] }} />
      {severity}
    </span>
  );
}

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<"executive" | "manager">("executive");

  const fetchDashboard = async (id: string, view: "executive" | "manager") => {
    if (!id || !apiKey) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/enterprise/company/${id}/dashboard?view=${view}`, {
        headers: { "x-enterprise-key": apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        setDashboard(data);
      } else if (res.status === 401) {
        setDashboard(null);
        alert("Invalid API key");
      }
    } catch {}
    setLoading(false);
  };

  const fetchAuditLogs = async () => {
    if (!apiKey) return;
    try {
      const res = await fetch(`${BASE}/api/enterprise/audit-log?limit=20`, {
        headers: { "x-enterprise-key": apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch {}
  };

  const loadAll = (view: "executive" | "manager") => {
    setActiveView(view);
    fetchDashboard(companyId, view);
    fetchAuditLogs();
  };

  return (
    <div className="min-h-screen bg-[#060B07] text-white">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-violet-400 uppercase mb-1">
              ENTERPRISE ADMIN
            </p>
            <h1 className="text-3xl font-bold text-white">
              Workforce Resilience Dashboard
            </h1>
          </div>
          <button
            onClick={() => navigate("/")}
            className="text-sm text-white/40 hover:text-white/70 transition"
          >
            ← Back
          </button>
        </div>

        <div className="mb-8 space-y-3">
          <div>
            <label className="text-xs text-white/40 mb-1 block">Enterprise API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter enterprise API key..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-400/40"
            />
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-white/40 mb-1 block">Company ID</label>
              <input
                type="text"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                placeholder="Enter company UUID..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-400/40"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => loadAll("executive")}
                disabled={loading || !companyId || !apiKey}
                className={`px-5 py-3 rounded-xl text-sm font-semibold transition disabled:opacity-40 ${
                  activeView === "executive"
                    ? "bg-violet-500/30 border border-violet-400/40 text-violet-200"
                    : "bg-white/[0.04] border border-white/[0.08] text-white/50 hover:text-white/70"
                }`}
              >
                Executive View
              </button>
              <button
                onClick={() => loadAll("manager")}
                disabled={loading || !companyId || !apiKey}
                className={`px-5 py-3 rounded-xl text-sm font-semibold transition disabled:opacity-40 ${
                  activeView === "manager"
                    ? "bg-violet-500/30 border border-violet-400/40 text-violet-200"
                    : "bg-white/[0.04] border border-white/[0.08] text-white/50 hover:text-white/70"
                }`}
              >
                Manager View
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {dashboard && (
            <motion.div
              key={dashboard.view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              {dashboard.burnout_alert && (
                <div
                  className="rounded-xl p-4 border flex items-start gap-3"
                  style={{
                    borderColor: dashboard.burnout_severity === "critical" ? "#EF444444" : "#F9731644",
                    backgroundColor: dashboard.burnout_severity === "critical" ? "#EF44440A" : "#F973160A",
                  }}
                >
                  <span className="text-lg">⚠️</span>
                  <div>
                    <p className="text-sm font-semibold text-white/80">{dashboard.burnout_alert}</p>
                    <div className="mt-1">
                      <SeverityBadge severity={dashboard.burnout_severity} />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  label="Total Employees"
                  value={dashboard.total_employees}
                  color="#A78BFA"
                />
                <MetricCard
                  label="Avg. WRI Score"
                  value={dashboard.avg_wri.toFixed(1)}
                  subtitle="Workforce Resilience Index"
                  color="#4ADE80"
                />
                <MetricCard
                  label="Avg. Burnout Risk"
                  value={`${dashboard.avg_burnout_risk.toFixed(1)}%`}
                  color={dashboard.avg_burnout_risk > 50 ? "#EF4444" : "#FBBF24"}
                  badge={{
                    text: dashboard.burnout_severity,
                    color: dashboard.burnout_severity === "critical" ? "#EF4444" : dashboard.burnout_severity === "high" ? "#F97316" : dashboard.burnout_severity === "moderate" ? "#FBBF24" : "#4ADE80",
                  }}
                />
                {dashboard.view === "manager" && dashboard.high_risk_employees !== undefined && (
                  <MetricCard
                    label="High Risk Employees"
                    value={dashboard.high_risk_label || "0"}
                    subtitle="Above 70% burnout threshold"
                    color="#EF4444"
                  />
                )}
                {dashboard.view === "executive" && (
                  <MetricCard
                    label="Burnout Severity"
                    value={dashboard.burnout_severity.toUpperCase()}
                    color={dashboard.burnout_severity === "critical" ? "#EF4444" : dashboard.burnout_severity === "high" ? "#F97316" : dashboard.burnout_severity === "moderate" ? "#FBBF24" : "#4ADE80"}
                  />
                )}
              </div>

              {dashboard.view === "manager" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <MetricCard
                    label="Team Cohesion"
                    value={dashboard.team_cohesion?.toFixed(1) || "—"}
                    color="#60A5FA"
                  />
                  <MetricCard
                    label="Cohesion Change"
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

              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6">
                <p className="text-xs font-semibold tracking-[0.15em] text-white/40 uppercase mb-4">
                  7-DAY TREND
                </p>
                <TrendChart data={dashboard.trend_7d} />
              </div>

              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6">
                <p className="text-xs font-semibold tracking-[0.15em] text-white/40 uppercase mb-1">
                  DATA PRIVACY
                </p>
                <p className="text-sm text-white/50">
                  All metrics are aggregated and anonymized. No individual biometric
                  data is accessible through this dashboard. Employee-level data is never
                  exposed to employers. Full audit trail maintained for SOC 2 compliance.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-12">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-violet-400" />
            Audit Log
          </h2>
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
            {auditLogs.length === 0 ? (
              <p className="text-sm text-white/30 p-6 text-center">No audit entries yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left px-4 py-3 text-xs text-white/40 font-semibold">Time</th>
                    <th className="text-left px-4 py-3 text-xs text-white/40 font-semibold">Action</th>
                    <th className="text-left px-4 py-3 text-xs text-white/40 font-semibold">Resource</th>
                    <th className="text-left px-4 py-3 text-xs text-white/40 font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-white/50">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-white/70">{log.action}</td>
                      <td className="px-4 py-3 text-white/50">{log.resource}</td>
                      <td className="px-4 py-3 text-white/40 text-xs max-w-xs truncate">
                        {log.details ? JSON.stringify(log.details) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
