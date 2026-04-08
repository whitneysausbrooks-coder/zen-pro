import React, { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Globe, Wheat, Heart, Zap, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

const MEALS_PER_COMPASSION_POINT = 0.01  // 100 CP = 1 meal
const GLOBAL_GOAL_MEALS = 1_000_000

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}K`
  return String(Math.round(n))
}

interface ImpactData {
  totalCompassion: number
  mealsSimulated: number
  progressPct: number
  participantCount: number
}

export function GlobalImpactBanner({ compassionPoints }: { compassionPoints?: number }) {
  const [data, setData] = useState<ImpactData | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    fetch(`${BASE}/api/quest/leaderboard`, { credentials: "include" })
      .then(r => r.json())
      .then((rows: Array<{ compassion_points: number }>) => {
        const total = rows.reduce((s, r) => s + (r.compassion_points ?? 0), 0)
        const meals = Math.round(total * MEALS_PER_COMPASSION_POINT)
        setData({
          totalCompassion: total,
          mealsSimulated: meals,
          progressPct: Math.min((meals / GLOBAL_GOAL_MEALS) * 100, 100),
          participantCount: rows.length,
        })
      })
      .catch(() => {})
  }, [tick])

  // Live tick every 30s
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  // Optimistically include current session's CP in the display
  const displayMeals = data
    ? Math.round((data.totalCompassion + (compassionPoints ?? 0)) * MEALS_PER_COMPASSION_POINT)
    : null

  return (
    <div className="rounded-2xl overflow-hidden border border-emerald-500/20 bg-gradient-to-br from-emerald-950/60 via-emerald-900/30 to-background/60 backdrop-blur-xl p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="font-serif font-bold text-foreground text-base leading-tight">Global Abundance Mission</p>
            <p className="text-xs text-emerald-400/80">Every Compassion Point feeds the world</p>
          </div>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded-full px-2 py-1 shrink-0">
          Live
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { Icon: Wheat,      value: displayMeals !== null ? formatNumber(displayMeals) : "…", label: "Meals\nSimulated" , color: "text-amber-400" },
          { Icon: Heart,      value: data ? formatNumber(data.totalCompassion) : "…",            label: "Community\nCompassion",  color: "text-rose-400"   },
          { Icon: TrendingUp, value: data ? String(data.participantCount)      : "…",            label: "Minds\nContributing",   color: "text-emerald-400"},
        ].map(({ Icon, value, label, color }) => (
          <div key={label} className="rounded-xl bg-white/4 border border-white/5 p-3 text-center">
            <Icon className={cn("w-4 h-4 mx-auto mb-1.5", color)} />
            <div className={cn("font-serif font-bold text-lg leading-none mb-1", color)}>{value}</div>
            <div className="text-[10px] text-muted-foreground whitespace-pre-line leading-tight">{label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar to 1M meals */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Progress to 1M meals</span>
          <span className="text-emerald-400 font-semibold">{data ? data.progressPct.toFixed(3) : "0.000"}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300"
            initial={{ width: 0 }}
            animate={{ width: `${data?.progressPct ?? 0}%` }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground/70 text-center">
          100 Compassion Points = 1 simulated meal · Sponsor an impact milestone to make it real
        </p>
      </div>
    </div>
  )
}
