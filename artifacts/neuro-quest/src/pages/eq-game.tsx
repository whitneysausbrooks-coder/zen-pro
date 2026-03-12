import React, { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useLocation } from "wouter"
import { useQueryClient } from "@tanstack/react-query"
import { Brain, Zap, ArrowLeft, Trophy, RefreshCw, Clock } from "lucide-react"
import { getGetProfileQueryKey, getGetActivitiesQueryKey } from "@workspace/api-client-react"
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { LuxuryButton } from "@/components/ui/luxury-button"
import { cn } from "@/lib/utils"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")
const ROUNDS = 10
const TIME_PER_ROUND = 1500 // ms
const ENERGY_PER_CORRECT = 4
const SPEED_BONUS_THRESHOLD = 600 // ms — bonus energy if faster than this

const EMOTIONS = [
  { id: "happy",     emoji: "😊", label: "Happy",     bg: "bg-yellow-400/15",  border: "border-yellow-400/30",  glow: "rgba(250,204,21,0.4)" },
  { id: "sad",       emoji: "😢", label: "Sad",       bg: "bg-blue-400/15",    border: "border-blue-400/30",    glow: "rgba(96,165,250,0.4)" },
  { id: "angry",     emoji: "😠", label: "Angry",     bg: "bg-red-400/15",     border: "border-red-400/30",     glow: "rgba(248,113,113,0.4)" },
  { id: "fearful",   emoji: "😨", label: "Fearful",   bg: "bg-purple-400/15",  border: "border-purple-400/30",  glow: "rgba(192,132,252,0.4)" },
  { id: "surprised", emoji: "😲", label: "Surprised", bg: "bg-cyan-400/15",    border: "border-cyan-400/30",    glow: "rgba(34,211,238,0.4)" },
  { id: "disgusted", emoji: "🤢", label: "Disgusted", bg: "bg-green-400/15",   border: "border-green-400/30",   glow: "rgba(74,222,128,0.4)" },
  { id: "calm",      emoji: "😌", label: "Calm",      bg: "bg-teal-400/15",    border: "border-teal-400/30",    glow: "rgba(45,212,191,0.4)" },
  { id: "confused",  emoji: "😕", label: "Confused",  bg: "bg-orange-400/15",  border: "border-orange-400/30",  glow: "rgba(251,146,60,0.4)" },
]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function getOptions(correctId: string): typeof EMOTIONS {
  const correct = EMOTIONS.find(e => e.id === correctId)!
  const others = shuffle(EMOTIONS.filter(e => e.id !== correctId)).slice(0, 3)
  return shuffle([correct, ...others])
}

interface Round {
  emotionId: string
  correct: boolean | null
  responseMs: number | null
}

type Phase = "idle" | "playing" | "result" | "complete"

export default function EQGame() {
  const [, navigate] = useLocation()
  const queryClient = useQueryClient()

  const [phase, setPhase] = useState<Phase>("idle")
  const [currentRound, setCurrentRound] = useState(0)
  const [rounds, setRounds] = useState<Round[]>([])
  const [currentEmotion, setCurrentEmotion] = useState(EMOTIONS[0])
  const [options, setOptions] = useState<typeof EMOTIONS>([])
  const [timerPct, setTimerPct] = useState(100)
  const [lastResult, setLastResult] = useState<boolean | null>(null)
  const [totalEnergy, setTotalEnergy] = useState(0)

  const roundStartRef = useRef<number>(Date.now())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startRound = useCallback((roundIdx: number) => {
    const emotion = EMOTIONS[Math.floor(Math.random() * EMOTIONS.length)]
    setCurrentEmotion(emotion)
    setOptions(getOptions(emotion.id))
    setTimerPct(100)
    setLastResult(null)
    setPhase("playing")
    roundStartRef.current = Date.now()

    // Timer countdown
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimerPct(p => {
        const next = p - (100 / (TIME_PER_ROUND / 50))
        if (next <= 0) {
          if (timerRef.current) clearInterval(timerRef.current)
          return 0
        }
        return next
      })
    }, 50)

    // Auto-fail if no response
    if (autoRef.current) clearTimeout(autoRef.current)
    autoRef.current = setTimeout(() => {
      handleAnswer(null, emotion.id, roundIdx)
    }, TIME_PER_ROUND)
  }, [])

  const handleAnswer = useCallback((selectedId: string | null, correctId: string, roundIdx: number) => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (autoRef.current) clearTimeout(autoRef.current)

    const ms = Date.now() - roundStartRef.current
    const correct = selectedId === correctId
    const speedBonus = correct && ms < SPEED_BONUS_THRESHOLD

    setLastResult(correct)
    setPhase("result")

    const energy = correct ? ENERGY_PER_CORRECT + (speedBonus ? 2 : 0) : 0
    setTotalEnergy(e => e + energy)

    setRounds(r => [...r, { emotionId: correctId, correct, responseMs: ms }])

    // Advance to next round after 800ms
    setTimeout(() => {
      if (roundIdx + 1 >= ROUNDS) {
        setPhase("complete")
      } else {
        setCurrentRound(roundIdx + 1)
        startRound(roundIdx + 1)
      }
    }, 700)
  }, [startRound])

  // Award energy on complete
  useEffect(() => {
    if (phase !== "complete" || totalEnergy <= 0) return
    fetch(`${BASE}/api/quest/earn-energy`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activity: "Emotional EQ Game", amount: totalEnergy }),
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() })
      queryClient.invalidateQueries({ queryKey: getGetActivitiesQueryKey() })
    }).catch(() => {})
  }, [phase, totalEnergy])

  const correctCount = rounds.filter(r => r.correct).length
  const avgMs = rounds.filter(r => r.responseMs !== null && r.correct).reduce((s, r) => s + r.responseMs!, 0) / Math.max(1, rounds.filter(r => r.correct).length)

  if (phase === "complete") {
    const accuracy = Math.round((correctCount / ROUNDS) * 100)
    const eqRating = accuracy >= 90 ? "Empath Elite" : accuracy >= 70 ? "Emotionally Sharp" : accuracy >= 50 ? "Developing EQ" : "EQ Beginner"

    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm text-center">
          <Trophy className="w-14 h-14 text-primary mx-auto mb-4 drop-shadow-[0_0_16px_rgba(212,175,55,0.6)]" />
          <h2 className="text-3xl font-serif font-bold text-gradient-gold mb-1">EQ Complete</h2>
          <p className="text-muted-foreground mb-6">{eqRating}</p>

          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: "Accuracy", value: `${accuracy}%`, color: "text-primary" },
              { label: "Correct", value: `${correctCount}/${ROUNDS}`, color: "text-emerald-400" },
              { label: "Avg Speed", value: `${Math.round(avgMs)}ms`, color: "text-cyan-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white/4 border border-white/8 rounded-2xl p-3">
                <p className={cn("text-xl font-bold", color)}>{value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-primary/8 border border-primary/20 px-5 py-4 mb-6">
            <p className="text-[10px] uppercase tracking-widest text-primary/70 mb-1">Energy Earned</p>
            <p className="text-3xl font-serif font-bold text-primary">+{totalEnergy}</p>
            <p className="text-xs text-muted-foreground">Neural Energy added to your account</p>
          </div>

          <div className="flex gap-3">
            <LuxuryButton variant="outline" className="flex-1 gap-2" onClick={() => {
              setPhase("idle"); setRounds([]); setCurrentRound(0); setTotalEnergy(0)
            }}>
              <RefreshCw className="w-4 h-4" /> Play Again
            </LuxuryButton>
            <LuxuryButton className="flex-1 gap-2" onClick={() => navigate("/")}>
              Dashboard
            </LuxuryButton>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-10 relative overflow-hidden">
      <div className="w-full max-w-sm">
        {/* Back */}
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back</span>
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-cyan-400/10 border border-cyan-400/25 rounded-full px-4 py-1.5 mb-3">
            <Brain className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">Emotional EQ</span>
          </div>
          <h1 className="text-2xl font-serif font-bold">What emotion is this?</h1>
          <p className="text-sm text-muted-foreground mt-1">Identify in under 1.5 seconds for max points</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex gap-1 flex-1">
            {Array.from({ length: ROUNDS }).map((_, i) => (
              <div key={i} className={cn(
                "h-1.5 flex-1 rounded-full transition-colors duration-300",
                i < rounds.length
                  ? rounds[i].correct ? "bg-emerald-400" : "bg-rose-400"
                  : i === currentRound ? "bg-primary/60" : "bg-white/10"
              )} />
            ))}
          </div>
          <span className="text-xs font-bold tabular-nums text-muted-foreground">{currentRound + 1}/{ROUNDS}</span>
        </div>

        {phase === "idle" ? (
          <GlassCard glow>
            <GlassCardContent className="p-10 text-center space-y-6">
              <div className="text-8xl">🧠</div>
              <div>
                <h2 className="font-serif text-xl font-bold mb-2">Train Your EQ</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {ROUNDS} faces · {TIME_PER_ROUND / 1000}s each · up to +{ROUNDS * (ENERGY_PER_CORRECT + 2)} Neural Energy
                </p>
              </div>
              <LuxuryButton size="lg" className="w-full gap-2" onClick={() => startRound(0)}>
                <Zap className="w-5 h-5" /> Start Test
              </LuxuryButton>
            </GlassCardContent>
          </GlassCard>
        ) : (
          <>
            {/* Timer */}
            <div className="h-1.5 bg-white/8 rounded-full mb-6 overflow-hidden">
              <motion.div
                className={cn("h-full rounded-full transition-colors", timerPct > 40 ? "bg-primary" : timerPct > 20 ? "bg-amber-400" : "bg-rose-400")}
                style={{ width: `${timerPct}%` }}
              />
            </div>

            {/* Emoji face */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentRound}
                initial={{ scale: 0.6, opacity: 0, rotateY: -30 }}
                animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className={cn(
                  "w-full rounded-3xl border flex items-center justify-center py-10 mb-6",
                  currentEmotion.bg, currentEmotion.border
                )}
                style={{ boxShadow: `0 0 40px ${currentEmotion.glow}` }}
              >
                <span className="text-9xl select-none" style={{ lineHeight: 1 }}>
                  {currentEmotion.emoji}
                </span>
              </motion.div>
            </AnimatePresence>

            {/* Answer buttons */}
            <div className="grid grid-cols-2 gap-3">
              {options.map(emotion => {
                const isSelected = lastResult !== null && phase === "result"
                const isCorrect = emotion.id === currentEmotion.id
                const buttonState = !isSelected ? "neutral"
                  : isCorrect ? "correct"
                  : "wrong"

                return (
                  <motion.button
                    key={emotion.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => phase === "playing" && handleAnswer(emotion.id, currentEmotion.id, currentRound)}
                    disabled={phase !== "playing"}
                    className={cn(
                      "py-4 px-3 rounded-2xl border font-semibold text-sm transition-all duration-200",
                      buttonState === "neutral" && "bg-white/5 border-white/15 text-foreground hover:bg-white/10 hover:border-white/25",
                      buttonState === "correct" && "bg-emerald-400/20 border-emerald-400/50 text-emerald-300",
                      buttonState === "wrong" && "bg-rose-400/10 border-rose-400/25 text-muted-foreground opacity-60",
                    )}
                  >
                    <span className="text-2xl block mb-1">{emotion.emoji}</span>
                    {emotion.label}
                  </motion.button>
                )
              })}
            </div>

            {/* Score */}
            <div className="text-center mt-4">
              <span className="text-xs text-muted-foreground">
                Energy so far: <span className="text-primary font-bold">+{totalEnergy}</span>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
