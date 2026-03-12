import React, { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useLocation } from "wouter"
import { useQueryClient } from "@tanstack/react-query"
import {
  Brain, Flame, Leaf, Moon, Sun, Star, Eye, Wind,
  ArrowLeft, Zap, AlertCircle, Sparkles, Crown
} from "lucide-react"
import {
  useEarnEnergy,
  useGetProfile,
  getGetProfileQueryKey,
  getGetActivitiesQueryKey
} from "@workspace/api-client-react"
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { LuxuryButton } from "@/components/ui/luxury-button"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

/* ── Symbols ─────────────────────────────────────────────────────────────── */
const SYMBOLS = [
  { id: "brain", Icon: Brain,  label: "Brain",  color: "text-primary",     bg: "bg-primary/25",      prize3: 80,  prize2: 8  },
  { id: "star",  Icon: Star,   label: "Star",   color: "text-yellow-300",  bg: "bg-yellow-300/20",   prize3: 50,  prize2: 5  },
  { id: "flame", Icon: Flame,  label: "Flame",  color: "text-orange-400",  bg: "bg-orange-400/20",   prize3: 35,  prize2: 4  },
  { id: "moon",  Icon: Moon,   label: "Moon",   color: "text-indigo-300",  bg: "bg-indigo-300/20",   prize3: 25,  prize2: 3  },
  { id: "eye",   Icon: Eye,    label: "Eye",    color: "text-sky-400",     bg: "bg-sky-400/20",      prize3: 20,  prize2: 2  },
  { id: "leaf",  Icon: Leaf,   label: "Leaf",   color: "text-emerald-400", bg: "bg-emerald-400/20",  prize3: 15,  prize2: 1  },
  { id: "sun",   Icon: Sun,    label: "Sun",    color: "text-amber-300",   bg: "bg-amber-300/20",    prize3: 10,  prize2: 0  },
  { id: "wind",  Icon: Wind,   label: "Wind",   color: "text-teal-300",    bg: "bg-teal-300/20",     prize3: 8,   prize2: 0  },
]

const SPIN_COST = 10

type SpinPhase = "idle" | "spinning" | "stopping" | "result"
type WinTier  = "jackpot" | "three" | "two" | "none"

interface SpinResult {
  reels: number[]   // indices into SYMBOLS
  tier: WinTier
  symbolId: string | null
  payout: number    // net change (negative when losing)
}

function evalResult(reels: number[]): SpinResult {
  const [a, b, c] = reels
  if (a === b && b === c) {
    const tier: WinTier = a === 0 ? "jackpot" : "three"
    return { reels, tier, symbolId: SYMBOLS[a].id, payout: SYMBOLS[a].prize3 - SPIN_COST }
  }
  if (a === b || b === c || a === c) {
    const matchIdx = a === b ? a : a === c ? a : b
    const p2 = SYMBOLS[matchIdx].prize2
    return { reels, tier: "two", symbolId: SYMBOLS[matchIdx].id, payout: p2 - SPIN_COST }
  }
  return { reels, tier: "none", symbolId: null, payout: -SPIN_COST }
}

function randomReels(): number[] {
  return [0, 1, 2].map(() => Math.floor(Math.random() * SYMBOLS.length))
}

/* ── Reel component ──────────────────────────────────────────────────────── */
interface ReelProps {
  spinning: boolean
  finalIdx: number | null
  stopDelay?: number
  onStopped?: () => void
}

function Reel({ spinning, finalIdx, stopDelay = 0, onStopped }: ReelProps) {
  const [display, setDisplay]   = useState(0)
  const [stopped, setStopped]   = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef  = useRef<ReturnType<typeof setTimeout>  | null>(null)

  useEffect(() => {
    if (spinning) {
      setStopped(false)
      let speed = 60
      intervalRef.current = setInterval(() => {
        setDisplay(d => (d + 1) % SYMBOLS.length)
      }, speed)
      return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
    }
  }, [spinning])

  useEffect(() => {
    if (!spinning && finalIdx !== null && !stopped) {
      if (intervalRef.current) clearInterval(intervalRef.current)

      // Slow-down phase
      const slowSteps = [120, 180, 250, 320]
      let step = 0
      const tick = () => {
        setDisplay(d => (d + 1) % SYMBOLS.length)
        step++
        if (step < slowSteps.length) {
          timeoutRef.current = setTimeout(tick, slowSteps[step])
        } else {
          // Snap to final
          setDisplay(finalIdx)
          setStopped(true)
          onStopped?.()
        }
      }
      timeoutRef.current = setTimeout(tick, stopDelay + slowSteps[0])
    }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [spinning, finalIdx, stopDelay, stopped, onStopped])

  const sym    = SYMBOLS[display]
  const above  = SYMBOLS[(display - 1 + SYMBOLS.length) % SYMBOLS.length]
  const below  = SYMBOLS[(display + 1) % SYMBOLS.length]

  return (
    <div className="relative flex flex-col items-center justify-center h-52 w-32 sm:w-36 overflow-hidden select-none">
      {/* Winning line highlight */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-20 border-y border-primary/40 bg-primary/5 pointer-events-none z-10" />

      {/* Above (dimmed) */}
      <div className="flex items-center justify-center h-16 w-full opacity-25">
        <above.Icon className={cn("w-9 h-9", above.color)} />
      </div>

      {/* Center (main) */}
      <motion.div
        key={`${display}-${stopped}`}
        initial={spinning ? { scale: 0.85 } : { scale: 1 }}
        animate={{ scale: 1 }}
        className={cn(
          "flex items-center justify-center h-20 w-20 rounded-2xl z-20 transition-colors duration-150",
          sym.bg,
          stopped && "shadow-[0_0_20px_currentColor]"
        )}
      >
        <sym.Icon className={cn("w-10 h-10", sym.color)} />
      </motion.div>

      {/* Below (dimmed) */}
      <div className="flex items-center justify-center h-16 w-full opacity-25">
        <below.Icon className={cn("w-9 h-9", below.color)} />
      </div>
    </div>
  )
}

/* ── Paytable ────────────────────────────────────────────────────────────── */
function PayTable() {
  return (
    <GlassCard className="w-full max-w-md mx-auto">
      <GlassCardHeader>
        <GlassCardTitle className="text-base flex items-center gap-2">
          <Crown className="w-4 h-4 text-primary" /> Pay Table
        </GlassCardTitle>
      </GlassCardHeader>
      <GlassCardContent className="pt-0">
        <div className="space-y-1.5 text-sm">
          {SYMBOLS.map(sym => (
            <div key={sym.id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <sym.Icon className={cn("w-4 h-4", sym.color)} />
                <sym.Icon className={cn("w-4 h-4", sym.color)} />
                <sym.Icon className={cn("w-4 h-4", sym.color)} />
              </div>
              <span className="text-primary font-bold text-xs">+{sym.prize3}</span>
              <div className="flex items-center gap-2 ml-4">
                <sym.Icon className={cn("w-4 h-4", sym.color)} />
                <sym.Icon className={cn("w-4 h-4", sym.color)} />
                <span className="text-muted-foreground w-4 h-4 flex items-center">—</span>
              </div>
              <span className={cn("font-bold text-xs", sym.prize2 > 0 ? "text-emerald-400" : "text-muted-foreground")}>
                {sym.prize2 > 0 ? `+${sym.prize2}` : "—"}
              </span>
            </div>
          ))}
          <div className="pt-2 border-t border-white/10 text-muted-foreground text-xs">
            All payouts are in <span className="text-primary">Neural Energy</span>. Spin costs <span className="text-primary font-bold">−10</span>.
          </div>
        </div>
      </GlassCardContent>
    </GlassCard>
  )
}

/* ── Main Page ───────────────────────────────────────────────────────────── */
export default function SlotMachine() {
  const [, navigate]    = useLocation()
  const { toast }       = useToast()
  const queryClient     = useQueryClient()

  const { data: profile } = useGetProfile()

  const [phase, setPhase]         = useState<SpinPhase>("idle")
  const [finalReels, setFinalReels] = useState<number[] | null>(null)
  const [result, setResult]       = useState<SpinResult | null>(null)
  const [stoppedCount, setStoppedCount] = useState(0)
  const [totalWon, setTotalWon]   = useState(0)
  const [showPay, setShowPay]     = useState(false)

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() })
    queryClient.invalidateQueries({ queryKey: getGetActivitiesQueryKey() })
  }, [queryClient])

  const { mutate: earnEnergy, isPending } = useEarnEnergy({
    mutation: { onSuccess: invalidate }
  })

  const canSpin = profile && profile.neural_energy >= SPIN_COST && phase === "idle" && !isPending

  const handleSpin = () => {
    if (!canSpin) return

    const reels  = randomReels()
    const res    = evalResult(reels)

    setFinalReels(reels)
    setResult(res)
    setStoppedCount(0)
    setPhase("spinning")

    // Deduct spin cost immediately
    earnEnergy({ data: { activity: "Slot Machine Spin", amount: -SPIN_COST } })

    // After all reels stop → show result & pay out winnings
    setTimeout(() => {
      setPhase("result")
      if (res.payout > 0) {
        const label =
          res.tier === "jackpot" ? "JACKPOT" :
          res.tier === "three"   ? `3× ${res.symbolId}` :
                                   `2× ${res.symbolId}`
        earnEnergy({ data: { activity: `Slot Machine – ${label}`, amount: res.payout + SPIN_COST } })
        setTotalWon(w => w + res.payout)
        toast({
          title: res.tier === "jackpot" ? "⚡ JACKPOT!" : res.tier === "three" ? "Triple Match!" : "Double Match!",
          description: `+${res.payout} Neural Energy`,
        })
      } else {
        toast({ title: "No match", description: `–${SPIN_COST} Neural Energy` })
      }
    }, 1800)
  }

  const tierLabel: Record<WinTier, string> = {
    jackpot: "⚡ JACKPOT",
    three:   "Triple Match!",
    two:     "Double Match!",
    none:    "No Match",
  }
  const tierColor: Record<WinTier, string> = {
    jackpot: "text-primary drop-shadow-[0_0_12px_rgba(212,175,55,0.8)]",
    three:   "text-primary",
    two:     "text-emerald-400",
    none:    "text-muted-foreground",
  }

  return (
    <div className="min-h-screen relative overflow-hidden pb-20">
      <div
        className="absolute inset-0 z-0 opacity-40 mix-blend-overlay pointer-events-none bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/zen-bg.png)` }}
      />

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 pt-10">
        {/* Back */}
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to Dashboard</span>
        </motion.button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-3 mb-2">
            <Sparkles className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-serif font-bold text-gradient-gold">The Casino</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Each spin costs <span className="text-primary font-bold">−10 Neural Energy</span>
          </p>
        </motion.div>

        {/* Balance & session stats */}
        <div className="flex justify-center gap-4 mb-6 flex-wrap">
          <div className="glass-panel px-5 py-2 rounded-full flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium tabular-nums">{profile?.neural_energy ?? "—"} energy</span>
          </div>
          {totalWon !== 0 && (
            <div className={cn(
              "glass-panel px-5 py-2 rounded-full flex items-center gap-2 text-sm font-medium tabular-nums",
              totalWon > 0 ? "text-emerald-400" : "text-rose-400"
            )}>
              <Zap className="w-4 h-4" />
              Session: {totalWon > 0 ? "+" : ""}{totalWon}
            </div>
          )}
        </div>

        {/* Machine body */}
        <GlassCard glow className="mb-6">
          <GlassCardContent className="p-6 sm:p-8">
            {/* Reels */}
            <div className="flex justify-center items-stretch gap-1 sm:gap-3 mb-8 relative">
              {/* Machine frame */}
              <div className="absolute inset-0 rounded-2xl border border-primary/20 pointer-events-none" />

              {[0, 1, 2].map((i) => (
                <React.Fragment key={i}>
                  <Reel
                    spinning={phase === "spinning"}
                    finalIdx={finalReels ? finalReels[i] : null}
                    stopDelay={i * 300}
                    onStopped={() => setStoppedCount(c => c + 1)}
                  />
                  {i < 2 && <div className="w-px bg-white/10 self-stretch mx-1" />}
                </React.Fragment>
              ))}
            </div>

            {/* Result banner */}
            <AnimatePresence mode="wait">
              {phase === "result" && result && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-center mb-6"
                >
                  <p className={cn("text-xl font-serif font-bold mb-1", tierColor[result.tier])}>
                    {tierLabel[result.tier]}
                  </p>
                  <p className={cn("text-sm font-medium", result.payout >= 0 ? "text-emerald-400" : "text-rose-400")}>
                    {result.payout >= 0 ? `+${result.payout}` : result.payout} Neural Energy
                  </p>
                </motion.div>
              )}
              {phase === "idle" && !result && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center mb-6 text-muted-foreground text-sm"
                >
                  Pull the lever. Trust the mind.
                </motion.div>
              )}
              {phase === "spinning" && (
                <motion.div
                  key="spinning"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="text-center mb-6 text-primary text-sm font-medium tracking-widest uppercase"
                >
                  Spinning…
                </motion.div>
              )}
            </AnimatePresence>

            {/* Spin button */}
            <div className="flex flex-col items-center gap-3">
              <LuxuryButton
                size="lg"
                onClick={() => {
                  if (phase === "result") {
                    setPhase("idle")
                    setResult(null)
                    setFinalReels(null)
                  } else {
                    handleSpin()
                  }
                }}
                disabled={
                  (phase === "idle" && !canSpin) ||
                  phase === "spinning" ||
                  isPending
                }
                className={cn(
                  "w-48 gap-3 font-serif font-bold text-base tracking-wide transition-all duration-300",
                  phase === "result" && result?.payout !== undefined && result.payout >= 0
                    ? "shadow-[0_0_30px_rgba(212,175,55,0.5)]"
                    : ""
                )}
              >
                <Zap className="w-5 h-5" />
                {phase === "result" ? "Spin Again" : `Spin (–${SPIN_COST})`}
              </LuxuryButton>

              {profile && profile.neural_energy < SPIN_COST && phase !== "spinning" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-1.5 text-rose-400 text-xs"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  Not enough neural energy to spin
                </motion.div>
              )}
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* Pay table toggle */}
        <div className="flex justify-center mb-4">
          <button
            onClick={() => setShowPay(v => !v)}
            className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
          >
            <Crown className="w-3.5 h-3.5" />
            {showPay ? "Hide" : "View"} Pay Table
          </button>
        </div>
        <AnimatePresence>
          {showPay && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <PayTable />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
