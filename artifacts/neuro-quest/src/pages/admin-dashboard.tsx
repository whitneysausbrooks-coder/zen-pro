import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CompanyMetrics {
  total_employees: string;
  avg_wri: string;
  avg_burnout_risk: string;
  avg_eri: string;
  avg_cps: string;
  avg_nsb: string;
  high_risk_count: string;
  moderate_risk_count: string;
  low_risk_count: string;
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
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 backdrop-blur"
    >
      <p className="text-xs font-semibold tracking-[0.15em] text-white/40 uppercase mb-2">
        {label}
      </p>
      <p className="text-3xl font-bold" style={{ color }}>
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-white/30 mt-1">{subtitle}</p>
      )}
    </motion.div>
  );
}

function RiskBar({ high, moderate, low }: { high: number; moderate: number; low: number }) {
  const total = high + moderate + low || 1;
  return (
    <div className="space-y-2">
      <div className="flex h-4 rounded-full overflow-hidden bg-white/[0.04]">
        {low > 0 && (
          <div
            className="bg-emerald-400 transition-all"
            style={{ width: `${(low / total) * 100}%` }}
          />
        )}
        {moderate > 0 && (
          <div
            className="bg-amber-400 transition-all"
            style={{ width: `${(moderate / total) * 100}%` }}
          />
        )}
        {high > 0 && (
          <div
            className="bg-red-400 transition-all"
            style={{ width: `${(high / total) * 100}%` }}
          />
        )}
      </div>
      <div className="flex justify-between text-xs text-white/40">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400" /> Low ({low})
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400" /> Moderate ({moderate})
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-400" /> High ({high})
        </span>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const [metrics, setMetrics] = useState<CompanyMetrics | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [loading, setLoading] = useState(false);

  const [apiKey, setApiKey] = useState("");

  const fetchMetrics = async (id: string) => {
    if (!id || !apiKey) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/enterprise/company/${id}/metrics`, {
        headers: { "x-enterprise-key": apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        setMetrics(data.metrics);
      } else if (res.status === 401) {
        setMetrics(null);
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
            <button
              onClick={() => { fetchMetrics(companyId); fetchAuditLogs(); }}
              disabled={loading || !companyId || !apiKey}
              className="px-6 py-3 bg-violet-500/20 border border-violet-400/30 text-violet-300 rounded-xl text-sm font-semibold hover:bg-violet-500/30 transition disabled:opacity-40"
            >
              {loading ? "Loading..." : "Load Metrics"}
            </button>
          </div>
        </div>

        {metrics && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="Total Employees"
                value={metrics.total_employees}
                color="#A78BFA"
              />
              <MetricCard
                label="Avg. WRI Score"
                value={parseFloat(metrics.avg_wri).toFixed(1)}
                subtitle="Workforce Resilience Index"
                color="#4ADE80"
              />
              <MetricCard
                label="Avg. Burnout Risk"
                value={`${parseFloat(metrics.avg_burnout_risk).toFixed(1)}%`}
                color={parseFloat(metrics.avg_burnout_risk) > 50 ? "#EF4444" : "#FBBF24"}
              />
              <MetricCard
                label="High Risk Count"
                value={metrics.high_risk_count}
                subtitle="Employees above 70% burnout"
                color="#EF4444"
              />
            </div>

            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6">
              <p className="text-xs font-semibold tracking-[0.15em] text-white/40 uppercase mb-4">
                BURNOUT RISK DISTRIBUTION
              </p>
              <RiskBar
                high={parseInt(metrics.high_risk_count)}
                moderate={parseInt(metrics.moderate_risk_count)}
                low={parseInt(metrics.low_risk_count)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard
                label="Avg. Emotional Resilience"
                value={parseFloat(metrics.avg_eri).toFixed(1)}
                color="#F472B6"
              />
              <MetricCard
                label="Avg. Cognitive Performance"
                value={parseFloat(metrics.avg_cps).toFixed(1)}
                color="#60A5FA"
              />
              <MetricCard
                label="Avg. Nervous System Balance"
                value={parseFloat(metrics.avg_nsb).toFixed(1)}
                color="#4ADE80"
              />
            </div>

            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6">
              <p className="text-xs font-semibold tracking-[0.15em] text-white/40 uppercase mb-1">
                DATA PRIVACY
              </p>
              <p className="text-sm text-white/50">
                All metrics shown are aggregated and anonymized. No individual biometric
                data is accessible through this dashboard. Employee-level data is never
                exposed to employers. Full audit trail is maintained for SOC 2 compliance.
              </p>
            </div>
          </motion.div>
        )}

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
                      <td className="px-4 py-3 text-white/40 text-xs">
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
