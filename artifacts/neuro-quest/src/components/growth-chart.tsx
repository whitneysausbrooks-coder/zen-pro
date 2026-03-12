import React, { useEffect, useState } from "react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts"
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { TrendingUp, Brain, Heart } from "lucide-react"
import { cn } from "@/lib/utils"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

interface DayStat {
  date: string
  neural_energy: number
  compassion_points: number
  label: string
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function formatDay(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00Z")
  return DAYS[d.getUTCDay()]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0D1A10]/90 border border-white/10 rounded-xl px-3 py-2.5 text-xs shadow-xl backdrop-blur-md">
      <p className="font-semibold text-white/70 mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-0.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-white/60">{p.name}:</span>
          <span className="font-bold text-white">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export function GrowthChart() {
  const [data, setData] = useState<DayStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${BASE}/api/quest/growth-stats`, { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        setData((d.days ?? []).map((day: any) => ({
          ...day,
          label: formatDay(day.date),
        })))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const hasActivity = data.some(d => d.neural_energy > 0 || d.compassion_points > 0)

  return (
    <GlassCard>
      <GlassCardHeader>
        <GlassCardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="w-4 h-4 text-primary" />
          7-Day Cognitive Growth
        </GlassCardTitle>
      </GlassCardHeader>
      <GlassCardContent className="px-4 pb-6">
        {loading ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : !hasActivity ? (
          <div className="h-40 flex flex-col items-center justify-center gap-2 text-center">
            <Brain className="w-8 h-8 text-primary/30" />
            <p className="text-muted-foreground text-sm">Play games to build your growth chart.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 rounded-full bg-[#D4AF37]" />
                <span>Neural Energy</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 rounded-full bg-rose-400" />
                <span>Compassion</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradEnergy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradCompassion" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fb7185" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#fb7185" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="neural_energy"
                  name="Neural Energy"
                  stroke="#D4AF37"
                  strokeWidth={2}
                  fill="url(#gradEnergy)"
                  dot={{ fill: "#D4AF37", strokeWidth: 0, r: 3 }}
                  activeDot={{ r: 5, fill: "#D4AF37" }}
                />
                <Area
                  type="monotone"
                  dataKey="compassion_points"
                  name="Compassion"
                  stroke="#fb7185"
                  strokeWidth={2}
                  fill="url(#gradCompassion)"
                  dot={{ fill: "#fb7185", strokeWidth: 0, r: 3 }}
                  activeDot={{ r: 5, fill: "#fb7185" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </>
        )}
      </GlassCardContent>
    </GlassCard>
  )
}
