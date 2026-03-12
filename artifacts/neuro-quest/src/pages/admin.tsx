import React, { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { useLocation } from "wouter"
import { Zap, Users, BarChart3, ArrowLeft, Power, RefreshCw, Heart, Target } from "lucide-react"
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
  const [toggling, setToggling] = useState(false)
  const [targetInput, setTargetInput] = useState("")

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/admin/status`, { credentials: "include" })
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
      </div>
    </div>
  )
}
