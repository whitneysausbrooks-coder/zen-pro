import React, { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useLocation } from "wouter"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Trophy, RefreshCw, Zap, Brain, Share2, Layers, Timer, Target } from "lucide-react"
import { getGetProfileQueryKey, getGetActivitiesQueryKey } from "@workspace/api-client-react"
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { LuxuryButton } from "@/components/ui/luxury-button"
import { CelebrationOverlay } from "@/components/celebration-overlay"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

const GRID_SIZE = 4
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE
const BASE_ENERGY = 40
const PERFECT_BONUS = 30
const SPEED_BONUS = 20

const TILE_COLORS = [
  { active: "bg-primary/80 border-primary shadow-[0_0_20px_rgba(212,175,55,0.5)]", idle: "bg-white/5 border-white/10" },
  { active: "bg-cyan-400/70 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.5)]", idle: "bg-white/5 border-white/10" },
  { active: "bg-rose-400/70 border-rose-400 shadow-[0_0_20px_rgba(251,113,133,0.5)]", idle: "bg-white/5 border-white/10" },
  { active: "bg-violet-400/70 border-violet-400 shadow-[0_0_20px_rgba(167,139,250,0.5)]", idle: "bg-white/5 border-white/10" },
  { active: "bg-emerald-400/70 border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.5)]", idle: "bg-white/5 border-white/10" },
]

interface LevelConfig {
  level: number
  sequenceLength: number
  showTime: number
  label: string
  color: string
}

const LEVELS: LevelConfig[] = [
  { level: 1, sequenceLength: 3, showTime: 800,  label: "Awakening",   color: "text-emerald-400" },
  { level: 2, sequenceLength: 4, showTime: 700,  label: "Focused",     color: "text-cyan-400"    },
  { level: 3, sequenceLength: 5, showTime: 600,  label: "Sharpened",   color: "text-primary"     },
  { level: 4, sequenceLength: 6, showTime: 500,  label: "Heightened",  color: "text-violet-400"  },
  { level: 5, sequenceLength: 7, showTime: 450,  label: "Transcendent",color: "text-rose-400"    },
  { level: 6, sequenceLength: 8, showTime: 400,  label: "Neural Peak", color: "text-amber-400"   },
  { level: 7, sequenceLength: 9, showTime: 350,  label: "Mastery",     color: "text-primary"     },
]

type Phase = "idle" | "demo" | "input" | "feedback" | "complete"

function generateSequence(length: number): number[] {
  const seq: number[] = []
  for (let i = 0; i < length; i++) {
    let next: number
    do { next = Math.floor(Math.random() * TOTAL_CELLS) } while (seq[seq.length - 1] === next)
    seq.push(next)
  }
  return seq
}

export default function PatternPulse() {
  const [, navigate] = useLocation()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [phase, setPhase] = useState<Phase>("idle")
  const [currentLevel, setCurrentLevel] = useState(0)
  const [sequence, setSequence] = useState<number[]>([])
  const [playerInput, setPlayerInput] = useState<number[]>([])
  const [activeCell, setActiveCell] = useState<number | null>(null)
  const [correctCells, setCorrectCells] = useState<Set<number>>(new Set())
  const [wrongCell, setWrongCell] = useState<number | null>(null)
  const [highestLevel, setHighestLevel] = useState(0)
  const [totalCorrect, setTotalCorrect] = useState(0)
  const [perfectRounds, setPerfectRounds] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [energyAwarded, setEnergyAwarded] = useState(0)
  const [celebration, setCelebration] = useState<{
    type: "energy" | "level-up"; amount?: number; title: string; subtitle: string
  } | null>(null)

  const demoIdxRef = useRef(0)
  const demoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const level = LEVELS[Math.min(currentLevel, LEVELS.length - 1)]

  const cleanup = useCallback(() => {
    if (demoTimerRef.current) clearTimeout(demoTimerRef.current)
  }, [])

  useEffect(() => cleanup, [cleanup])

  const startDemo = useCallback((seq: number[], lvl: LevelConfig) => {
    setPhase("demo")
    setPlayerInput([])
    setCorrectCells(new Set())
    setWrongCell(null)
    demoIdxRef.current = 0

    const showNext = () => {
      if (demoIdxRef.current >= seq.length) {
        setActiveCell(null)
        setTimeout(() => {
          setPhase("input")
          setStartTime(Date.now())
        }, 300)
        return
      }
      setActiveCell(seq[demoIdxRef.current])
      demoTimerRef.current = setTimeout(() => {
        setActiveCell(null)
        demoIdxRef.current++
        demoTimerRef.current = setTimeout(showNext, 200)
      }, lvl.showTime)
    }

    demoTimerRef.current = setTimeout(showNext, 600)
  }, [])

  const startGame = useCallback(() => {
    setCurrentLevel(0)
    setHighestLevel(0)
    setTotalCorrect(0)
    setPerfectRounds(0)
    setElapsedMs(0)
    setEnergyAwarded(0)
    const seq = generateSequence(LEVELS[0].sequenceLength)
    setSequence(seq)
    startDemo(seq, LEVELS[0])
  }, [startDemo])

  const advanceLevel = useCallback((nextLevel: number) => {
    const lvl = LEVELS[Math.min(nextLevel, LEVELS.length - 1)]
    const seq = generateSequence(lvl.sequenceLength)
    setCurrentLevel(nextLevel)
    setSequence(seq)
    startDemo(seq, lvl)
  }, [startDemo])

  const handleCellClick = useCallback((cellIdx: number) => {
    if (phase !== "input") return

    const inputIdx = playerInput.length
    const isCorrect = sequence[inputIdx] === cellIdx

    if (isCorrect) {
      const newInput = [...playerInput, cellIdx]
      setPlayerInput(newInput)
      setCorrectCells(prev => new Set([...prev, cellIdx]))

      setActiveCell(cellIdx)
      setTimeout(() => setActiveCell(null), 150)

      if (newInput.length === sequence.length) {
        const elapsed = Date.now() - startTime
        setElapsedMs(elapsed)
        setTotalCorrect(prev => prev + sequence.length)
        setPerfectRounds(prev => prev + 1)
        const nextLevel = currentLevel + 1
        setHighestLevel(Math.max(highestLevel, nextLevel))
        setCurrentLevel(nextLevel)

        if (nextLevel >= LEVELS.length) {
          setPhase("feedback")
          setTimeout(() => {
            const energy = BASE_ENERGY + PERFECT_BONUS + (elapsed < 15000 ? SPEED_BONUS : 0)
            setEnergyAwarded(energy)
            setPhase("complete")
            awardEnergy(energy)
          }, 1200)
        } else {
          setPhase("feedback")
          setTimeout(() => advanceLevel(nextLevel), 1200)
        }
      }
    } else {
      setWrongCell(cellIdx)
      setTotalCorrect(prev => prev + playerInput.length)
      const elapsed = Date.now() - startTime
      setElapsedMs(elapsed)

      if (navigator.vibrate) navigator.vibrate(100)

      setTimeout(() => {
        const levelsCompleted = currentLevel
        const energy = Math.max(10, Math.floor(BASE_ENERGY * (levelsCompleted / LEVELS.length)) + (levelsCompleted >= 3 ? 15 : 0))
        setEnergyAwarded(energy)
        setPhase("complete")
        awardEnergy(energy)
      }, 1000)
    }
  }, [phase, playerInput, sequence, currentLevel, highestLevel, startTime, advanceLevel])

  const awardEnergy = async (amount: number) => {
    try {
      const [gameRes] = await Promise.all([
        fetch(`${BASE}/api/quest/game-complete`, { method: "POST", credentials: "include" }),
        amount > 50 ? fetch(`${BASE}/api/quest/earn-energy`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activity: "Pattern Pulse Bonus", amount: amount - 50 }),
        }) : Promise.resolve(null),
      ])
      queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() })
      queryClient.invalidateQueries({ queryKey: getGetActivitiesQueryKey() })

      const data = await gameRes.json()
      const levelsReached = currentLevel + 1

      if (data.level_changed) {
        setCelebration({
          type: "level-up",
          title: `Level ${data.new_level} — ${data.new_title}`,
          subtitle: "Your visual-spatial practice is building new neural pathways.",
        })
      } else if (data.streak_broken && data.previous_streak > 1) {
        setCelebration({
          type: "energy",
          amount,
          title: "Welcome back.",
          subtitle: `You built a ${data.previous_streak}-day streak before. That growth is still in you. Day 1 starts now.`,
        })
      } else {
        setCelebration({
          type: levelsReached >= LEVELS.length ? "level-up" : "energy",
          amount,
          title: levelsReached >= LEVELS.length
            ? "All 7 levels mastered."
            : `Level ${levelsReached} reached.`,
          subtitle: levelsReached >= LEVELS.length
            ? "Peak visual-spatial performance. Your working memory is elite."
            : data.streak_extended
            ? `${data.streak.streak_count}-day streak — your brain is adapting.`
            : "Your visual-spatial pathways grow stronger with each pattern.",
        })
      }
    } catch {}
  }

  const colorScheme = TILE_COLORS[currentLevel % TILE_COLORS.length]

  return (
    <div className="min-h-screen relative overflow-hidden pb-20">
      <CelebrationOverlay celebration={celebration} onDone={() => setCelebration(null)} />

      <div
        className="absolute inset-0 z-0 opacity-40 mix-blend-overlay pointer-events-none bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/zen-bg.png)` }}
      />

      <div className="relative z-10 max-w-lg mx-auto px-4 sm:px-6 pt-10">
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to Dashboard</span>
        </motion.button>

        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-violet-400/20 rounded-2xl border border-violet-400/30">
              <Layers className="w-7 h-7 text-violet-400" />
            </div>
          </div>
          <h1 className="text-3xl font-serif font-bold text-gradient-gold mb-1">Pattern Pulse</h1>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Watch the sequence. Repeat it from memory. Train your visual-spatial working memory.
          </p>
        </motion.div>

        {phase === "idle" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <GlassCard>
              <GlassCardHeader>
                <GlassCardTitle className="flex items-center gap-2 text-lg">
                  <Brain className="w-5 h-5 text-violet-400" />
                  How It Works
                </GlassCardTitle>
              </GlassCardHeader>
              <GlassCardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: <Target className="w-5 h-5 text-primary" />, label: "Watch", desc: "Tiles light up in sequence" },
                    { icon: <Layers className="w-5 h-5 text-violet-400" />, label: "Remember", desc: "Memorise the exact order" },
                    { icon: <Zap className="w-5 h-5 text-emerald-400" />, label: "Repeat", desc: "Tap tiles in the same order" },
                  ].map(({ icon, label, desc }) => (
                    <div key={label} className="text-center p-3 rounded-xl bg-white/5 border border-white/8">
                      <div className="flex justify-center mb-2">{icon}</div>
                      <p className="text-xs font-bold text-foreground">{label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-primary shrink-0" /> 7 progressive levels — sequences get longer and faster</p>
                  <p className="flex items-center gap-2"><Trophy className="w-3.5 h-3.5 text-primary shrink-0" /> Perfect all 7 levels for a bonus reward</p>
                  <p className="flex items-center gap-2"><Timer className="w-3.5 h-3.5 text-primary shrink-0" /> Finish quickly for an extra speed bonus</p>
                </div>
              </GlassCardContent>
            </GlassCard>

            <GlassCard>
              <GlassCardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Levels</span>
                  <span className="text-xs text-primary font-bold">Up to +{BASE_ENERGY + PERFECT_BONUS + SPEED_BONUS} ⚡</span>
                </div>
                <div className="flex gap-1.5">
                  {LEVELS.map((l) => (
                    <div key={l.level} className="flex-1 text-center">
                      <div className={cn("text-[10px] font-bold mb-1", l.color)}>{l.level}</div>
                      <div className="h-1.5 rounded-full bg-white/5 border border-white/8">
                        <div className={cn("h-full rounded-full", l.color.replace("text-", "bg-").replace("400", "400/40"))} style={{ width: "0%" }} />
                      </div>
                      <div className="text-[9px] text-white/30 mt-0.5">{l.sequenceLength}</div>
                    </div>
                  ))}
                </div>
              </GlassCardContent>
            </GlassCard>

            <LuxuryButton size="lg" className="w-full gap-2 text-base" onClick={startGame}>
              <Brain className="w-5 h-5" /> Begin Training
            </LuxuryButton>
          </motion.div>
        )}

        {(phase === "demo" || phase === "input" || phase === "feedback") && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={cn("text-xs font-bold uppercase tracking-widest", level.color)}>
                  Level {level.level}
                </span>
                <span className="text-xs text-white/30">·</span>
                <span className="text-xs text-muted-foreground">{level.label}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                <Layers className="w-3 h-3 text-violet-400" />
                <span className="text-xs font-bold text-violet-300">{level.sequenceLength} tiles</span>
              </div>
            </div>

            <div className="flex justify-center">
              <AnimatePresence mode="wait">
                {phase === "demo" && (
                  <motion.p key="watch" initial={{ opacity: 0 }} animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.2 }}
                    className="text-sm font-medium text-violet-300 tracking-widest uppercase"
                  >
                    Watch carefully…
                  </motion.p>
                )}
                {phase === "input" && (
                  <motion.p key="go" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    className="text-sm font-bold text-primary tracking-widest uppercase"
                  >
                    Your turn — {playerInput.length}/{sequence.length}
                  </motion.p>
                )}
                {phase === "feedback" && (
                  <motion.p key="nice" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    className="text-sm font-bold text-emerald-400 tracking-widest uppercase"
                  >
                    Perfect ✓
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <GlassCard>
              <GlassCardContent className="p-4">
                <div className="grid grid-cols-4 gap-2.5 aspect-square max-w-[320px] mx-auto">
                  {Array.from({ length: TOTAL_CELLS }, (_, i) => {
                    const isActive = activeCell === i
                    const isCorrectTap = correctCells.has(i)
                    const isWrong = wrongCell === i
                    const isInputPhase = phase === "input"

                    return (
                      <motion.button
                        key={i}
                        onClick={() => handleCellClick(i)}
                        disabled={!isInputPhase}
                        animate={isActive ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                        transition={{ duration: 0.15 }}
                        className={cn(
                          "aspect-square rounded-xl border-2 transition-all duration-150",
                          isWrong
                            ? "bg-red-500/50 border-red-400 shadow-[0_0_16px_rgba(239,68,68,0.6)]"
                            : isActive
                              ? colorScheme.active
                              : isCorrectTap && phase === "input"
                                ? "bg-emerald-400/20 border-emerald-400/40"
                                : colorScheme.idle,
                          isInputPhase && !isWrong
                            ? "cursor-pointer hover:bg-white/10 hover:border-white/20 active:scale-95"
                            : "cursor-default"
                        )}
                      />
                    )
                  })}
                </div>
              </GlassCardContent>
            </GlassCard>

            <div className="flex justify-center gap-1.5">
              {LEVELS.map((l, i) => (
                <div
                  key={l.level}
                  className={cn(
                    "w-2.5 h-2.5 rounded-full border transition-all",
                    i < currentLevel
                      ? "bg-emerald-400 border-emerald-400/60"
                      : i === currentLevel
                        ? cn(level.color.replace("text-", "bg-"), "border-current animate-pulse")
                        : "bg-white/5 border-white/10"
                  )}
                />
              ))}
            </div>
          </motion.div>
        )}

        {phase === "complete" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <GlassCard glow>
              <GlassCardContent className="p-8 text-center space-y-5">
                <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} transition={{ type: "spring", stiffness: 260, damping: 14 }}>
                  <div className="w-20 h-20 mx-auto rounded-full bg-violet-400/20 border border-violet-400/40 flex items-center justify-center">
                    <Trophy className="w-10 h-10 text-violet-400" />
                  </div>
                </motion.div>

                <div>
                  <h2 className="text-2xl font-serif font-bold text-gradient-gold mb-1">
                    {currentLevel >= LEVELS.length ? "Neural Mastery!" : "Training Complete"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {currentLevel >= LEVELS.length
                      ? "You conquered all 7 levels — your visual-spatial memory is exceptional."
                      : `You reached Level ${currentLevel + 1} — ${level.label}. Keep training to unlock deeper focus.`}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/8 text-center">
                    <p className="text-lg font-bold text-violet-400">{currentLevel}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Levels</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/8 text-center">
                    <p className="text-lg font-bold text-cyan-400">{totalCorrect}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Correct</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/8 text-center">
                    <p className="text-lg font-bold text-primary">{(elapsedMs / 1000).toFixed(1)}s</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Time</p>
                  </div>
                </div>

                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-3xl font-bold text-primary"
                >
                  +{energyAwarded} Neural Energy
                </motion.div>
                {currentLevel >= LEVELS.length && (
                  <p className="text-xs text-emerald-400">Includes Perfect Completion bonus ✓</p>
                )}

                <div className="flex gap-3 pt-2">
                  <LuxuryButton variant="outline" className="flex-1 gap-2" onClick={startGame}>
                    <RefreshCw className="w-4 h-4" /> Play Again
                  </LuxuryButton>
                  <LuxuryButton
                    variant="glass"
                    className="flex-1 gap-2 border-violet-400/30 hover:border-violet-400/60"
                    onClick={async () => {
                      const text = currentLevel >= LEVELS.length
                        ? `Neural Mastery! 🧠 I conquered all 7 levels of Pattern Pulse on NeuroQuest and earned +${energyAwarded} Neural Energy™! Can you match my visual-spatial memory? #NeuroQuest #PatternPulse`
                        : `I reached Level ${currentLevel + 1} on Pattern Pulse — NeuroQuest's visual memory challenge! +${energyAwarded} Neural Energy™ earned. 🧠 #NeuroQuest #PatternPulse`
                      const url = typeof window !== "undefined" ? window.location.origin + BASE : ""
                      const copyFallback = async () => {
                        try {
                          await navigator.clipboard.writeText(`${text}\n\n${url}`)
                          toast({ title: "Copied!", description: "Your result has been copied to clipboard." })
                        } catch {
                          toast({ title: "Share", description: text })
                        }
                      }
                      if (navigator.share) {
                        try { await navigator.share({ title: "Pattern Pulse — NeuroQuest", text, url }) }
                        catch (e: any) { if (e?.name !== "AbortError") await copyFallback() }
                      } else {
                        await copyFallback()
                      }
                    }}
                  >
                    <Share2 className="w-4 h-4" /> Share
                  </LuxuryButton>
                </div>
                <LuxuryButton variant="outline" className="w-full gap-2" onClick={() => navigate("/")}>
                  Back to Dashboard
                </LuxuryButton>
              </GlassCardContent>
            </GlassCard>

            <GlassCard>
              <GlassCardContent className="p-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="text-white font-semibold">The Science.</span> Pattern Pulse trains your{" "}
                  <span className="text-violet-300">visual-spatial working memory</span> — the brain's ability to hold and manipulate
                  visual information. Research shows that working memory capacity is one of the strongest predictors of fluid intelligence
                  and can be improved through targeted training. Each level increases cognitive load, strengthening prefrontal cortex
                  and parietal lobe connectivity.
                </p>
              </GlassCardContent>
            </GlassCard>
          </motion.div>
        )}
      </div>
    </div>
  )
}
