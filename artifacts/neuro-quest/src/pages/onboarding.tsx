import React, { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useLocation } from "wouter"
import { Brain, Zap, Sparkles, Target } from "lucide-react"
import { LuxuryButton } from "@/components/ui/luxury-button"
import { cn } from "@/lib/utils"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")
const WELCOME_GIFT = 50
const FOCUS_DURATION = 30 // seconds

/* ── Step 0: Splash ─────────────────────────────────────────────────────── */
function SplashStep({ onNext }: { onNext: () => void }) {
  useEffect(() => {
    const t = setTimeout(onNext, 5000)
    return () => clearTimeout(t)
  }, [onNext])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center min-h-screen text-center px-6 select-none"
      onClick={onNext}
    >
      {/* Gold pulse ring */}
      <div className="relative mb-10">
        {[1, 2, 3].map(i => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-full border border-primary/40"
            animate={{ scale: [1, 1 + i * 0.5], opacity: [0.6, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.7, ease: "easeOut" }}
            style={{ width: 96, height: 96, top: "50%", left: "50%", x: "-50%", y: "-50%" }}
          />
        ))}
        <motion.div
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="w-24 h-24 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center backdrop-blur-sm"
        >
          <Brain className="w-10 h-10 text-primary drop-shadow-[0_0_12px_rgba(212,175,55,0.8)]" />
        </motion.div>
      </div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-4xl sm:text-5xl font-serif font-bold mb-4 leading-tight"
        style={{ background: "linear-gradient(135deg, #D4AF37, #FFE066, #B8860B)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
      >
        NeuroQuest
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="text-lg sm:text-xl font-serif italic text-white/70 max-w-xs leading-relaxed mb-12"
      >
        "Train your mind.<br />Feed the world."
      </motion.p>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8 }}
        className="flex flex-col items-center gap-3"
      >
        <LuxuryButton size="lg" onClick={onNext} className="gap-2 px-10">
          <Sparkles className="w-4 h-4" />
          Begin Your Journey
        </LuxuryButton>
        <p className="text-xs text-muted-foreground">Tap anywhere to continue</p>
      </motion.div>

      {/* Ambient particles */}
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-primary/50"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{ opacity: [0, 0.8, 0], scale: [0, 1.5, 0] }}
          transition={{ duration: 3 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 4 }}
        />
      ))}
    </motion.div>
  )
}

/* ── Step 1: Focus Test ─────────────────────────────────────────────────── */
function FocusTestStep({ onComplete }: { onComplete: (score: number, responseMs: number[]) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dotPos, setDotPos] = useState({ x: 50, y: 50 }) // percent
  const [hits, setHits] = useState(0)
  const [timeLeft, setTimeLeft] = useState(FOCUS_DURATION)
  const [started, setStarted] = useState(false)
  const [responses, setResponses] = useState<number[]>([])
  const dotAppearRef = useRef<number>(Date.now())
  const moveRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const moveDot = useCallback(() => {
    const padding = 15
    const x = padding + Math.random() * (100 - padding * 2)
    const y = padding + Math.random() * (100 - padding * 2)
    setDotPos({ x, y })
    dotAppearRef.current = Date.now()
    // Decrease interval as time decreases (harder)
    const remaining = timeLeft
    const interval = Math.max(600, 1400 - (FOCUS_DURATION - remaining) * 28)
    moveRef.current = setTimeout(moveDot, interval)
  }, [timeLeft])

  // Countdown timer
  useEffect(() => {
    if (!started) return
    if (timeLeft <= 0) {
      onComplete(hits, responses)
      return
    }
    const t = setInterval(() => setTimeLeft(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [started, timeLeft, hits, onComplete, responses])

  // Dot movement
  useEffect(() => {
    if (!started || timeLeft <= 0) return
    moveRef.current = setTimeout(moveDot, 1200)
    return () => { if (moveRef.current) clearTimeout(moveRef.current) }
  }, [started])

  const handleDotClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!started) return
    const ms = Date.now() - dotAppearRef.current
    setHits(h => h + 1)
    setResponses(r => [...r, ms])
    if (moveRef.current) clearTimeout(moveRef.current)
    moveDot()
  }

  const pct = (timeLeft / FOCUS_DURATION) * 100

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center justify-center min-h-screen px-4 py-8"
    >
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/25 rounded-full px-4 py-1.5 mb-4">
            <Target className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Focus Test</span>
          </div>
          <h2 className="text-2xl font-serif font-bold mb-2">Tap the dot, fast.</h2>
          <p className="text-sm text-muted-foreground">This measures your baseline focus. 30 seconds. Go.</p>
        </div>

        {/* Timer bar */}
        <div className="h-2 bg-white/8 rounded-full mb-2 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-amber-400"
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mb-6">
          <span>{timeLeft}s left</span>
          <span className="font-bold text-primary tabular-nums">{hits} hits</span>
        </div>

        {/* Focus arena */}
        <div
          ref={containerRef}
          className={cn(
            "relative w-full rounded-3xl border bg-white/3 overflow-hidden transition-colors",
            started ? "border-primary/30" : "border-white/10",
          )}
          style={{ height: 320 }}
          onClick={!started ? () => setStarted(true) : undefined}
        >
          {!started ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary/50 flex items-center justify-center"
              >
                <Target className="w-7 h-7 text-primary" />
              </motion.div>
              <p className="text-sm font-semibold text-white/60">Tap here to start</p>
            </div>
          ) : (
            <motion.button
              key={`${dotPos.x}-${dotPos.y}`}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 18 }}
              onClick={handleDotClick}
              style={{ position: "absolute", left: `${dotPos.x}%`, top: `${dotPos.y}%`, transform: "translate(-50%,-50%)" }}
              className="w-14 h-14 rounded-full bg-primary/90 border-2 border-primary shadow-[0_0_24px_rgba(212,175,55,0.7)] flex items-center justify-center focus:outline-none active:scale-95 transition-transform"
            >
              <Zap className="w-6 h-6 text-black/80" />
            </motion.button>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Speed matters. Tap the dot every time it appears.
        </p>
      </div>
    </motion.div>
  )
}

/* ── Step 2: Results + Welcome Gift ─────────────────────────────────────── */
function ResultsStep({ score, responseMs }: { score: number; responseMs: number[] }) {
  const [, navigate] = useLocation()
  const [awarded, setAwarded] = useState(false)
  const [awarding, setAwarding] = useState(false)
  const avgMs = responseMs.length > 0 ? Math.round(responseMs.reduce((a, b) => a + b, 0) / responseMs.length) : 0
  const focusRating = score >= 20 ? "Elite" : score >= 14 ? "Sharp" : score >= 8 ? "Developing" : "Beginner"
  const focusColor = score >= 20 ? "text-primary" : score >= 14 ? "text-emerald-400" : score >= 8 ? "text-amber-400" : "text-rose-400"

  const handleEnter = async () => {
    if (awarding) return
    setAwarding(true)
    try {
      await fetch(`${BASE}/api/quest/earn-energy`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activity: "Onboarding Welcome Gift", amount: WELCOME_GIFT }),
      })
      setAwarded(true)
    } catch {}
    localStorage.setItem("nq_onboarding_done", "true")
    navigate("/")
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center min-h-screen px-4 text-center"
    >
      <div className="w-full max-w-sm space-y-6">
        {/* Focus result */}
        <div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 16 }}
            className="w-24 h-24 rounded-full bg-primary/15 border-2 border-primary/40 flex flex-col items-center justify-center mx-auto mb-4"
          >
            <span className={cn("text-3xl font-serif font-bold", focusColor)}>{score}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">hits</span>
          </motion.div>
          <h2 className="text-2xl font-serif font-bold text-foreground">
            Your Focus is{" "}
            <span className={focusColor}>{focusRating}</span>
          </h2>
          {avgMs > 0 && (
            <p className="text-sm text-muted-foreground mt-1">Avg response: {avgMs}ms</p>
          )}
        </div>

        {/* Stat pills */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Focus Score", value: `${score}/30`, color: "text-primary" },
            { label: "Reaction Time", value: `${avgMs}ms`, color: "text-emerald-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white/4 border border-white/8 rounded-2xl px-4 py-3">
              <p className={cn("text-lg font-bold", color)}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Welcome Gift */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-amber-400/5 px-6 py-5"
        >
          <div className="flex items-center gap-4">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="p-3 bg-primary/20 rounded-xl border border-primary/30 shrink-0"
            >
              <Zap className="w-6 h-6 text-primary" />
            </motion.div>
            <div className="text-left">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Welcome Gift</p>
              <p className="font-serif font-bold text-xl text-primary">+{WELCOME_GIFT} Neural Energy</p>
              <p className="text-xs text-muted-foreground">Ready for your first spin</p>
            </div>
          </div>
        </motion.div>

        <LuxuryButton
          size="lg"
          onClick={handleEnter}
          disabled={awarding}
          className="w-full gap-2 text-base"
        >
          <Brain className="w-5 h-5" />
          {awarding ? "Preparing…" : "Enter NeuroQuest"}
        </LuxuryButton>
      </div>
    </motion.div>
  )
}

/* ── Main Onboarding Page ─────────────────────────────────────────────────── */
export default function Onboarding() {
  const [step, setStep] = useState(0)
  const [focusScore, setFocusScore] = useState(0)
  const [responseMs, setResponseMs] = useState<number[]>([])

  const handleFocusComplete = (score: number, times: number[]) => {
    setFocusScore(score)
    setResponseMs(times)
    setStep(2)
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-primary/5 via-transparent to-rose-400/3 pointer-events-none" />
      <div className="relative z-10">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="splash">
              <SplashStep onNext={() => setStep(1)} />
            </motion.div>
          )}
          {step === 1 && (
            <motion.div key="focus">
              <FocusTestStep onComplete={handleFocusComplete} />
            </motion.div>
          )}
          {step === 2 && (
            <motion.div key="results">
              <ResultsStep score={focusScore} responseMs={responseMs} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
