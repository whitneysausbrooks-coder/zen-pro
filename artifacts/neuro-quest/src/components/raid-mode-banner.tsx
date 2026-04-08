import React, { useState, useEffect, useCallback } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Zap, Users, Heart } from "lucide-react"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

interface EventData {
  raid_mode_active: boolean
  raid_mode_target: number
  community_wins: number
  raid_started_at: string | null
}

export function RaidModeBanner() {
  const [event, setEvent] = useState<EventData | null>(null)

  const fetchEvent = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/quest/event`, { credentials: "include" })
      if (r.ok) setEvent(await r.json())
    } catch (_) {}
  }, [])

  useEffect(() => {
    fetchEvent()
    const id = setInterval(fetchEvent, 15_000)
    return () => clearInterval(id)
  }, [fetchEvent])

  if (!event?.raid_mode_active) return null

  const progress = Math.min(event.community_wins / event.raid_mode_target, 1)
  const pct = Math.round(progress * 100)

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="rounded-2xl border border-violet-400/40 bg-violet-500/8 p-5"
      >
        <div className="space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-violet-400/20 border border-violet-400/40">
                <Zap className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-violet-400">Live Global Event</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-fuchsia-500/20 border border-fuchsia-500/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse" />
                    <span className="text-[10px] font-bold text-fuchsia-300">ACTIVE</span>
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground mt-0.5">
                  Compassion Points doubled for all players
                </p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-2xl font-bold font-serif text-violet-300">{pct}%</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">complete</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Heart className="w-3 h-3 text-rose-400" />
                Community Compassion Wins
              </span>
              <span className="font-semibold tabular-nums">
                {event.community_wins.toLocaleString()} / {event.raid_mode_target.toLocaleString()}
              </span>
            </div>
            <div className="h-3 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-violet-400"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5 text-violet-400/60" />
            <span>Every Compassion win counts toward the community goal · 2× multiplier active</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
