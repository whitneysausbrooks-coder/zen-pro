import React, { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useLocation } from "wouter"
import { useQueryClient } from "@tanstack/react-query"
import { Brain, Eye, ArrowLeft, Zap, RefreshCw, HelpCircle } from "lucide-react"
import { getGetProfileQueryKey, getGetActivitiesQueryKey, useGetProfile } from "@workspace/api-client-react"
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { LuxuryButton } from "@/components/ui/luxury-button"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")
const FOCUS_OPTIONS = [10, 25, 50]
const MIND_READ_BONUS = 0.6 // 60% extra on payout if prediction correct

/* ── Card types ─────────────────────────────────────────────────────────── */
type Suit = "♠" | "♥" | "♦" | "♣"
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const
type Rank = typeof RANKS[number]

interface Card { suit: Suit; rank: Rank; value: number; faceDown?: boolean }

function cardValue(rank: Rank): number {
  if (rank === "A") return 11
  if (["J", "Q", "K"].includes(rank)) return 10
  return parseInt(rank)
}

function isHighCard(card: Card) { return card.value >= 8 }

function buildDeck(): Card[] {
  const suits: Suit[] = ["♠", "♥", "♦", "♣"]
  const deck: Card[] = []
  for (const suit of suits) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, value: cardValue(rank) })
    }
  }
  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

function handTotal(hand: Card[]): number {
  let total = 0
  let aces = 0
  for (const c of hand) {
    total += c.value
    if (c.rank === "A") aces++
  }
  while (total > 21 && aces > 0) { total -= 10; aces-- }
  return total
}

function handLabel(hand: Card[]): string {
  const t = handTotal(hand)
  if (hand.length === 2 && t === 21) return "Blackjack!"
  if (t > 21) return "Bust"
  return `${t}`
}

/* ── Card Component ──────────────────────────────────────────────────────── */
function CardView({ card, delay = 0 }: { card: Card; delay?: number }) {
  const isRed = card.suit === "♥" || card.suit === "♦"

  if (card.faceDown) {
    return (
      <motion.div
        initial={{ rotateY: 180, scale: 0.5, opacity: 0 }}
        animate={{ rotateY: 0, scale: 1, opacity: 1 }}
        transition={{ delay, type: "spring", stiffness: 260, damping: 20 }}
        className="w-16 sm:w-20 h-24 sm:h-28 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center"
      >
        <Eye className="w-6 h-6 text-primary/40" />
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ rotateY: 90, scale: 0.5, opacity: 0 }}
      animate={{ rotateY: 0, scale: 1, opacity: 1 }}
      transition={{ delay, type: "spring", stiffness: 260, damping: 20 }}
      className="w-16 sm:w-20 h-24 sm:h-28 rounded-xl bg-white/6 border border-white/15 flex flex-col p-2"
    >
      <span className={cn("text-sm font-bold leading-none", isRed ? "text-rose-400" : "text-white")}>{card.rank}</span>
      <span className={cn("text-xs leading-none", isRed ? "text-rose-400" : "text-white")}>{card.suit}</span>
      <span className={cn("text-3xl text-center flex-1 flex items-center justify-center leading-none select-none", isRed ? "text-rose-400" : "text-white/80")}>
        {card.suit}
      </span>
    </motion.div>
  )
}

/* ── Game phases ─────────────────────────────────────────────────────────── */
type GamePhase = "bet" | "mind-read" | "player-turn" | "dealer-turn" | "result"
type MindReadChoice = "high" | "low" | null
type GameResult = "win" | "blackjack" | "push" | "lose" | "bust"

export default function Blackjack() {
  const [, navigate] = useLocation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: profile } = useGetProfile()

  const [phase, setPhase] = useState<GamePhase>("bet")
  const [bet, setBet] = useState(10)
  // Note: "bet" is used internally only; UI says "Focus Energy"
  const [deck, setDeck] = useState<Card[]>([])
  const [playerHand, setPlayerHand] = useState<Card[]>([])
  const [dealerHand, setDealerHand] = useState<Card[]>([])
  const [mindRead, setMindRead] = useState<MindReadChoice>(null)
  const [mindReadCorrect, setMindReadCorrect] = useState<boolean | null>(null)
  const [result, setResult] = useState<GameResult | null>(null)
  const [netChange, setNetChange] = useState(0)
  const [sessionTotal, setSessionTotal] = useState(0)

  const dealCards = useCallback(() => {
    if (!profile || profile.neural_energy < bet) {
      toast({ title: "Not enough Neural Energy", variant: "destructive" })
      return
    }
    const d = buildDeck()
    const p = [d[0], d[2]]
    const dealer = [d[1], { ...d[3], faceDown: true }]
    setDeck(d.slice(4))
    setPlayerHand(p)
    setDealerHand(dealer)
    setMindRead(null)
    setMindReadCorrect(null)
    setResult(null)
    setNetChange(0)
    setPhase("mind-read")
  }, [profile, bet, toast])

  const handleMindRead = useCallback((choice: MindReadChoice) => {
    setMindRead(choice)
    setPhase("player-turn")
  }, [])

  const hit = useCallback(() => {
    if (deck.length === 0) return
    const [newCard, ...rest] = deck
    const newHand = [...playerHand, newCard]
    setDeck(rest)
    setPlayerHand(newHand)
    if (handTotal(newHand) > 21) {
      resolveDealerAndResult(dealerHand, newHand, mindRead, deck.slice(1))
    }
  }, [deck, playerHand, dealerHand, mindRead])

  const stand = useCallback(() => {
    resolveDealerAndResult(dealerHand, playerHand, mindRead, deck)
  }, [dealerHand, playerHand, mindRead, deck])

  const resolveDealerAndResult = useCallback(async (
    dHand: Card[], pHand: Card[], mindReadPick: MindReadChoice, remaining: Card[]
  ) => {
    setPhase("dealer-turn")

    // Reveal dealer's hole card
    const revealed = dHand.map(c => ({ ...c, faceDown: false }))
    const holeCard = revealed[1]

    // Check mind-read
    const predicted = mindReadPick === "high" ? isHighCard(holeCard) : !isHighCard(holeCard)
    setMindReadCorrect(predicted)

    // Dealer draws to 17
    let curDeck = [...remaining]
    let curDealerHand = [...revealed]
    while (handTotal(curDealerHand) < 17 && curDeck.length > 0) {
      curDealerHand = [...curDealerHand, { ...curDeck[0], faceDown: false }]
      curDeck = curDeck.slice(1)
    }

    setDealerHand(curDealerHand)
    setDeck(curDeck)

    const pTotal = handTotal(pHand)
    const dTotal = handTotal(curDealerHand)
    const isBlackjack = pHand.length === 2 && pTotal === 21

    let gameResult: GameResult
    if (pTotal > 21) gameResult = "bust"
    else if (isBlackjack && dTotal !== 21) gameResult = "blackjack"
    else if (dTotal > 21 || pTotal > dTotal) gameResult = "win"
    else if (pTotal === dTotal) gameResult = "push"
    else gameResult = "lose"

    setResult(gameResult)
    setPhase("result")

    // Calculate payout
    let change = -bet
    if (gameResult === "blackjack") change = Math.floor(bet * 1.5)
    else if (gameResult === "win") change = predicted ? Math.floor(bet * (1 + MIND_READ_BONUS)) : bet
    else if (gameResult === "push") change = 0
    // bust/lose: already -bet

    setNetChange(change)
    setSessionTotal(s => s + change)

    // Apply to server
    if (change !== 0) {
      try {
        await fetch(`${BASE}/api/quest/earn-energy`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            activity: `Mind-Reader Blackjack – ${gameResult}${predicted ? " (Mind Read Bonus)" : ""}`,
            amount: change,
          }),
        })
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() })
        queryClient.invalidateQueries({ queryKey: getGetActivitiesQueryKey() })
      } catch {}
    } else {
      // Push: still deducted cost, so need to refund
      await fetch(`${BASE}/api/quest/earn-energy`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activity: "Mind-Reader Blackjack – Push (refund)", amount: 0 }),
      }).catch(() => {})
    }
  }, [bet, queryClient])

  const resetBet = () => {
    setPhase("bet")
    setPlayerHand([])
    setDealerHand([])
    setMindRead(null)
    setMindReadCorrect(null)
    setResult(null)
    setNetChange(0)
  }

  const resultColor: Record<GameResult, string> = {
    win: "text-emerald-400", blackjack: "text-primary", push: "text-muted-foreground",
    lose: "text-rose-400", bust: "text-rose-500"
  }
  const resultLabel: Record<GameResult, string> = {
    win: "You Win!", blackjack: "Blackjack!", push: "Push", lose: "Dealer Wins", bust: "Bust!"
  }

  const energy = profile?.neural_energy ?? 0

  return (
    <div className="min-h-screen relative overflow-hidden pb-20">
      <div className="relative z-10 max-w-lg mx-auto px-4 pt-10">
        {/* Back */}
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to Dashboard</span>
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <Brain className="w-7 h-7 text-primary" />
            <h1 className="text-3xl font-serif font-bold text-gradient-gold">Mind-Reader Blackjack</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Predict the dealer's hidden card to earn a{" "}
            <span className="text-primary font-bold">{Math.round(MIND_READ_BONUS * 100)}% bonus</span> on your win.
          </p>
        </div>

        {/* Balance + Session */}
        <div className="flex gap-3 justify-center mb-8">
          <div className="glass-panel px-4 py-2 rounded-full flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium tabular-nums">{energy} energy</span>
          </div>
          {sessionTotal !== 0 && (
            <div className={cn("glass-panel px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium", sessionTotal > 0 ? "text-emerald-400" : "text-rose-400")}>
              <Zap className="w-4 h-4" />
              Session: {sessionTotal > 0 ? "+" : ""}{sessionTotal}
            </div>
          )}
        </div>

        {/* BET PHASE */}
        {phase === "bet" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <GlassCard glow>
              <GlassCardHeader>
                <GlassCardTitle className="text-xl">Set Your Focus</GlassCardTitle>
              </GlassCardHeader>
              <GlassCardContent className="space-y-6 pb-8">
                <div className="flex gap-3 justify-center">
                  {FOCUS_OPTIONS.map(b => (
                    <button
                      key={b}
                      onClick={() => setBet(b)}
                      className={cn(
                        "w-20 py-4 rounded-2xl border font-serif font-bold text-lg transition-all duration-200",
                        bet === b
                          ? "bg-primary/20 border-primary/60 text-primary shadow-[0_0_16px_rgba(212,175,55,0.35)]"
                          : "bg-white/4 border-white/15 text-white/60 hover:bg-white/8"
                      )}
                    >
                      {b}
                    </button>
                  ))}
                </div>
                <p className="text-center text-xs text-muted-foreground">Neural Energy to focus</p>

                <div className="rounded-2xl bg-cyan-400/5 border border-cyan-400/20 px-4 py-3 flex items-start gap-3">
                  <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span className="text-cyan-300 font-semibold">Mind Read mechanic:</span> After the deal, predict if the dealer's hidden card is High (8+) or Low (2–7). A correct read adds a <span className="text-primary">{Math.round(MIND_READ_BONUS * 100)}% bonus</span> to any win.
                  </p>
                </div>

                <LuxuryButton
                  size="lg"
                  className="w-full gap-2"
                  onClick={dealCards}
                  disabled={energy < bet}
                >
                  <Zap className="w-5 h-5" />
                  {energy < bet ? "Insufficient Energy" : `Deal Cards (−${bet})`}
                </LuxuryButton>
              </GlassCardContent>
            </GlassCard>
          </motion.div>
        )}

        {/* MIND-READ PHASE */}
        {phase === "mind-read" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Hands */}
            <GlassCard>
              <GlassCardContent className="p-6 space-y-6">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Dealer's Hand</p>
                  <div className="flex gap-3">
                    {dealerHand.map((c, i) => <CardView key={i} card={c} delay={i * 0.15} />)}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Your Hand — {handLabel(playerHand)}</p>
                  <div className="flex gap-3">
                    {playerHand.map((c, i) => <CardView key={i} card={c} delay={i * 0.15} />)}
                  </div>
                </div>
              </GlassCardContent>
            </GlassCard>

            {/* Mind Read choice */}
            <GlassCard glow>
              <GlassCardContent className="p-6 text-center space-y-5">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold mb-1">Mind Read</p>
                  <h3 className="font-serif text-xl font-bold">What's the dealer's hidden card?</h3>
                  <p className="text-xs text-muted-foreground mt-1">High card = 8, 9, 10, J, Q, K, A · Low card = 2–7</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { choice: "high" as MindReadChoice, label: "High Card", emoji: "🎯", desc: "8 or above" },
                    { choice: "low" as MindReadChoice, label: "Low Card", emoji: "🌿", desc: "2 through 7" },
                  ].map(({ choice, label, emoji, desc }) => (
                    <button
                      key={choice}
                      onClick={() => handleMindRead(choice)}
                      className="py-6 rounded-2xl border bg-white/4 border-white/15 hover:bg-cyan-400/10 hover:border-cyan-400/40 transition-all duration-200 text-center"
                    >
                      <div className="text-4xl mb-2">{emoji}</div>
                      <p className="font-bold text-sm">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </button>
                  ))}
                </div>
              </GlassCardContent>
            </GlassCard>
          </motion.div>
        )}

        {/* PLAYER TURN */}
        {phase === "player-turn" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {mindRead && (
              <div className="text-center">
                <span className={cn("text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border",
                  "bg-cyan-400/10 border-cyan-400/30 text-cyan-400")}>
                  Mind Read: {mindRead === "high" ? "High Card" : "Low Card"} — {Math.round(MIND_READ_BONUS * 100)}% bonus if correct
                </span>
              </div>
            )}
            <GlassCard>
              <GlassCardContent className="p-6 space-y-6">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Dealer</p>
                  <div className="flex gap-3">
                    {dealerHand.map((c, i) => <CardView key={i} card={c} delay={0} />)}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                    Your Hand — <span className={handTotal(playerHand) > 21 ? "text-rose-400" : "text-primary"}>{handLabel(playerHand)}</span>
                  </p>
                  <div className="flex gap-3 flex-wrap">
                    {playerHand.map((c, i) => <CardView key={i} card={c} delay={0} />)}
                  </div>
                </div>
              </GlassCardContent>
            </GlassCard>
            <div className="grid grid-cols-2 gap-4">
              <LuxuryButton size="lg" variant="outline" className="gap-2" onClick={hit}>
                Hit
              </LuxuryButton>
              <LuxuryButton size="lg" className="gap-2" onClick={stand}>
                Stand
              </LuxuryButton>
            </div>
          </motion.div>
        )}

        {/* DEALER TURN (transitioning) */}
        {phase === "dealer-turn" && (
          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1 }}
            className="text-center py-20 text-muted-foreground font-serif text-lg italic">
            Dealer is playing…
          </motion.div>
        )}

        {/* RESULT */}
        {phase === "result" && result && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <GlassCard>
              <GlassCardContent className="p-6 space-y-6">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Dealer — {handLabel(dealerHand.map(c => ({ ...c, faceDown: false })))}</p>
                  <div className="flex gap-3 flex-wrap">
                    {dealerHand.map((c, i) => <CardView key={i} card={{ ...c, faceDown: false }} delay={i === 1 ? 0.2 : 0} />)}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">You — {handLabel(playerHand)}</p>
                  <div className="flex gap-3 flex-wrap">
                    {playerHand.map((c, i) => <CardView key={i} card={c} delay={0} />)}
                  </div>
                </div>
              </GlassCardContent>
            </GlassCard>

            {/* Result banner */}
            <GlassCard glow={result === "win" || result === "blackjack"}>
              <GlassCardContent className="p-6 text-center space-y-3">
                <h2 className={cn("text-3xl font-serif font-bold", resultColor[result])}>{resultLabel[result]}</h2>

                {mindReadCorrect !== null && (
                  <div className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold",
                    mindReadCorrect ? "bg-emerald-400/15 border border-emerald-400/35 text-emerald-300" : "bg-rose-400/10 border border-rose-400/25 text-rose-400/70")}>
                    <Eye className="w-4 h-4" />
                    Mind Read: {mindReadCorrect ? "Correct!" : "Wrong"} — the card was {dealerHand[1] && isHighCard(dealerHand[1]) ? "High" : "Low"}
                  </div>
                )}

                <p className={cn("text-2xl font-bold tabular-nums", netChange >= 0 ? "text-primary" : "text-rose-400")}>
                  {netChange >= 0 ? "+" : ""}{netChange} Neural Energy
                </p>
                {result === "win" && mindReadCorrect && (
                  <p className="text-xs text-emerald-400">Includes {Math.round(MIND_READ_BONUS * 100)}% Mind Read bonus ✓</p>
                )}

                <div className="flex gap-3 pt-2">
                  <LuxuryButton variant="outline" className="flex-1 gap-2" onClick={resetBet}>
                    <RefreshCw className="w-4 h-4" /> Play Again
                  </LuxuryButton>
                  <LuxuryButton className="flex-1 gap-2" onClick={() => navigate("/wellness")}>
                    Compassion Wheel
                  </LuxuryButton>
                </div>
              </GlassCardContent>
            </GlassCard>
          </motion.div>
        )}
      </div>
    </div>
  )
}
