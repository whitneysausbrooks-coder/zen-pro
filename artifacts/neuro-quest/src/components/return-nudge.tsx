import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Brain, Zap, X, ChevronRight } from "lucide-react"
import { useLocation } from "wouter"
import { cn } from "@/lib/utils"

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
          initial={{ opacity: 0, x: 20, scale: 0.97 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 20, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 220, damping: 22, delay: 0.5 }}
          className="relative overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-500/8 via-orange-400/5 to-transparent px-5 py-4"
          style={{ boxShadow: "0 0 24px rgba(212,175,55,0.08)" }}
        >
          {/* Dismiss */}
          <button
            onClick={() => setDismissed(true)}
            className="absolute top-3 right-3 p-1 rounded-lg text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-start gap-4 pr-6">
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="p-2.5 bg-amber-400/15 rounded-xl border border-amber-400/25 shrink-0 mt-0.5"
            >
              <Brain className="w-5 h-5 text-amber-400" />
            </motion.div>

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

              {/* Progress to next level */}
              {nudge.next_level_title && (
                <div className="space-y-1 mb-3">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress to {nudge.next_level_title}</span>
                    <span className="font-semibold tabular-nums text-amber-400">{nudge.pct_to_next}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 border border-white/8 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${nudge.pct_to_next}%` }}
                      transition={{ duration: 1, delay: 0.8, ease: "easeOut" }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate("/brain-game")}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl border transition-all duration-200",
                    "bg-amber-400/15 border-amber-400/35 text-amber-300 hover:bg-amber-400/25"
                  )}
                >
                  <Zap className="w-3 h-3" /> Train Now
                </button>
                <button
                  onClick={() => navigate("/casino")}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
                  )}
                >
                  The Casino <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
