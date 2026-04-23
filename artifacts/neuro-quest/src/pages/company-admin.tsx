import React, { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  Building2, LogOut, Loader2, Users, Calendar, Activity, Mail,
  Trash2, Copy, CheckCircle2, AlertCircle, ShieldAlert, TrendingUp,
} from "lucide-react"
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card"
import { LuxuryButton } from "@/components/ui/luxury-button"
import { useToast } from "@/hooks/use-toast"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")
const TOKEN_KEY = "nq_company_admin_token"

interface MeResponse {
  company_id: string
  company_name: string
  industry: string | null
  invite_code: string
  admin_email: string
  seats_used: number
  seats_total: number
  pilot_status: string
  pilot_started_at: string | null
  pilot_ends_at: string | null
  pilot_days_remaining: number | null
  subscription_status: string
  branding: { primary_color: string; logo_url: string | null }
  join_url: string
}

interface TeamMember {
  id: string
  email: string
  department: string
  role: string
  joined_at: string
  last_login: string | null
  activity_count: number
  last_activity: string | null
}

interface WellnessSummary {
  privacy_threshold_met: boolean
  threshold?: number
  total_employees: number
  message?: string
  active_users_30d?: number
  total_checkins_30d?: number
  avg_mood_30d?: number | null
  avg_engagement_30d?: number | null
  participation_rate?: number
  trend_14d?: Array<{ day: string; avg_mood: string; avg_engagement: string; checkins: number }>
}

export default function CompanyAdminPage() {
  const { toast } = useToast()
  const [token, setToken] = useState<string>(() => {
    if (typeof window === "undefined") return ""
    try { return localStorage.getItem(TOKEN_KEY) || "" } catch { return "" }
  })
  const [loginEmail, setLoginEmail] = useState("")
  const [loginCode, setLoginCode] = useState("")
  const [loginLoading, setLoginLoading] = useState(false)
  const [me, setMe] = useState<MeResponse | null>(null)
  const [team, setTeam] = useState<TeamMember[]>([])
  const [wellness, setWellness] = useState<WellnessSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<"overview" | "team" | "wellness">("overview")

  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    "x-company-admin-token": token,
  }), [token])

  const loadAll = async () => {
    if (!token) return
    setLoading(true)
    try {
      const [meRes, teamRes, wellRes] = await Promise.all([
        fetch(`${BASE}/api/company-admin/me`, { headers }),
        fetch(`${BASE}/api/company-admin/team`, { headers }),
        fetch(`${BASE}/api/company-admin/wellness-summary`, { headers }),
      ])
      if (meRes.status === 401) {
        try { localStorage.removeItem(TOKEN_KEY) } catch {}
        setToken("")
        toast({ title: "Session expired", description: "Please log in again.", variant: "destructive" })
        return
      }
      const meData = await meRes.json()
      const teamData = await teamRes.json()
      const wellData = await wellRes.json()
      setMe(meData)
      setTeam(teamData.team || [])
      setWellness(wellData)
    } catch (err) {
      toast({ title: "Failed to load dashboard", description: String(err), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (token) loadAll() }, [token])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginEmail || !loginCode) {
      toast({ title: "Missing info", description: "Enter both your email and company code.", variant: "destructive" })
      return
    }
    setLoginLoading(true)
    try {
      const res = await fetch(`${BASE}/api/company-admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_email: loginEmail, invite_code: loginCode.toUpperCase() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Login failed", description: data.error || "Try again.", variant: "destructive" })
        return
      }
      try { localStorage.setItem(TOKEN_KEY, data.token) } catch {}
      setToken(data.token)
      toast({ title: `Welcome to ${data.company_name}`, description: "You're logged in." })
    } catch (err) {
      toast({ title: "Login error", description: String(err), variant: "destructive" })
    } finally {
      setLoginLoading(false)
    }
  }

  const handleLogout = () => {
    try { localStorage.removeItem(TOKEN_KEY) } catch {}
    setToken(""); setMe(null); setTeam([]); setWellness(null)
  }

  const handleRemove = async (userId: string, email: string) => {
    if (!confirm(`Remove ${email} from your team? They will lose access.`)) return
    try {
      const res = await fetch(`${BASE}/api/company-admin/team/${userId}`, {
        method: "DELETE", headers,
      })
      if (!res.ok) {
        const d = await res.json()
        toast({ title: "Failed to remove", description: d.error, variant: "destructive" })
        return
      }
      toast({ title: "Employee removed", description: email })
      loadAll()
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" })
    }
  }

  const copyInvite = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: "Copied to clipboard" })
  }

  // ---------- LOGIN VIEW ----------
  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1830] to-[#2d2b55] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <GlassCard>
            <GlassCardContent className="p-8 space-y-6">
              <div className="text-center space-y-2">
                <Building2 className="w-12 h-12 mx-auto text-[#FFD700]" />
                <h1 className="text-2xl font-bold text-white">HR Admin Portal</h1>
                <p className="text-sm text-white/70">
                  Monitor your team's wellness program. Employees never see this page.
                </p>
              </div>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-white/80 mb-1 block">YOUR ADMIN EMAIL</label>
                  <input
                    type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="hr@yourcompany.com" required
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-[#FFD700]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-white/80 mb-1 block">COMPANY CODE</label>
                  <input
                    type="text" value={loginCode} onChange={(e) => setLoginCode(e.target.value.toUpperCase())}
                    placeholder="ABCD1234" required maxLength={12}
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-[#FFD700] font-mono tracking-wider uppercase"
                  />
                  <p className="text-xs text-white/50 mt-1">Same code your employees use to join.</p>
                </div>
                <LuxuryButton type="submit" disabled={loginLoading} className="w-full">
                  {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
                </LuxuryButton>
              </form>
              <p className="text-xs text-white/50 text-center">
                Don't have access? Your account admin email was set during onboarding.
                Contact NeuroQuest support if you need it changed.
              </p>
            </GlassCardContent>
          </GlassCard>
        </motion.div>
      </div>
    )
  }

  // ---------- DASHBOARD ----------
  if (loading || !me) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1830] to-[#2d2b55] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    )
  }

  const pilotExpiringSoon = me.pilot_days_remaining !== null && me.pilot_days_remaining <= 14

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1830] to-[#2d2b55] p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">{me.company_name}</h1>
            <p className="text-white/60 text-sm">HR Admin Dashboard · Logged in as {me.admin_email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>

        {/* Pilot status banner */}
        {me.pilot_status === "active" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-xl border ${pilotExpiringSoon ? "bg-amber-500/10 border-amber-500/30" : "bg-emerald-500/10 border-emerald-500/30"}`}
          >
            <div className="flex items-center gap-3">
              {pilotExpiringSoon ? <AlertCircle className="w-5 h-5 text-amber-400" /> : <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              <div className="flex-1">
                <p className="text-white font-semibold">
                  Free Pilot · {me.pilot_days_remaining} days remaining
                </p>
                <p className="text-white/60 text-sm">
                  {pilotExpiringSoon
                    ? "Your pilot is ending soon. Contact your account manager to continue."
                    : `Pilot ends ${me.pilot_ends_at ? new Date(me.pilot_ends_at).toLocaleDateString() : "—"}.`}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/10">
          {[
            { id: "overview", label: "Overview", icon: Building2 },
            { id: "team", label: `Team (${team.length})`, icon: Users },
            { id: "wellness", label: "Wellness", icon: Activity },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as typeof tab)}
              className={`px-4 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition ${
                tab === t.id ? "text-[#FFD700] border-[#FFD700]" : "text-white/60 border-transparent hover:text-white"
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <GlassCard><GlassCardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-5 h-5 text-[#FFD700]" />
                <span className="text-white/70 text-sm">SEATS USED</span>
              </div>
              <p className="text-3xl font-bold text-white">{me.seats_used} <span className="text-white/40 text-lg">/ {me.seats_total}</span></p>
              <p className="text-xs text-white/50 mt-2">{me.seats_total - me.seats_used} seats available</p>
            </GlassCardContent></GlassCard>

            <GlassCard><GlassCardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="w-5 h-5 text-[#FFD700]" />
                <span className="text-white/70 text-sm">DAYS REMAINING</span>
              </div>
              <p className="text-3xl font-bold text-white">{me.pilot_days_remaining ?? "—"}</p>
              <p className="text-xs text-white/50 mt-2">{me.pilot_status === "active" ? "Free pilot active" : me.subscription_status}</p>
            </GlassCardContent></GlassCard>

            <GlassCard><GlassCardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Mail className="w-5 h-5 text-[#FFD700]" />
                <span className="text-white/70 text-sm">SHARE WITH TEAM</span>
              </div>
              <p className="font-mono text-xl text-white tracking-wider">{me.invite_code}</p>
              <button onClick={() => copyInvite(`Join NeuroQuest at ${me.join_url} — Code: ${me.invite_code}`)}
                className="mt-2 text-xs text-[#FFD700] hover:underline flex items-center gap-1">
                <Copy className="w-3 h-3" /> Copy invite message
              </button>
            </GlassCardContent></GlassCard>
          </div>
        )}

        {/* Team Roster */}
        {tab === "team" && (
          <GlassCard><GlassCardContent className="p-0">
            {team.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-white/30 mx-auto mb-3" />
                <p className="text-white/70">No employees have joined yet.</p>
                <p className="text-white/50 text-sm mt-2">
                  Share invite code <span className="font-mono text-[#FFD700]">{me.invite_code}</span> with your team.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-white/60 border-b border-white/10">
                      <th className="p-4">EMAIL</th>
                      <th className="p-4">DEPT</th>
                      <th className="p-4">JOINED</th>
                      <th className="p-4">ACTIVITY</th>
                      <th className="p-4 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.map((m) => (
                      <tr key={m.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="p-4 text-white text-sm">{m.email}</td>
                        <td className="p-4 text-white/70 text-sm">{m.department}</td>
                        <td className="p-4 text-white/60 text-sm">{new Date(m.joined_at).toLocaleDateString()}</td>
                        <td className="p-4 text-white/60 text-sm">
                          {m.activity_count > 0 ? `${m.activity_count} check-ins` : <span className="text-white/40">—</span>}
                        </td>
                        <td className="p-4 text-right">
                          <button onClick={() => handleRemove(m.id, m.email)}
                            className="text-rose-400 hover:text-rose-300 text-sm inline-flex items-center gap-1">
                            <Trash2 className="w-3 h-3" /> Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCardContent></GlassCard>
        )}

        {/* Wellness */}
        {tab === "wellness" && wellness && (
          <div className="space-y-4">
            {!wellness.privacy_threshold_met ? (
              <GlassCard><GlassCardContent className="p-8 text-center">
                <ShieldAlert className="w-10 h-10 text-[#FFD700] mx-auto mb-3" />
                <p className="text-white font-semibold mb-2">Privacy Threshold</p>
                <p className="text-white/70">{wellness.message}</p>
                <p className="text-white/50 text-xs mt-3">
                  To protect employee privacy, individual scores are never shown.
                  Aggregate metrics require {wellness.threshold || 5}+ active employees.
                </p>
              </GlassCardContent></GlassCard>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <GlassCard><GlassCardContent className="p-5">
                    <p className="text-xs text-white/60 mb-1">PARTICIPATION (30d)</p>
                    <p className="text-2xl font-bold text-white">{wellness.participation_rate}%</p>
                    <p className="text-xs text-white/50 mt-1">{wellness.active_users_30d} of {wellness.total_employees} active</p>
                  </GlassCardContent></GlassCard>
                  <GlassCard><GlassCardContent className="p-5">
                    <p className="text-xs text-white/60 mb-1">CHECK-INS (30d)</p>
                    <p className="text-2xl font-bold text-white">{wellness.total_checkins_30d}</p>
                  </GlassCardContent></GlassCard>
                  <GlassCard><GlassCardContent className="p-5">
                    <p className="text-xs text-white/60 mb-1">AVG MOOD (1-10)</p>
                    <p className="text-2xl font-bold text-white">{wellness.avg_mood_30d?.toFixed(1) ?? "—"}</p>
                  </GlassCardContent></GlassCard>
                  <GlassCard><GlassCardContent className="p-5">
                    <p className="text-xs text-white/60 mb-1">AVG ENGAGEMENT</p>
                    <p className="text-2xl font-bold text-white">{wellness.avg_engagement_30d?.toFixed(0) ?? "—"}</p>
                  </GlassCardContent></GlassCard>
                </div>
                <GlassCard><GlassCardContent className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-[#FFD700]" />
                    <p className="text-white/80 text-sm font-semibold">14-DAY TREND</p>
                  </div>
                  {wellness.trend_14d && wellness.trend_14d.length > 0 ? (
                    <div className="space-y-2">
                      {wellness.trend_14d.map((d) => (
                        <div key={d.day} className="flex items-center gap-3 text-sm">
                          <span className="text-white/60 w-24">{new Date(d.day).toLocaleDateString()}</span>
                          <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-[#FFD700] to-[#FFA500]"
                              style={{ width: `${Math.min(100, parseFloat(d.avg_engagement) || 0)}%` }} />
                          </div>
                          <span className="text-white/70 text-xs w-20 text-right">
                            mood {parseFloat(d.avg_mood).toFixed(1)} · {d.checkins} ✓
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-white/60 text-sm">No activity in the last 14 days yet.</p>
                  )}
                </GlassCardContent></GlassCard>
                <p className="text-xs text-white/40 text-center">
                  All wellness metrics are aggregated across your team. Individual scores are never shown to protect employee privacy.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
