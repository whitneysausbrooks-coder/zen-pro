import React, { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useLocation } from "wouter"
import { useQueryClient } from "@tanstack/react-query"
import {
  Brain, Flame, Leaf, Moon, Sun, Star, Eye, Wind,
  ArrowLeft, Trophy, RefreshCw, Zap, CheckCircle2
} from "lucide-react"
import { useEarnEnergy, getGetProfileQueryKey, getGetActivitiesQueryKey } from "@workspace/api-client-react"
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card"
import { LuxuryButton } from "@/components/ui/luxury-button"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const SYMBOLS = [
  { id: "brain",  Icon: Brain,  color: "text-primary",     bg: "bg-primary/20"     },
  { id: "flame",  Icon: Flame,  color: "text-orange-400",  bg: "bg-orange-400/20"  },
  { id: "leaf",   Icon: Leaf,   color: "text-emerald-400", bg: "bg-emerald-400/20" },
  { id: "moon",   Icon: Moon,   color: "text-indigo-300",  bg: "bg-indigo-300/20"  },
  { id: "sun",    Icon: Sun,    color: "text-yellow-300",  bg: "bg-yellow-300/20"  },
  { id: "star",   Icon: Star,   color: "text-primary",     bg: "bg-primary/20"     },
  { id: "eye",    Icon: Eye,    color: "text-sky-400",     bg: "bg-sky-400/20"     },
  { id: "wind",   Icon: Wind,   color: "text-teal-300",    bg: "bg-teal-300/20"    },
]

type CardState = "hidden" | "flipped" | "matched"

interface Card {
  uid: number
  symbolId: string
  symbolIdx: number
  state: CardState
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildDeck(): Card[] {
  const pairs: Card[] = []
  SYMBOLS.forEach((sym, idx) => {
    pairs.push({ uid: idx * 2,     symbolId: sym.id, symbolIdx: idx, state: "hidden" })
    pairs.push({ uid: idx * 2 + 1, symbolId: sym.id, symbolIdx: idx, state: "hidden" })
  })
  return shuffle(pairs)
}

type GamePhase = "idle" | "playing" | "complete"

export default function MemoryMatch() {
  const [, navigate] = useLocation()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [phase, setPhase]     = useState<GamePhase>("idle")
  const [cards, setCards]     = useState<Card[]>([])
  const [flipped, setFlipped] = useState<number[]>([])
  const [moves, setMoves]     = useState(0)
  const [matches, setMatches] = useState(0)
  const [locked, setLocked]   = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [rewarded, setRewarded] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { mutate: earnEnergy } = useEarnEnergy({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() })
        queryClient.invalidateQueries({ queryKey: getGetActivitiesQueryKey() })
        toast({ title: "+50 Neural Energy!", description: "Memory Match complete. Your mind expands." })
      }
    }
  })

  const startGame = useCallback(() => {
    setCards(buildDeck())
    setFlipped([])
    setMoves(0)
    setMatches(0)
    setLocked(false)
    setElapsed(0)
    setRewarded(false)
    setPhase("playing")
  }, [])

  useEffect(() => {
    if (phase === "playing") {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase])

  useEffect(() => {
    if (matches === 8 && phase === "playing") {
      if (timerRef.current) clearInterval(timerRef.current)
      setPhase("complete")
    }
  }, [matches, phase])

  useEffect(() => {
    if (phase === "complete" && !rewarded) {
      setRewarded(true)
      setTimeout(() => {
        earnEnergy({ data: { activity: "Memory Match", amount: 50 } })
      }, 600)
    }
  }, [phase, rewarded, earnEnergy])

  const handleFlip = (uid: number) => {
    if (locked || phase !== "playing") return
    const card = cards.find(c => c.uid === uid)
    if (!card || card.state !== "hidden" || flipped.includes(uid)) return
    if (flipped.length === 1 && flipped[0] === uid) return

    const nextFlipped = [...flipped, uid]

    setCards(prev => prev.map(c => c.uid === uid ? { ...c, state: "flipped" } : c))
    setFlipped(nextFlipped)

    if (nextFlipped.length === 2) {
      setMoves(m => m + 1)
      setLocked(true)

      const [a, b] = nextFlipped.map(id => cards.find(c => c.uid === id)!)
      if (a.symbolId === b.symbolId) {
        setTimeout(() => {
          setCards(prev => prev.map(c =>
            nextFlipped.includes(c.uid) ? { ...c, state: "matched" } : c
          ))
          setMatches(m => m + 1)
          setFlipped([])
          setLocked(false)
        }, 400)
      } else {
        setTimeout(() => {
          setCards(prev => prev.map(c =>
            nextFlipped.includes(c.uid) ? { ...c, state: "hidden" } : c
          ))
          setFlipped([])
          setLocked(false)
        }, 900)
      }
    }
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    return `${m}:${String(s % 60).padStart(2, "0")}`
  }

  return (
    <div className="min-h-screen relative overflow-hidden pb-20">
      <div
        className="absolute inset-0 z-0 opacity-40 mix-blend-overlay pointer-events-none bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/zen-bg.png)` }}
      />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pt-10">
        {/* Back nav */}
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
          <div className="inline-flex items-center gap-3 mb-3">
            <Brain className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-serif font-bold text-gradient-gold">Neural Stake</h1>
          </div>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            Match all 8 pairs to earn <span className="text-primary font-bold">+50 Neural Energy</span>. Train your pattern recognition.
          </p>
        </motion.div>

        {/* Stats bar — shown while playing or complete */}
        {phase !== "idle" && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center gap-6 mb-6"
          >
            <div className="glass-panel px-4 py-2 rounded-full flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{moves} moves</span>
            </div>
            <div className="glass-panel px-4 py-2 rounded-full flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium">{matches}/8 matched</span>
            </div>
            <div className="glass-panel px-4 py-2 rounded-full text-sm font-medium tabular-nums">
              {formatTime(elapsed)}
            </div>
          </motion.div>
        )}

        {/* Idle / start screen */}
        {phase === "idle" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-8 py-16"
          >
            <GlassCard glow className="w-full max-w-sm">
              <GlassCardContent className="p-8 text-center space-y-4">
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {SYMBOLS.map(({ id, Icon, color, bg }) => (
                    <div key={id} className={cn("rounded-xl p-3 flex items-center justify-center", bg)}>
                      <Icon className={cn("w-6 h-6", color)} />
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">16 cards · 8 symbol pairs</p>
                <p className="text-xs text-muted-foreground/70">Flip two cards at a time. Find all matching pairs to win.</p>
              </GlassCardContent>
            </GlassCard>
            <LuxuryButton size="lg" onClick={startGame} className="gap-3 px-10">
              <Brain className="w-5 h-5" />
              Begin Neural Stake
            </LuxuryButton>
          </motion.div>
        )}

        {/* Game grid */}
        {phase !== "idle" && (
          <div className="grid grid-cols-4 gap-3 sm:gap-4">
            {cards.map((card) => {
              const sym = SYMBOLS[card.symbolIdx]
              const isVisible = card.state === "flipped" || card.state === "matched"
              return (
                <motion.div
                  key={card.uid}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: card.uid * 0.025, type: "spring", stiffness: 260, damping: 22 }}
                  className="aspect-square"
                  style={{ perspective: 600 }}
                >
                  <motion.div
                    className="w-full h-full relative cursor-pointer"
                    style={{ transformStyle: "preserve-3d" }}
                    animate={{ rotateY: isVisible ? 180 : 0 }}
                    transition={{ duration: 0.35, ease: "easeInOut" }}
                    onClick={() => handleFlip(card.uid)}
                  >
                    {/* Card back */}
                    <div
                      className="absolute inset-0 rounded-2xl glass-panel border border-primary/20 flex items-center justify-center"
                      style={{ backfaceVisibility: "hidden" }}
                    >
                      <div className="w-5 h-5 rounded-full border-2 border-primary/40 opacity-60" />
                    </div>

                    {/* Card front */}
                    <div
                      className={cn(
                        "absolute inset-0 rounded-2xl flex items-center justify-center transition-colors duration-300",
                        card.state === "matched"
                          ? `${sym.bg} border-2 border-current ${sym.color} ring-2 ring-current/30`
                          : `${sym.bg} border border-white/10`
                      )}
                      style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                    >
                      <sym.Icon className={cn("w-9 h-9 sm:w-10 sm:h-10", sym.color,
                        card.state === "matched" && "drop-shadow-[0_0_8px_currentColor]"
                      )} />
                    </div>
                  </motion.div>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* Replay button */}
        {phase === "playing" && (
          <div className="flex justify-center mt-8">
            <LuxuryButton variant="ghost" size="sm" onClick={startGame} className="gap-2 opacity-60 hover:opacity-100">
              <RefreshCw className="w-4 h-4" /> Restart
            </LuxuryButton>
          </div>
        )}
      </div>

      {/* Completion overlay */}
      <AnimatePresence>
        {phase === "complete" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <GlassCard glow className="w-full max-w-sm text-center">
                <GlassCardContent className="p-10 space-y-5">
                  <motion.div
                    initial={{ rotate: -20, scale: 0 }}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 280, damping: 18 }}
                    className="flex justify-center"
                  >
                    <Trophy className="w-16 h-16 text-primary drop-shadow-[0_0_16px_rgba(212,175,55,0.7)]" />
                  </motion.div>

                  <div>
                    <h2 className="text-2xl font-serif font-bold text-gradient-gold mb-1">Mind Mastered</h2>
                    <p className="text-sm text-muted-foreground">All 8 pairs found</p>
                  </div>

                  <div className="flex justify-center gap-6 text-sm">
                    <div>
                      <p className="text-muted-foreground">Moves</p>
                      <p className="text-xl font-serif font-bold text-foreground">{moves}</p>
                    </div>
                    <div className="w-px bg-white/10" />
                    <div>
                      <p className="text-muted-foreground">Time</p>
                      <p className="text-xl font-serif font-bold text-foreground">{formatTime(elapsed)}</p>
                    </div>
                  </div>

                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.5, type: "spring" }}
                    className="inline-flex items-center gap-2 bg-primary/20 border border-primary/40 rounded-full px-5 py-2"
                  >
                    <Zap className="w-4 h-4 text-primary" />
                    <span className="font-bold text-primary">+50 Neural Energy</span>
                  </motion.div>

                  <div className="flex gap-3 justify-center pt-2">
                    <LuxuryButton variant="outline" size="sm" onClick={startGame} className="gap-2">
                      <RefreshCw className="w-4 h-4" /> Play Again
                    </LuxuryButton>
                    <LuxuryButton size="sm" onClick={() => navigate("/")} className="gap-2">
                      <ArrowLeft className="w-4 h-4" /> Dashboard
                    </LuxuryButton>
                  </div>
                </GlassCardContent>
              </GlassCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
