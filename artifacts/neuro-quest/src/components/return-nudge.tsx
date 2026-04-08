import React, { useState, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Brain, Zap, X, ChevronRight } from "lucide-react"
import { useLocation } from "wouter"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

interface NudgeStatus {
  should_nudge: boolean
  hours_since_play: number | null
  level_title: string
  next_level_title: string | null
  pct_to_next: number
  pct_remaining: number
  nudge_message: string
}

export function ReturnNudge() {
  const [, navigate] = useLocation()
  const [nudge, setNudge] = useState<NudgeStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetch(`${BASE}/api/quest/nudge-status`, { credentials: "include" })
      .then(r => r.json())
      .then(data => { if (data.should_nudge) setNudge(data) })
      .catch(() => {})
  }, [])

  if (!nudge || dismissed) return null

  const hourLabel = nudge.hours_since_play !== null
    ? nudge.hours_since_play >= 48
      ? `${Math.floor(nudge.hours_since_play / 24)} days away`
      : `${nudge.hours_since_play}h away`
    : "A while away"

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="relative rounded-2xl border border-amber-400/30 bg-amber-500/5 px-5 py-4"
        >
          <button
            onClick={() => setDismissed(true)}
            className="absolute top-3 right-3 p-1 rounded-lg text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-start gap-4 pr-6">
            <div className="p-2.5 bg-amber-400/15 rounded-xl border border-amber-400/25 shrink-0 mt-0.5">
              <Brain className="w-5 h-5 text-amber-400" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                  Welcome back, {nudge.level_title}
                </span>
                <span className="text-[10px] text-muted-foreground/50">· {hourLabel}</span>
              </div>
              <p className="text-sm font-medium text-foreground leading-snug mb-3">
                {nudge.nudge_message}
              </p>

              {nudge.next_level_title && (
                <div className="space-y-1 mb-3">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress to {nudge.next_level_title}</span>
                    <span className="font-semibold tabular-nums text-amber-400">{nudge.pct_to_next}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-400"
                      style={{ width: `${nudge.pct_to_next}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate("/brain-game")}
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl border bg-amber-400/15 border-amber-400/35 text-amber-300 hover:bg-amber-400/25 transition-colors"
                >
                  <Zap className="w-3 h-3" /> Train Now
                </button>
                <button
                  onClick={() => navigate("/wellness")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
                >
                  Compassion Wheel <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
