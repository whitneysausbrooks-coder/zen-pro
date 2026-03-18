import React, { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { useLocation } from "wouter"
import { Zap, Users, BarChart3, ArrowLeft, Power, RefreshCw, Heart, Target, Bell, Send, Key, Clock, Crown } from "lucide-react"
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { LuxuryButton } from "@/components/ui/luxury-button"
import { useToast } from "@/hooks/use-toast"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

interface AdminStatus {
  raid_mode_active: boolean
  raid_mode_target: number
  community_wins: number
  raid_started_at: string | null
}

export default function AdminPanel() {
  const [, navigate] = useLocation()
  const { toast } = useToast()
  const [status, setStatus] = useState<AdminStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [targetInput, setTargetInput] = useState("")
  const [sending, setSending] = useState(false)
  const [nudgeResult, setNudgeResult] = useState<{ sent: number; failed: number; total_subs: number } | null>(null)
  const [grantSessionId, setGrantSessionId] = useState("")
  const [grantHours, setGrantHours] = useState("24")
  const [granting, setGranting] = useState(false)
  const [grantResult, setGrantResult] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/admin/status`, { credentials: "include" })
      if (r.status === 403 || r.status === 401) {
        setUnauthorized(true)
        setLoading(false)
        return
      }
      if (r.ok) {
        const data = await r.json()
        setStatus(data)
        setTargetInput(String(data.raid_mode_target))
      }
    } catch (_) {}
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchStatus()
    const id = setInterval(fetchStatus, 10_000)
    return () => clearInterval(id)
  }, [fetchStatus])

  async function sendNudgeCampaign() {
    setSending(true)
    setNudgeResult(null)
    try {
      const r = await fetch(`${BASE}/api/admin/send-nudge`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_url: window.location.origin }),
      })
      if (r.ok) {
        const data = await r.json()
        setNudgeResult(data)
        toast({
          title: `Nudge campaign sent`,
          description: `${data.sent} delivered · ${data.failed} failed`,
        })
      }
    } catch (_) {
      toast({ title: "Error", description: "Failed to send nudge campaign.", variant: "destructive" })
    }
    setSending(false)
  }

  async function grantDailyPass() {
    if (!grantSessionId.trim()) {
      toast({ title: "Session ID required", variant: "destructive" })
      return
    }
    setGranting(true)
    setGrantResult(null)
    try {
      const r = await fetch(`${BASE}/api/admin/grant-daily-pass`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: grantSessionId.trim(), hours: Number(grantHours) || 24 }),
      })
      const data = await r.json()
      if (r.ok) {
        setGrantResult(`✓ Daily Pass granted — expires ${new Date(data.daily_pass_expires).toLocaleString()}`)
        toast({ title: "Daily Pass granted!", description: `Session ${grantSessionId.slice(0, 8)}… now has ${grantHours}h access` })
        setGrantSessionId("")
      } else {
        setGrantResult(`✗ Error: ${data.error}`)
        toast({ title: "Error", description: data.error, variant: "destructive" })
      }
    } catch (_) {
      toast({ title: "Error", description: "Request failed.", variant: "destructive" })
    }
    setGranting(false)
  }

  async function grantPro() {
    if (!grantSessionId.trim()) {
      toast({ title: "Session ID required", variant: "destructive" })
      return
    }
    setGranting(true)
    setGrantResult(null)
    try {
      const r = await fetch(`${BASE}/api/admin/grant-pro`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: grantSessionId.trim() }),
      })
      const data = await r.json()
      if (r.ok) {
        setGrantResult(`✓ Zen Pro granted to session ${grantSessionId.slice(0, 8)}…`)
        toast({ title: "Zen Pro granted!" })
        setGrantSessionId("")
      } else {
        setGrantResult(`✗ Error: ${data.error}`)
        toast({ title: "Error", description: data.error, variant: "destructive" })
      }
    } catch (_) {
      toast({ title: "Error", description: "Request failed.", variant: "destructive" })
    }
    setGranting(false)
  }

  async function toggleRaidMode(activate: boolean) {
    setToggling(true)
    try {
      const target = Number(targetInput) > 0 ? Number(targetInput) : 100
      const r = await fetch(`${BASE}/api/admin/raid-mode`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activate, target }),
      })
      if (r.ok) {
        await fetchStatus()
        toast({
          title: activate ? "⚡ Raid Mode ACTIVATED" : "Raid Mode deactivated",
          description: activate
            ? "Compassion Points are now doubled for all players!"
            : "Rewards returned to normal.",
        })
      }
    } catch (_) {
      toast({ title: "Error", description: "Failed to toggle Raid Mode.", variant: "destructive" })
    }
    setToggling(false)
  }

  const progress = status ? Math.min(status.community_wins / status.raid_mode_target, 1) : 0
  const pct = Math.round(progress * 100)

  if (unauthorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="text-6xl">🔒</div>
        <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
        <p className="text-muted-foreground max-w-sm">
          You do not have permission to view this page. Admin access is restricted.
        </p>
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-primary hover:underline text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto">
      {/* Back */}
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </button>

      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Internal Admin</span>
          </div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage live events and community settings.</p>
        </div>

        {/* Community Stats */}
        <GlassCard>
          <GlassCardHeader>
            <div className="flex items-center justify-between">
              <GlassCardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" /> Live Stats
              </GlassCardTitle>
              <button onClick={fetchStatus} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-muted-foreground hover:text-foreground">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </GlassCardHeader>
          <GlassCardContent className="pt-0 pb-5 px-5">
            {loading ? (
              <div className="text-muted-foreground text-sm animate-pulse">Loading stats…</div>
            ) : status ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/3 rounded-xl p-4 border border-white/8">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Heart className="w-3 h-3 text-rose-400" /> Community Wins
                  </p>
                  <p className="text-3xl font-bold font-serif text-foreground">{status.community_wins.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">total compassion activities</p>
                </div>
                <div className="bg-white/3 rounded-xl p-4 border border-white/8">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Target className="w-3 h-3 text-violet-400" /> Raid Target
                  </p>
                  <p className="text-3xl font-bold font-serif text-foreground">{status.raid_mode_target.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">community wins goal</p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Could not load stats.</p>
            )}
          </GlassCardContent>
        </GlassCard>

        {/* Raid Mode Control */}
        <GlassCard className={status?.raid_mode_active ? "border-violet-400/40" : ""}>
          <GlassCardHeader>
            <GlassCardTitle className="text-lg flex items-center gap-2">
              <Zap className={`w-5 h-5 ${status?.raid_mode_active ? "text-violet-400" : "text-muted-foreground"}`} />
              Raid Mode
            </GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent className="pt-0 pb-6 px-5 space-y-5">
            {/* Status badge */}
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${
              status?.raid_mode_active
                ? "bg-violet-400/15 border-violet-400/40 text-violet-300"
                : "bg-white/5 border-white/10 text-muted-foreground"
            }`}>
              <span className={`w-2 h-2 rounded-full ${status?.raid_mode_active ? "bg-violet-400 animate-pulse" : "bg-muted-foreground/40"}`} />
              {status?.raid_mode_active ? "ACTIVE — 2× Compassion Points" : "INACTIVE"}
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              When active, all Compassion Point rewards are doubled globally and a live progress banner appears on every player's dashboard.
            </p>

            {/* Progress preview */}
            {status && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Community progress</span>
                  <span className="font-semibold tabular-nums">{status.community_wins} / {status.raid_mode_target}</span>
                </div>
                <div className="h-2.5 rounded-full bg-white/5 border border-white/8 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
              </div>
            )}

            {/* Target input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Users className="w-3 h-3" /> Community Target (wins)
              </label>
              <input
                type="number"
                min={1}
                value={targetInput}
                onChange={e => setTargetInput(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-violet-400/50 focus:outline-none focus:ring-1 focus:ring-violet-400/30 text-foreground text-sm transition-colors"
              />
            </div>

            {/* Toggle button */}
            <LuxuryButton
              className={`w-full gap-2 ${
                status?.raid_mode_active
                  ? "bg-rose-500/20 border-rose-400/40 hover:bg-rose-500/30 text-rose-200"
                  : "bg-violet-500/20 border-violet-400/40 hover:bg-violet-500/30 text-violet-200"
              }`}
              disabled={toggling || loading}
              onClick={() => toggleRaidMode(!status?.raid_mode_active)}
            >
              <Power className="w-4 h-4" />
              {toggling
                ? "Updating…"
                : status?.raid_mode_active
                  ? "Deactivate Raid Mode"
                  : "Activate Raid Mode"}
            </LuxuryButton>

            {status?.raid_started_at && (
              <p className="text-xs text-muted-foreground text-center">
                Started: {new Date(status.raid_started_at).toLocaleString()}
              </p>
            )}
          </GlassCardContent>
        </GlassCard>
        {/* Nudge Campaign */}
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle className="text-lg flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" /> Nudge Campaign
            </GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent className="pt-0 pb-6 px-5 space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Sends a personalized push notification to every subscribed player who hasn't played in the last 24 hours. Messages mention their Brain Health Level and progress toward the next rank.
            </p>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: "Progress-based", desc: "% to next level" },
                { label: "Level-aware", desc: "Uses their title" },
                { label: "Anti-spam", desc: "24h inactive only" },
              ].map(({ label, desc }) => (
                <div key={label} className="bg-white/3 rounded-xl p-3 border border-white/8">
                  <p className="text-xs font-bold text-foreground">{label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-primary/5 border border-primary/15 px-4 py-3 text-xs text-muted-foreground italic leading-relaxed">
              Example: "Your focus score is 5% away from Luminary. Ready to hit the floor?"
            </div>
            {nudgeResult && (
              <div className="flex gap-4 text-sm">
                <span className="text-emerald-400 font-semibold">✓ {nudgeResult.sent} delivered</span>
                {nudgeResult.failed > 0 && <span className="text-rose-400">{nudgeResult.failed} failed</span>}
                <span className="text-muted-foreground">({nudgeResult.total_subs} total subscribers)</span>
              </div>
            )}
            <LuxuryButton
              className="w-full gap-2 bg-primary/15 border-primary/35 hover:bg-primary/25 text-primary"
              disabled={sending}
              onClick={sendNudgeCampaign}
            >
              <Send className="w-4 h-4" />
              {sending ? "Sending nudges…" : "Send Nudge Campaign"}
            </LuxuryButton>
          </GlassCardContent>
        </GlassCard>

        {/* Grant Access Panel */}
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle className="flex items-center gap-2 text-base">
              <Key className="w-5 h-5 text-primary" /> Grant Access
            </GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent className="pt-0 pb-6 px-5 space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              After a player pays via CashApp or Bitcoin, paste their <code className="text-xs bg-white/8 px-1 py-0.5 rounded text-primary">nq_session</code> cookie value here to activate their access. They can find it in browser DevTools → Application → Cookies.
            </p>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Session ID</label>
              <input
                type="text"
                value={grantSessionId}
                onChange={e => setGrantSessionId(e.target.value)}
                placeholder="Paste session ID from player's nq_session cookie"
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/12 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 focus:bg-white/8 transition-all font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Daily Pass Duration (hours)</label>
              <input
                type="number"
                value={grantHours}
                onChange={e => setGrantHours(e.target.value)}
                min="1"
                max="720"
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/12 text-sm text-foreground focus:outline-none focus:border-primary/40 transition-all"
              />
            </div>

            {grantResult && (
              <div className={`px-4 py-3 rounded-xl text-sm font-semibold border ${
                grantResult.startsWith("✓")
                  ? "bg-emerald-500/10 border-emerald-400/25 text-emerald-300"
                  : "bg-rose-500/10 border-rose-400/25 text-rose-300"
              }`}>
                {grantResult}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <LuxuryButton
                className="gap-2 bg-amber-400/12 border-amber-400/30 hover:bg-amber-400/22 text-amber-300"
                disabled={granting}
                onClick={grantDailyPass}
              >
                <Clock className="w-4 h-4" />
                {granting ? "Granting…" : "Grant Daily Pass"}
              </LuxuryButton>
              <LuxuryButton
                className="gap-2 bg-primary/12 border-primary/30 hover:bg-primary/22 text-primary"
                disabled={granting}
                onClick={grantPro}
              >
                <Crown className="w-4 h-4" />
                {granting ? "Granting…" : "Grant Zen Pro"}
              </LuxuryButton>
            </div>
          </GlassCardContent>
        </GlassCard>

      </div>
    </div>
  )
}
