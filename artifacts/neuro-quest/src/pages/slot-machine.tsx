import React, { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useLocation } from "wouter"
import { useQueryClient } from "@tanstack/react-query"
import {
  Brain, Flame, Leaf, Moon, Sun, Star, Eye, Wind, Heart,
  ArrowLeft, Zap, AlertCircle, Sparkles, Crown, X
} from "lucide-react"
import confetti from "canvas-confetti"
import {
  useEarnEnergy,
  useEarnCompassion,
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
  { id: "heart", Icon: Heart,  label: "Heart",  color: "text-rose-400",    bg: "bg-rose-400/25",     prize3: 0,   prize2: 0,  special: true  },
  { id: "brain", Icon: Brain,  label: "Brain",  color: "text-primary",     bg: "bg-primary/25",      prize3: 80,  prize2: 8,  special: false },
  { id: "star",  Icon: Star,   label: "Star",   color: "text-yellow-300",  bg: "bg-yellow-300/20",   prize3: 50,  prize2: 5,  special: false },
  { id: "flame", Icon: Flame,  label: "Flame",  color: "text-orange-400",  bg: "bg-orange-400/20",   prize3: 35,  prize2: 4,  special: false },
  { id: "moon",  Icon: Moon,   label: "Moon",   color: "text-indigo-300",  bg: "bg-indigo-300/20",   prize3: 25,  prize2: 3,  special: false },
  { id: "eye",   Icon: Eye,    label: "Eye",    color: "text-sky-400",     bg: "bg-sky-400/20",      prize3: 20,  prize2: 2,  special: false },
  { id: "leaf",  Icon: Leaf,   label: "Leaf",   color: "text-emerald-400", bg: "bg-emerald-400/20",  prize3: 15,  prize2: 1,  special: false },
  { id: "sun",   Icon: Sun,    label: "Sun",    color: "text-amber-300",   bg: "bg-amber-300/20",    prize3: 10,  prize2: 0,  special: false },
  { id: "wind",  Icon: Wind,   label: "Wind",   color: "text-teal-300",    bg: "bg-teal-300/20",     prize3: 8,   prize2: 0,  special: false },
]

const HEART_IDX  = 0
const SPIN_COST  = 10
const COMPASSION_JACKPOT = 500

type SpinPhase = "idle" | "spinning" | "result"
type WinTier   = "compassion_jackpot" | "jackpot" | "three" | "two" | "none"

interface SpinResult {
  reels:    number[]
  tier:     WinTier
  symbolId: string | null
  payout:   number
}

function evalResult(reels: number[]): SpinResult {
  const [a, b, c] = reels
  // 3 Hearts → Compassion Jackpot
  if (a === HEART_IDX && b === HEART_IDX && c === HEART_IDX) {
    return { reels, tier: "compassion_jackpot", symbolId: "heart", payout: -SPIN_COST }
  }
  if (a === b && b === c) {
    const tier: WinTier = a === 1 ? "jackpot" : "three"
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

/* ── Confetti burst ──────────────────────────────────────────────────────── */
function fireCompassionConfetti() {
  const colors = ["#FF6B9D", "#FFB3CC", "#FF3D7F", "#FF85A8", "#D4AF37", "#FFE066", "#fff"]

  const burst = (origin: { x: number; y: number }) =>
    confetti({
      particleCount: 120,
      spread: 120,
      startVelocity: 55,
      origin,
      colors,
      shapes: ["circle", "square"],
      gravity: 0.9,
      scalar: 1.2,
      ticks: 300,
    })

  // Multi-origin volley
  burst({ x: 0.2, y: 0.4 })
  setTimeout(() => burst({ x: 0.8, y: 0.4 }), 150)
  setTimeout(() => burst({ x: 0.5, y: 0.2 }), 300)
  setTimeout(() => burst({ x: 0.15, y: 0.6 }), 500)
  setTimeout(() => burst({ x: 0.85, y: 0.6 }), 650)

  // Sustained shower
  const end = Date.now() + 3000
  const shower = () => {
    if (Date.now() > end) return
    confetti({
      particleCount: 6,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors,
      ticks: 200,
      gravity: 1,
    })
    confetti({
      particleCount: 6,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors,
      ticks: 200,
      gravity: 1,
    })
    requestAnimationFrame(shower)
  }
  setTimeout(shower, 800)
}

/* ── Reel ────────────────────────────────────────────────────────────────── */
interface ReelProps {
  spinning:   boolean
  finalIdx:   number | null
  stopDelay?: number
  onStopped?: () => void
  glowHeart?: boolean
}

function Reel({ spinning, finalIdx, stopDelay = 0, onStopped, glowHeart }: ReelProps) {
  const [display, setDisplay] = useState(1)
  const [stopped, setStopped] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef  = useRef<ReturnType<typeof setTimeout>  | null>(null)

  useEffect(() => {
    if (spinning) {
      setStopped(false)
      intervalRef.current = setInterval(() => {
        setDisplay(d => (d + 1) % SYMBOLS.length)
      }, 60)
      return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
    }
  }, [spinning])

  useEffect(() => {
    if (!spinning && finalIdx !== null && !stopped) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      const slowSteps = [120, 180, 250, 320]
      let step = 0
      const tick = () => {
        setDisplay(d => (d + 1) % SYMBOLS.length)
        step++
        if (step < slowSteps.length) {
          timeoutRef.current = setTimeout(tick, slowSteps[step])
        } else {
          setDisplay(finalIdx)
          setStopped(true)
          onStopped?.()
        }
      }
      timeoutRef.current = setTimeout(tick, stopDelay + slowSteps[0])
    }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [spinning, finalIdx, stopDelay, stopped, onStopped])

  const sym   = SYMBOLS[display]
  const above = SYMBOLS[(display - 1 + SYMBOLS.length) % SYMBOLS.length]
  const below = SYMBOLS[(display + 1) % SYMBOLS.length]
  const isHeartGlow = glowHeart && sym.id === "heart" && stopped

  return (
    <div className="relative flex flex-col items-center justify-center h-52 w-32 sm:w-36 overflow-hidden select-none">
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-20 border-y border-primary/40 bg-primary/5 pointer-events-none z-10" />

      <div className="flex items-center justify-center h-16 w-full opacity-25">
        <above.Icon className={cn("w-9 h-9", above.color)} />
      </div>

      <motion.div
        key={`${display}-${stopped}`}
        initial={spinning ? { scale: 0.85 } : { scale: 1 }}
        animate={isHeartGlow
          ? { scale: [1, 1.12, 1], transition: { repeat: Infinity, duration: 1.1 } }
          : { scale: 1 }
        }
        className={cn(
          "flex items-center justify-center h-20 w-20 rounded-2xl z-20 transition-colors duration-150",
          sym.bg,
          stopped && !isHeartGlow && "shadow-[0_0_20px_currentColor]",
          isHeartGlow && "shadow-[0_0_35px_rgba(251,113,133,0.9)] ring-2 ring-rose-400/60"
        )}
      >
        <sym.Icon className={cn("w-10 h-10", sym.color)} />
      </motion.div>

      <div className="flex items-center justify-center h-16 w-full opacity-25">
        <below.Icon className={cn("w-9 h-9", below.color)} />
      </div>
    </div>
  )
}

/* ── Pay Table ───────────────────────────────────────────────────────────── */
function PayTable() {
  return (
    <GlassCard className="w-full max-w-md mx-auto">
      <GlassCardHeader>
        <GlassCardTitle className="text-base flex items-center gap-2">
          <Crown className="w-4 h-4 text-primary" /> Pay Table
        </GlassCardTitle>
      </GlassCardHeader>
      <GlassCardContent className="pt-0 space-y-2">
        {/* Special heart row */}
        <div className="flex items-center justify-between gap-3 p-2 rounded-xl bg-rose-400/10 border border-rose-400/30">
          <div className="flex items-center gap-1.5">
            <Heart className="w-4 h-4 text-rose-400 fill-rose-400" />
            <Heart className="w-4 h-4 text-rose-400 fill-rose-400" />
            <Heart className="w-4 h-4 text-rose-400 fill-rose-400" />
          </div>
          <span className="text-rose-300 font-bold text-xs tracking-wide">COMPASSION JACKPOT</span>
          <span className="text-rose-400 font-bold text-xs">+{COMPASSION_JACKPOT} ♡</span>
        </div>

        <div className="space-y-1.5 text-sm pt-1">
          {SYMBOLS.filter(s => !s.special).map(sym => (
            <div key={sym.id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <sym.Icon className={cn("w-4 h-4", sym.color)} />
                <sym.Icon className={cn("w-4 h-4", sym.color)} />
                <sym.Icon className={cn("w-4 h-4", sym.color)} />
              </div>
              <span className="text-primary font-bold text-xs">+{sym.prize3} ⚡</span>
              <div className="flex items-center gap-1.5 ml-2">
                <sym.Icon className={cn("w-4 h-4", sym.color)} />
                <sym.Icon className={cn("w-4 h-4", sym.color)} />
                <span className="text-muted-foreground">—</span>
              </div>
              <span className={cn("font-bold text-xs", sym.prize2 > 0 ? "text-emerald-400" : "text-muted-foreground")}>
                {sym.prize2 > 0 ? `+${sym.prize2} ⚡` : "—"}
              </span>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground text-xs pt-2 border-t border-white/10">
          Spin costs <span className="text-primary font-bold">−{SPIN_COST}</span> Neural Energy.
          ⚡ = Neural Energy · ♡ = Compassion Points
        </p>
      </GlassCardContent>
    </GlassCard>
  )
}

/* ── Compassion Jackpot Overlay ──────────────────────────────────────────── */
function CompassionJackpotOverlay({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.6, opacity: 0, y: 60 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: -30 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        onClick={e => e.stopPropagation()}
        className="relative max-w-sm w-full mx-4"
      >
        {/* Dismiss */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 bg-white/10 hover:bg-white/20 rounded-full p-1.5 transition-colors"
        >
          <X className="w-4 h-4 text-white" />
        </button>

        <GlassCard glow className="overflow-visible">
          <GlassCardContent className="p-10 text-center space-y-6">
            {/* Pulsing hearts */}
            <div className="flex justify-center gap-3">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.3, 1] }}
                  transition={{ delay: i * 0.12, type: "spring", stiffness: 280, damping: 14 }}
                >
                  <Heart className="w-12 h-12 text-rose-400 fill-rose-400 drop-shadow-[0_0_18px_rgba(251,113,133,0.9)]" />
                </motion.div>
              ))}
            </div>

            {/* Text */}
            <div className="space-y-2">
              <motion.h2
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="text-3xl font-serif font-bold leading-tight"
                style={{ background: "linear-gradient(135deg, #FF6B9D, #FFE066, #FF3D7F)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
              >
                Compassion Jackpot
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-base font-medium text-rose-200 tracking-wide"
              >
                Impact Verified.
              </motion.p>
            </div>

            {/* Award badge */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.65, type: "spring" }}
              className="inline-flex items-center gap-2 bg-rose-400/20 border border-rose-400/50 rounded-full px-6 py-3 mx-auto"
            >
              <Heart className="w-5 h-5 text-rose-400 fill-rose-400" />
              <span className="font-bold text-rose-300 text-lg">+{COMPASSION_JACKPOT} Compassion Points</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
            >
              <LuxuryButton
                size="sm"
                onClick={onClose}
                className="gap-2 bg-rose-500/80 hover:bg-rose-500 border-rose-400/50 text-white shadow-[0_0_20px_rgba(251,113,133,0.4)]"
              >
                Carry the Love Forward
              </LuxuryButton>
            </motion.div>
          </GlassCardContent>
        </GlassCard>
      </motion.div>
    </motion.div>
  )
}

/* ── Main Page ───────────────────────────────────────────────────────────── */
export default function SlotMachine() {
  const [, navigate]  = useLocation()
  const { toast }     = useToast()
  const queryClient   = useQueryClient()

  const { data: profile } = useGetProfile()

  const [phase, setPhase]           = useState<SpinPhase>("idle")
  const [finalReels, setFinalReels] = useState<number[] | null>(null)
  const [result, setResult]         = useState<SpinResult | null>(null)
  const [totalWon, setTotalWon]     = useState(0)
  const [showPay, setShowPay]       = useState(false)
  const [showJackpot, setShowJackpot] = useState(false)

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() })
    queryClient.invalidateQueries({ queryKey: getGetActivitiesQueryKey() })
  }, [queryClient])

  const { mutate: earnEnergy,     isPending: isEnergyPending    } = useEarnEnergy({    mutation: { onSuccess: invalidate } })
  const { mutate: earnCompassion, isPending: isCompassionPending } = useEarnCompassion({ mutation: { onSuccess: invalidate } })

  const isPending = isEnergyPending || isCompassionPending
  const canSpin   = profile && profile.neural_energy >= SPIN_COST && phase === "idle" && !isPending

  const handleSpin = () => {
    if (!canSpin) return

    const reels = randomReels()
    const res   = evalResult(reels)

    setFinalReels(reels)
    setResult(res)
    setPhase("spinning")

    // Deduct spin cost immediately
    earnEnergy({ data: { activity: "Slot Machine Spin", amount: -SPIN_COST } })

    setTimeout(() => {
      setPhase("result")

      if (res.tier === "compassion_jackpot") {
        // Fire confetti then show overlay
        fireCompassionConfetti()
        setTimeout(() => setShowJackpot(true), 400)
        earnCompassion({ data: { activity: "Compassion Jackpot – 3× Heart", amount: COMPASSION_JACKPOT } })
        toast({ title: "♡ Compassion Jackpot!", description: `+${COMPASSION_JACKPOT} Compassion Points` })

      } else if (res.tier === "jackpot" || res.tier === "three" || res.tier === "two") {
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

      } else {
        toast({ title: "No match", description: `–${SPIN_COST} Neural Energy` })
      }
    }, 1800)
  }

  const tierLabel: Record<WinTier, string> = {
    compassion_jackpot: "♡ Compassion Jackpot!",
    jackpot:            "⚡ JACKPOT",
    three:              "Triple Match!",
    two:                "Double Match!",
    none:               "No Match",
  }
  const tierColor: Record<WinTier, string> = {
    compassion_jackpot: "text-rose-400 drop-shadow-[0_0_12px_rgba(251,113,133,0.8)]",
    jackpot:            "text-primary drop-shadow-[0_0_12px_rgba(212,175,55,0.8)]",
    three:              "text-primary",
    two:                "text-emerald-400",
    none:               "text-muted-foreground",
  }

  const isHeartResult = result?.tier === "compassion_jackpot"

  return (
    <div className="min-h-screen relative overflow-hidden pb-20">
      <div
        className="absolute inset-0 z-0 opacity-40 mix-blend-overlay pointer-events-none bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/zen-bg.png)` }}
      />

      {/* Compassion Jackpot full-screen overlay */}
      <AnimatePresence>
        {showJackpot && (
          <CompassionJackpotOverlay onClose={() => {
            setShowJackpot(false)
            setPhase("idle")
            setResult(null)
            setFinalReels(null)
          }} />
        )}
      </AnimatePresence>

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
            <span className="mx-2 text-white/20">·</span>
            <span className="text-rose-400 font-semibold">3× ♡ = Compassion Jackpot</span>
          </p>
        </motion.div>

        {/* Balance */}
        <div className="flex justify-center gap-4 mb-6 flex-wrap">
          <div className="glass-panel px-5 py-2 rounded-full flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium tabular-nums">{profile?.neural_energy ?? "—"} energy</span>
          </div>
          <div className="glass-panel px-5 py-2 rounded-full flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-400" />
            <span className="text-sm font-medium tabular-nums">{profile?.compassion_points ?? "—"} compassion</span>
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
        <GlassCard
          glow
          className={cn("mb-6 transition-all duration-700", isHeartResult && "ring-2 ring-rose-400/50 shadow-[0_0_40px_rgba(251,113,133,0.3)]")}
        >
          <GlassCardContent className="p-6 sm:p-8">
            {/* Reels */}
            <div className="flex justify-center items-stretch gap-1 sm:gap-3 mb-8 relative">
              <div className={cn(
                "absolute inset-0 rounded-2xl border pointer-events-none transition-colors duration-700",
                isHeartResult ? "border-rose-400/50" : "border-primary/20"
              )} />

              {[0, 1, 2].map((i) => (
                <React.Fragment key={i}>
                  <Reel
                    spinning={phase === "spinning"}
                    finalIdx={finalReels ? finalReels[i] : null}
                    stopDelay={i * 300}
                    onStopped={() => {}}
                    glowHeart={isHeartResult}
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
                  {result.tier !== "compassion_jackpot" && (
                    <p className={cn("text-sm font-medium", result.payout >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {result.payout >= 0 ? `+${result.payout}` : result.payout} Neural Energy
                    </p>
                  )}
                  {result.tier === "compassion_jackpot" && (
                    <p className="text-sm font-medium text-rose-300">+{COMPASSION_JACKPOT} Compassion Points</p>
                  )}
                </motion.div>
              )}
              {phase === "idle" && !result && (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="text-center mb-6 text-muted-foreground text-sm">
                  Pull the lever. Trust the mind.
                </motion.div>
              )}
              {phase === "spinning" && (
                <motion.div key="spinning" initial={{ opacity: 0 }}
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="text-center mb-6 text-primary text-sm font-medium tracking-widest uppercase">
                  Spinning…
                </motion.div>
              )}
            </AnimatePresence>

            {/* Spin button */}
            <div className="flex flex-col items-center gap-3">
              <LuxuryButton
                size="lg"
                onClick={() => {
                  if (phase === "result" && !showJackpot) {
                    setPhase("idle")
                    setResult(null)
                    setFinalReels(null)
                  } else {
                    handleSpin()
                  }
                }}
                disabled={
                  showJackpot ||
                  (phase === "idle" && !canSpin) ||
                  phase === "spinning" ||
                  isPending
                }
                className={cn(
                  "w-52 gap-3 font-serif font-bold text-base tracking-wide transition-all duration-300",
                  phase === "result" && result && result.payout >= 0 && !isHeartResult
                    ? "shadow-[0_0_30px_rgba(212,175,55,0.5)]" : "",
                  isHeartResult ? "shadow-[0_0_30px_rgba(251,113,133,0.5)]" : ""
                )}
              >
                <Zap className="w-5 h-5" />
                {phase === "result" && !showJackpot ? "Spin Again" : `Spin (–${SPIN_COST})`}
              </LuxuryButton>

              {profile && profile.neural_energy < SPIN_COST && phase !== "spinning" && !showJackpot && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex items-center gap-1.5 text-rose-400 text-xs">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Not enough neural energy to spin
                </motion.div>
              )}
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* Pay table */}
        <div className="flex justify-center mb-4">
          <button onClick={() => setShowPay(v => !v)}
            className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5" />
            {showPay ? "Hide" : "View"} Pay Table
          </button>
        </div>
        <AnimatePresence>
          {showPay && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <PayTable />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
