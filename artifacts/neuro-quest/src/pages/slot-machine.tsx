import React, { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useLocation } from "wouter"
import { useQueryClient } from "@tanstack/react-query"
import {
  Brain, Flame, Leaf, Moon, Sun, Star, Eye, Wind, Heart,
  ArrowLeft, Zap, Sparkles, Crown, X, Gift, Megaphone,
  Share2, Users, Globe, TrendingUp, ChevronRight,
  CreditCard, Loader2
} from "lucide-react"
import { playReelStop, playWinChime, playJackpotFanfare } from "@/hooks/use-sound"
import { CelebrationOverlay } from "@/components/celebration-overlay"
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

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

async function buyExtraSpins(): Promise<string | null> {
  try {
    const r = await fetch(`${BASE}/api/stripe/extra-spins-checkout`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spins: 10 }),
    })
    const d = await r.json()
    return d.url ?? null
  } catch {
    return null
  }
}

/* ── Sponsor ─────────────────────────────────────────────────────────────── */
const CURRENT_SPONSOR = {
  brand: "World Hunger Relief Fund",
  prize: "10 Meals Donated",
  tagline: "Every play feeds a mind. Every milestone feeds the world.",
  donationBlurb: "Your compassion just funded 10 real meals for families in need — powered by NeuroQuest's Global Abundance Mission.",
}

/* ── Impact Stories (shown on Compassion Jackpot) ────────────────────────── */
const IMPACT_STORIES = [
  {
    emoji: "🧒🏿", name: "Ibrahim", age: 7, country: "Niger", region: "West Africa",
    story: "Ibrahim walks 4 miles to school each day on an empty stomach. Your compassion pays for his lunch — and the energy to dream.",
    stat: "1 in 3 children in Niger are chronically hungry",
    color: "from-amber-500/25 to-orange-600/10", accent: "#F59E0B",
  },
  {
    emoji: "👩🏾", name: "Amara", age: 34, country: "Kenya", region: "East Africa",
    story: "Amara feeds her three children once a day. Tonight, because of you, there's a second meal on the table.",
    stat: "8.3 million Kenyans face food insecurity",
    color: "from-emerald-500/25 to-teal-600/10", accent: "#10B981",
  },
  {
    emoji: "👦🏽", name: "Diego", age: 9, country: "Honduras", region: "Central America",
    story: "Diego's school has no cafeteria. He learns better when he eats. Your compassion fueled his curiosity today.",
    stat: "30% of Honduran children under 5 are stunted from malnutrition",
    color: "from-sky-500/25 to-blue-600/10", accent: "#0EA5E9",
  },
  {
    emoji: "👵🏾", name: "Fatou", age: 68, country: "Senegal", region: "West Africa",
    story: "Fatou raised 6 children and 12 grandchildren. This week's floods took her food supply. You gave it back.",
    stat: "Climate shocks push 30M more people into hunger annually",
    color: "from-rose-500/25 to-pink-600/10", accent: "#F43F5E",
  },
  {
    emoji: "🧒🏻", name: "Mia", age: 6, country: "Philippines", region: "Southeast Asia",
    story: "Mia's family survives on rice and salt. The donation you triggered adds protein to her plate for a week.",
    stat: "13.2% of Filipinos are food insecure",
    color: "from-violet-500/25 to-purple-600/10", accent: "#8B5CF6",
  },
  {
    emoji: "👨🏿", name: "Kwame", age: 22, country: "Ghana", region: "West Africa",
    story: "Kwame studies at night after farming all day. He can't afford dinner. Your compassion changes that tonight.",
    stat: "Youth hunger in Ghana rises during drought seasons",
    color: "from-yellow-500/25 to-amber-600/10", accent: "#EAB308",
  },
  {
    emoji: "👧🏽", name: "Priya", age: 11, country: "India", region: "South Asia",
    story: "Priya skips class on hungry days. Your generosity funds a school meal that keeps her in her seat — and in school.",
    stat: "190 million Indians are undernourished",
    color: "from-orange-500/25 to-red-600/10", accent: "#F97316",
  },
  {
    emoji: "🧑🏾", name: "Yusuf", age: 16, country: "Somalia", region: "East Africa",
    story: "Yusuf's village was hit by drought. He dreams of becoming a doctor. Today, he ate enough to dream clearly.",
    stat: "7.8M Somalis need emergency food assistance",
    color: "from-teal-500/25 to-cyan-600/10", accent: "#14B8A6",
  },
]

/* ── Pre-Spin Affirmations ───────────────────────────────────────────────── */
const AFFIRMATIONS = [
  "Your next play could change a life.",
  "The universe rewards a generous heart.",
  "Three hearts = a meal on someone's table.",
  "Play with purpose. Grow with compassion.",
  "Every turn is a ripple in the world.",
  "You are one play away from becoming someone's miracle.",
  "Generosity is the highest form of wellness.",
  "The wheel remembers kind hearts.",
]

/* ── Social Proof Winners ────────────────────────────────────────────────── */
const SOCIAL_PROOF = [
  { name: "Layla", city: "Atlanta", time: "2m ago" },
  { name: "Marcus", city: "Chicago", time: "5m ago" },
  { name: "Soo-Yeon", city: "Seoul", time: "8m ago" },
  { name: "Destiny", city: "Houston", time: "11m ago" },
  { name: "Andres", city: "Miami", time: "14m ago" },
  { name: "Imani", city: "Brooklyn", time: "17m ago" },
  { name: "Takoda", city: "Phoenix", time: "21m ago" },
  { name: "Zara", city: "London", time: "24m ago" },
  { name: "Elijah", city: "Detroit", time: "28m ago" },
  { name: "Nadia", city: "Toronto", time: "31m ago" },
]

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

/* ── Confetti ────────────────────────────────────────────────────────────── */
function fireCompassionConfetti() {
  const colors = ["#FF6B9D", "#FFB3CC", "#FF3D7F", "#FF85A8", "#D4AF37", "#FFE066", "#fff"]
  const burst = (origin: { x: number; y: number }) =>
    confetti({ particleCount: 120, spread: 120, startVelocity: 55, origin, colors, shapes: ["circle", "square"], gravity: 0.9, scalar: 1.2, ticks: 300 })
  burst({ x: 0.2, y: 0.4 })
  setTimeout(() => burst({ x: 0.8, y: 0.4 }), 150)
  setTimeout(() => burst({ x: 0.5, y: 0.2 }), 300)
  setTimeout(() => burst({ x: 0.15, y: 0.6 }), 500)
  setTimeout(() => burst({ x: 0.85, y: 0.6 }), 650)
  const end = Date.now() + 3000
  const shower = () => {
    if (Date.now() > end) return
    confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 }, colors, ticks: 200, gravity: 1 })
    confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors, ticks: 200, gravity: 1 })
    requestAnimationFrame(shower)
  }
  setTimeout(shower, 800)
}

function fireNearMissConfetti() {
  confetti({ particleCount: 40, spread: 80, startVelocity: 30, origin: { x: 0.5, y: 0.5 }, colors: ["#FF6B9D", "#FFB3CC", "#fff"], ticks: 120, gravity: 1.2 })
}

/* ── Impact Badge Canvas ─────────────────────────────────────────────────── */
function generateImpactBadge(storyName: string, country: string, levelTitle: string, compassionPoints: number): string {
  const canvas = document.createElement("canvas")
  canvas.width = 800; canvas.height = 800
  const ctx = canvas.getContext("2d")!
  const bg = ctx.createLinearGradient(0, 0, 800, 800)
  bg.addColorStop(0, "#0D1A10"); bg.addColorStop(1, "#050A05")
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 800, 800)
  const glow = ctx.createRadialGradient(400, 330, 20, 400, 330, 260)
  glow.addColorStop(0, "rgba(212,175,55,0.1)"); glow.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 800, 800)
  ctx.beginPath(); ctx.arc(400, 310, 155, 0, Math.PI * 2)
  ctx.strokeStyle = "#D4AF37"; ctx.lineWidth = 5; ctx.shadowColor = "#D4AF37"; ctx.shadowBlur = 28; ctx.stroke()
  ctx.beginPath(); ctx.arc(400, 310, 145, 0, Math.PI * 2)
  ctx.strokeStyle = "rgba(212,175,55,0.25)"; ctx.lineWidth = 1.5; ctx.shadowBlur = 0; ctx.stroke()
  ctx.shadowBlur = 24; ctx.shadowColor = "rgba(251,113,133,0.7)"
  ctx.font = "bold 130px serif"; ctx.textAlign = "center"; ctx.fillStyle = "#fb7185"; ctx.fillText("♥", 400, 365)
  ctx.shadowColor = "rgba(212,175,55,0.5)"; ctx.shadowBlur = 18
  ctx.font = "bold 54px Georgia, serif"; ctx.fillStyle = "#D4AF37"; ctx.fillText("COMPASSION IMPACT", 400, 530)
  ctx.shadowBlur = 0; ctx.font = "22px Georgia, serif"; ctx.fillStyle = "rgba(255,255,255,0.5)"
  ctx.fillText(`A meal was funded for ${storyName} in ${country}`, 400, 578)
  ctx.font = "bold 32px Georgia, serif"; ctx.fillStyle = "#fb7185"; ctx.fillText(`+${compassionPoints} Compassion Points`, 400, 630)
  ctx.font = "italic 22px Georgia, serif"; ctx.fillStyle = "rgba(212,175,55,0.7)"; ctx.fillText(levelTitle, 400, 672)
  ctx.beginPath(); ctx.moveTo(240, 700); ctx.lineTo(560, 700); ctx.strokeStyle = "rgba(212,175,55,0.2)"; ctx.lineWidth = 1; ctx.stroke()
  ctx.font = "bold 18px Arial, sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.fillText("NeuroQuest  ·  #NeuroQuestImpact", 400, 735)
  return canvas.toDataURL("image/png")
}

async function shareImpactBadge(dataUrl: string, levelTitle: string, name: string) {
  try {
    const blob = await (await fetch(dataUrl)).blob()
    const file = new File([blob], "neuroquest-impact.png", { type: "image/png" })
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: "I made an impact on NeuroQuest!", text: `As a ${levelTitle}, I just funded a meal for ${name}. 💚 #NeuroQuestImpact`, files: [file] })
      return
    }
  } catch {}
  const a = document.createElement("a"); a.href = dataUrl; a.download = "neuroquest-impact-badge.png"; a.click()
}

/* ── Types ───────────────────────────────────────────────────────────────── */
type SpinPhase = "idle" | "spinning" | "result"
type WinTier   = "compassion_jackpot" | "jackpot" | "three" | "two" | "none"

interface SpinResult {
  reels:    number[]
  tier:     WinTier
  symbolId: string | null
  payout:   number
  heartCount: number
}

function evalResult(reels: number[]): SpinResult {
  const [a, b, c] = reels
  const heartCount = reels.filter(r => r === HEART_IDX).length
  if (a === HEART_IDX && b === HEART_IDX && c === HEART_IDX) {
    return { reels, tier: "compassion_jackpot", symbolId: "heart", payout: -SPIN_COST, heartCount: 3 }
  }
  if (a === b && b === c) {
    const tier: WinTier = a === 1 ? "jackpot" : "three"
    return { reels, tier, symbolId: SYMBOLS[a].id, payout: SYMBOLS[a].prize3 - SPIN_COST, heartCount }
  }
  if (a === b || b === c || a === c) {
    const matchIdx = a === b ? a : a === c ? a : b
    return { reels, tier: "two", symbolId: SYMBOLS[matchIdx].id, payout: SYMBOLS[matchIdx].prize2 - SPIN_COST, heartCount }
  }
  return { reels, tier: "none", symbolId: null, payout: -SPIN_COST, heartCount }
}

function randomReels(isElectricBlue = false): number[] {
  const base = [0, 1, 2].map(() => Math.floor(Math.random() * SYMBOLS.length))
  if (!isElectricBlue) return base
  if (Math.random() < 0.10) {
    const matchSymbol = Math.floor(Math.random() * SYMBOLS.length)
    const pairSlots = Math.random() < 0.33 ? [0, 1] : Math.random() < 0.5 ? [1, 2] : [0, 2]
    return base.map((v, i) => pairSlots.includes(i) ? matchSymbol : v)
  }
  return base
}

/* ── Community Pool Counter ──────────────────────────────────────────────── */
function useCommunityPool(base = 12847) {
  const [pool, setPool] = useState(base)
  useEffect(() => {
    const tick = () => {
      setPool(p => p + Math.floor(Math.random() * 3 + 1))
      setTimeout(tick, Math.random() * 8000 + 4000)
    }
    const t = setTimeout(tick, 3000)
    return () => clearTimeout(t)
  }, [])
  return pool
}

/* ── Social Proof Ticker ─────────────────────────────────────────────────── */
function SocialProofTicker() {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % SOCIAL_PROOF.length), 4500)
    return () => clearInterval(t)
  }, [])
  const winner = SOCIAL_PROOF[idx]
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={idx}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-2 text-xs text-rose-300/70"
      >
        <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse shrink-0" />
        <span>
          <span className="font-bold text-rose-300">{winner.name}</span> in {winner.city} reached a Compassion Milestone
          <span className="text-white/30 ml-1.5">{winner.time}</span>
        </span>
      </motion.div>
    </AnimatePresence>
  )
}

/* ── Pre-Spin Affirmation ────────────────────────────────────────────────── */
function PreSpinAffirmation({ visible }: { visible: boolean }) {
  const [idx, setIdx] = useState(Math.floor(Math.random() * AFFIRMATIONS.length))
  useEffect(() => {
    if (!visible) return
    const t = setInterval(() => setIdx(i => (i + 1) % AFFIRMATIONS.length), 3200)
    return () => clearInterval(t)
  }, [visible])
  if (!visible) return null
  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={idx}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.5 }}
        className="text-center text-sm italic text-rose-200/50 mb-6 px-4"
      >
        "{AFFIRMATIONS[idx]}"
      </motion.p>
    </AnimatePresence>
  )
}

/* ── Compassion Charge Meter ─────────────────────────────────────────────── */
function CompassionChargeMeter({ heartCount, visible }: { heartCount: number; visible: boolean }) {
  if (!visible) return null
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="flex items-center justify-center gap-3 mb-4"
    >
      <span className="text-xs text-muted-foreground uppercase tracking-widest">Compassion Charge</span>
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            initial={{ scale: 0.5 }}
            animate={{ scale: i < heartCount ? [1, 1.3, 1] : 1 }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
          >
            <Heart
              className={cn("w-5 h-5 transition-all duration-300", i < heartCount ? "text-rose-400 fill-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.9)]" : "text-white/15")}
            />
          </motion.div>
        ))}
      </div>
      {heartCount === 2 && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="text-xs font-bold text-rose-300 tracking-wide"
        >
          ONE AWAY
        </motion.span>
      )}
    </motion.div>
  )
}

/* ── Near-Miss Overlay ───────────────────────────────────────────────────── */
function NearMissOverlay({ onDismiss, onSpin, canSpin }: { onDismiss: () => void; onSpin: () => void; canSpin: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-end justify-center pb-16 pointer-events-none"
    >
      <motion.div
        initial={{ y: 60, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 340, damping: 24 }}
        className="pointer-events-auto mx-4 max-w-sm w-full"
      >
        <div className="relative rounded-3xl border border-rose-400/60 bg-black/80 backdrop-blur-xl px-6 py-5 shadow-[0_0_60px_rgba(251,113,133,0.35)]">
          <button onClick={onDismiss} className="absolute top-3 right-3 text-white/30 hover:text-white/60 transition-colors">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex gap-0.5">
              {[0, 1].map(i => (
                <motion.div key={i} animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.15 }}>
                  <Heart className="w-7 h-7 text-rose-400 fill-rose-400 drop-shadow-[0_0_12px_rgba(251,113,133,0.9)]" />
                </motion.div>
              ))}
              <div className="w-7 h-7 rounded-full border-2 border-dashed border-rose-400/40 flex items-center justify-center">
                <span className="text-rose-400/60 text-xs font-bold">?</span>
              </div>
            </div>
            <div>
              <p className="font-serif font-bold text-rose-300 text-base leading-tight">So close!</p>
              <p className="text-xs text-rose-300/60">2 hearts. The world was almost changed.</p>
            </div>
          </div>
          <p className="text-xs text-white/50 leading-relaxed mb-4">
            The third heart is listening. One more play and a family somewhere eats tonight.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { onDismiss(); onSpin() }}
              disabled={!canSpin}
              className="flex-1 rounded-xl bg-rose-500/80 hover:bg-rose-500 border border-rose-400/50 text-white text-sm font-bold py-2.5 transition-all disabled:opacity-40"
            >
              Play Again ♡
            </button>
            <button onClick={onDismiss} className="px-4 rounded-xl border border-white/15 text-white/40 hover:text-white/60 text-sm transition-colors">
              Wait
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ── Compassion Jackpot Overlay (with Impact Story) ─────────────────────── */
interface CompassionJackpotOverlayProps {
  onClose: () => void
  sponsor: { brand: string; donationBlurb: string }
  profile: { title?: string; compassion_points?: number } | null
  spinCount: number
}

function CompassionJackpotOverlay({ onClose, sponsor, profile, spinCount }: CompassionJackpotOverlayProps) {
  const [sharing, setSharing] = React.useState(false)
  const [badgeUrl, setBadgeUrl] = React.useState<string | null>(null)
  const [storyExpanded, setStoryExpanded] = React.useState(false)
  const story = IMPACT_STORIES[spinCount % IMPACT_STORIES.length]

  React.useEffect(() => {
    const url = generateImpactBadge(story.name, story.country, profile?.title ?? "Seeker", profile?.compassion_points ?? COMPASSION_JACKPOT)
    setBadgeUrl(url)
  }, [])

  const handleShare = async () => {
    if (!badgeUrl) return
    setSharing(true)
    await shareImpactBadge(badgeUrl, profile?.title ?? "Seeker", story.name)
    setSharing(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.6, opacity: 0, y: 60 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: -30 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        onClick={e => e.stopPropagation()}
        className="relative max-w-sm w-full mx-4 max-h-[92vh] overflow-y-auto"
      >
        <button onClick={onClose} className="absolute -top-3 -right-3 z-10 bg-white/10 hover:bg-white/20 rounded-full p-1.5 transition-colors">
          <X className="w-4 h-4 text-white" />
        </button>

        <GlassCard glow className="overflow-visible">
          <GlassCardContent className="p-8 text-center space-y-5">
            {/* Pulsing hearts */}
            <div className="flex justify-center gap-3">
              {[0, 1, 2].map(i => (
                <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} transition={{ delay: i * 0.12, type: "spring", stiffness: 280, damping: 14 }}>
                  <Heart className="w-12 h-12 text-rose-400 fill-rose-400 drop-shadow-[0_0_18px_rgba(251,113,133,0.9)]" />
                </motion.div>
              ))}
            </div>

            <div className="space-y-1.5">
              <motion.h2
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                className="text-3xl font-serif font-bold leading-tight"
                style={{ background: "linear-gradient(135deg, #FF6B9D, #FFE066, #FF3D7F)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
              >
                Compassion Impact
              </motion.h2>
              <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="text-sm font-medium text-rose-200/80">
                A micro-donation was made in your name.
              </motion.p>
            </div>

            {/* Points badge */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.6, type: "spring" }}
              className="inline-flex items-center gap-2 bg-rose-400/20 border border-rose-400/50 rounded-full px-6 py-2.5 mx-auto"
            >
              <Heart className="w-4 h-4 text-rose-400 fill-rose-400" />
              <span className="font-bold text-rose-300 text-base">+{COMPASSION_JACKPOT} Compassion Points</span>
            </motion.div>

            {/* ── Impact Story ── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }}
              className={cn("rounded-2xl border overflow-hidden", `bg-gradient-to-br ${story.color}`, "border-white/15")}
            >
              <div className="px-5 py-4">
                <div className="flex items-start gap-3 text-left">
                  <div className="text-4xl mt-0.5 shrink-0">{story.emoji}</div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-serif font-bold text-white text-base">{story.name}, {story.age}</span>
                      <span className="text-xs text-white/50">{story.country}</span>
                    </div>
                    <p className="text-sm text-white/80 leading-relaxed">{story.story}</p>
                    <button
                      onClick={() => setStoryExpanded(e => !e)}
                      className="flex items-center gap-1 mt-2 text-[11px] font-bold uppercase tracking-wider transition-colors"
                      style={{ color: story.accent }}
                    >
                      {storyExpanded ? "Less" : "Why this matters"}
                      <ChevronRight className={cn("w-3 h-3 transition-transform", storyExpanded && "rotate-90")} />
                    </button>
                    <AnimatePresence>
                      {storyExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="flex items-start gap-2 mt-2 pt-2 border-t border-white/10">
                            <TrendingUp className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: story.accent }} />
                            <p className="text-xs text-white/55 leading-relaxed">{story.stat}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Sponsor */}
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
              className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 space-y-1 text-left"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-rose-300/60 flex items-center gap-1.5">
                <Megaphone className="w-3 h-3" /> Powered by
              </p>
              <p className="text-sm font-bold text-white">{sponsor.brand}</p>
              <p className="text-xs text-white/45 leading-relaxed">{sponsor.donationBlurb}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.05 }}
              className="flex flex-col items-center gap-3 w-full"
            >
              <LuxuryButton
                size="sm"
                onClick={onClose}
                className="gap-2 bg-rose-500/80 hover:bg-rose-500 border-rose-400/50 text-white shadow-[0_0_20px_rgba(251,113,133,0.4)] w-full"
              >
                Carry the Love Forward
              </LuxuryButton>
              <button
                onClick={handleShare}
                disabled={sharing || !badgeUrl}
                className="flex items-center gap-2 text-xs font-semibold text-rose-300/60 hover:text-rose-200 transition-colors disabled:opacity-40"
              >
                <Share2 className="w-3.5 h-3.5" />
                {sharing ? "Generating…" : "Share Your Impact Badge"}
              </button>
            </motion.div>
          </GlassCardContent>
        </GlassCard>
      </motion.div>
    </motion.div>
  )
}

/* ── Reel ────────────────────────────────────────────────────────────────── */
interface ReelProps {
  spinning:   boolean
  finalIdx:   number | null
  stopDelay?: number
  onStopped?: () => void
  glowHeart?: boolean
  isNearMiss?: boolean
}

function Reel({ spinning, finalIdx, stopDelay = 0, onStopped, glowHeart, isNearMiss }: ReelProps) {
  const [display, setDisplay] = useState(1)
  const [stopped, setStopped] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef  = useRef<ReturnType<typeof setTimeout>  | null>(null)

  useEffect(() => {
    if (spinning) {
      setStopped(false)
      intervalRef.current = setInterval(() => setDisplay(d => (d + 1) % SYMBOLS.length), 60)
      return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
    }
    return undefined
  }, [spinning])

  useEffect(() => {
    if (!spinning && finalIdx !== null && !stopped) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      const slowSteps = [120, 180, 250, 320]
      let step = 0
      const tick = () => {
        setDisplay(d => (d + 1) % SYMBOLS.length)
        step++
        if (step < slowSteps.length) { timeoutRef.current = setTimeout(tick, slowSteps[step]) }
        else { setDisplay(finalIdx); setStopped(true); onStopped?.() }
      }
      timeoutRef.current = setTimeout(tick, stopDelay + slowSteps[0])
    }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [spinning, finalIdx, stopDelay, stopped, onStopped])

  const sym   = SYMBOLS[display]
  const above = SYMBOLS[(display - 1 + SYMBOLS.length) % SYMBOLS.length]
  const below = SYMBOLS[(display + 1) % SYMBOLS.length]
  const isHeartGlow = glowHeart && sym.id === "heart" && stopped
  const isNearMissHeart = isNearMiss && sym.id === "heart" && stopped

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
          : isNearMissHeart
            ? { scale: [1, 1.08, 1], transition: { repeat: Infinity, duration: 0.7 } }
            : { scale: 1 }
        }
        className={cn(
          "flex items-center justify-center h-20 w-20 rounded-2xl z-20 transition-colors duration-150",
          sym.bg,
          stopped && !isHeartGlow && !isNearMissHeart && "shadow-[0_0_20px_currentColor]",
          isHeartGlow && "shadow-[0_0_35px_rgba(251,113,133,0.9)] ring-2 ring-rose-400/60",
          isNearMissHeart && "shadow-[0_0_25px_rgba(251,113,133,0.6)] ring-2 ring-rose-400/40"
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
        <div className="flex items-center justify-between gap-3 p-2 rounded-xl bg-rose-400/10 border border-rose-400/30">
          <div className="flex items-center gap-1.5">
            {[0,1,2].map(i => <Heart key={i} className="w-4 h-4 text-rose-400 fill-rose-400" />)}
          </div>
          <span className="text-rose-300 font-bold text-xs tracking-wide">COMPASSION IMPACT</span>
          <span className="text-rose-400 font-bold text-xs">+{COMPASSION_JACKPOT} ♡</span>
        </div>
        <div className="space-y-1.5 text-sm pt-1">
          {SYMBOLS.filter(s => !s.special).map(sym => (
            <div key={sym.id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                {[0,1,2].map(i => <sym.Icon key={i} className={cn("w-4 h-4", sym.color)} />)}
              </div>
              <span className="text-primary font-bold text-xs">+{sym.prize3} ⚡</span>
              <div className="flex items-center gap-1.5 ml-2">
                {[0,1].map(i => <sym.Icon key={i} className={cn("w-4 h-4", sym.color)} />)}
                <span className="text-muted-foreground">—</span>
              </div>
              <span className={cn("font-bold text-xs", sym.prize2 > 0 ? "text-emerald-400" : "text-muted-foreground")}>
                {sym.prize2 > 0 ? `+${sym.prize2} ⚡` : "—"}
              </span>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground text-xs pt-2 border-t border-white/10">
          Play costs <span className="text-primary font-bold">−{SPIN_COST}</span> Neural Energy. ⚡ = Energy · ♡ = Compassion
        </p>
      </GlassCardContent>
    </GlassCard>
  )
}

/* ── Main Page ───────────────────────────────────────────────────────────── */
export default function SlotMachine() {
  const [, navigate]  = useLocation()
  const { toast }     = useToast()
  const queryClient   = useQueryClient()

  const { data: profile } = useGetProfile()
  const communityPool = useCommunityPool()

  const [phase, setPhase]           = useState<SpinPhase>("idle")
  const [finalReels, setFinalReels] = useState<number[] | null>(null)
  const [result, setResult]         = useState<SpinResult | null>(null)
  const [totalWon, setTotalWon]     = useState(0)
  const [showPay, setShowPay]       = useState(false)
  const [showJackpot, setShowJackpot] = useState(false)
  const [celebration, setCelebration] = useState<{
    type: "compassion" | "compassion-milestone" | "energy"; amount?: number; title: string; subtitle: string; impactLine?: string
  } | null>(null)
  const [showNearMiss, setShowNearMiss] = useState(false)
  const [showBreathing, setShowBreathing] = useState(false)
  const [breathingPhase, setBreathingPhase] = useState<"inhale" | "hold" | "exhale">("inhale")
  const [spinCount, setSpinCount] = useState(0)
  const [buyingSpins, setBuyingSpins] = useState(false)

  const isSleepMode = new Date().getHours() >= 22 || new Date().getHours() < 6
  const [streak, setStreak] = useState<{
    streak_count: number; multiplier: number; is_lucky_gold: boolean; is_electric_blue: boolean
  }>({ streak_count: 0, multiplier: 1, is_lucky_gold: false, is_electric_blue: false })

  useEffect(() => {
    fetch(`${BASE}/api/quest/streak`, { credentials: "include" })
      .then(r => r.json()).then(setStreak).catch(() => {})
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("spins_success") === "1") {
      toast({ title: "10 Plays Added!", description: "+100 Neural Energy has been loaded to your account. Let's go!", duration: 6000 })
      queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() })
      window.history.replaceState({}, "", window.location.pathname)
    }
  }, [])

  const handleBuySpins = async () => {
    setBuyingSpins(true)
    const url = await buyExtraSpins()
    if (url) window.location.href = url
    else {
      toast({ title: "Error", description: "Could not start checkout. Please try again.", variant: "destructive" })
      setBuyingSpins(false)
    }
  }

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() })
    queryClient.invalidateQueries({ queryKey: getGetActivitiesQueryKey() })
  }, [queryClient])

  const { mutate: earnEnergy,     isPending: isEnergyPending    } = useEarnEnergy({    mutation: { onSuccess: invalidate } })
  const { mutate: earnCompassion, isPending: isCompassionPending } = useEarnCompassion({ mutation: { onSuccess: invalidate } })

  const isPending = isEnergyPending || isCompassionPending
  const canSpin   = !!(profile && profile.neural_energy >= SPIN_COST && phase === "idle" && !isPending)

  const startBreathing = () => {
    setBreathingPhase("inhale")
    setShowBreathing(true)
    setTimeout(() => setBreathingPhase("hold"), 4000)
    setTimeout(() => setBreathingPhase("exhale"), 8000)
    setTimeout(async () => {
      await fetch(`${BASE}/api/quest/earn-energy`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activity: "Sleep Mode Meditation", amount: 10 }),
      }).catch(() => {})
      queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() })
      queryClient.invalidateQueries({ queryKey: getGetActivitiesQueryKey() })
      setShowBreathing(false)
      toast({ title: "+10 Neural Energy", description: "Your mind is centered. Rest well." })
    }, 14200)
  }

  const handleSpin = useCallback(() => {
    if (!canSpin) return
    const reels = randomReels(streak.is_electric_blue)
    const res   = evalResult(reels)
    setFinalReels(reels)
    setResult(res)
    setPhase("spinning")
    setShowNearMiss(false)
    earnEnergy({ data: { activity: "Compassion Wheel Play", amount: -SPIN_COST } })

    setTimeout(() => {
      setPhase("result")
      setSpinCount(n => n + 1)

      if (res.tier === "compassion_jackpot") {
        fireCompassionConfetti()
        playJackpotFanfare()
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400])
        setTimeout(() => setShowJackpot(true), 500)
        earnCompassion({ data: { activity: "Compassion Impact – 3× Heart", amount: COMPASSION_JACKPOT } })
        const mealsFromImpact = Math.round(COMPASSION_JACKPOT * 0.01 * 100) / 100
        setCelebration({
          type: "compassion",
          amount: COMPASSION_JACKPOT,
          title: "Compassion Impact!",
          subtitle: "Three hearts aligned. Your compassion creates real-world change.",
          impactLine: `+${mealsFromImpact} meals contributed to hunger relief`,
        })

      } else if (res.heartCount === 2) {
        // Near-miss with 2 hearts
        playWinChime()
        fireNearMissConfetti()
        if (navigator.vibrate) navigator.vibrate([80, 60, 80])
        setTimeout(() => setShowNearMiss(true), 600)

      } else if (res.tier === "jackpot" || res.tier === "three" || res.tier === "two") {
        if (res.payout > 0) {
          playWinChime()
          const boosted = streak.is_electric_blue ? Math.floor(res.payout * streak.multiplier) : res.payout
          const label = res.tier === "jackpot" ? "GRAND MATCH" : res.tier === "three" ? `3× ${res.symbolId}` : `2× ${res.symbolId}`
          earnEnergy({ data: { activity: `Compassion Wheel – ${label}`, amount: boosted + SPIN_COST } })
          setTotalWon(w => w + boosted)
          setCelebration({
            type: "energy",
            amount: boosted,
            title: res.tier === "jackpot" ? "Grand Match!" : res.tier === "three" ? "Triple Match!" : "Double Match!",
            subtitle: streak.is_electric_blue && boosted !== res.payout
              ? `${streak.multiplier.toFixed(2)}× streak boost applied. Your consistency pays off.`
              : "Pattern matched. Your focus is sharpening.",
          })
        } else {
          toast({ title: "No match", description: `–${SPIN_COST} Neural Energy` })
        }
      } else {
        toast({ title: "No match", description: `–${SPIN_COST} Neural Energy` })
      }
    }, 1800)
  }, [canSpin, streak, earnEnergy, earnCompassion, toast])

  const tierLabel: Record<WinTier, string> = {
    compassion_jackpot: "♡ Compassion Impact!",
    jackpot:            "⚡ GRAND MATCH",
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
  const isNearMissResult = result?.heartCount === 2 && result?.tier !== "compassion_jackpot"

  const resetSpin = () => {
    setPhase("idle")
    setResult(null)
    setFinalReels(null)
    setShowNearMiss(false)
  }

  return (
    <div className="min-h-screen relative overflow-hidden pb-20">
      <CelebrationOverlay celebration={celebration} onDone={() => setCelebration(null)} />

      <div
        className="absolute inset-0 z-0 opacity-40 mix-blend-overlay pointer-events-none bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/zen-bg.png)` }}
      />

      {/* Near-miss overlay */}
      <AnimatePresence>
        {showNearMiss && (
          <NearMissOverlay
            onDismiss={() => setShowNearMiss(false)}
            onSpin={() => { resetSpin(); setTimeout(handleSpin, 100) }}
            canSpin={canSpin}
          />
        )}
      </AnimatePresence>

      {/* Breathing overlay */}
      <AnimatePresence>
        {showBreathing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
          >
            <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }}
              className="glass-panel rounded-3xl p-10 text-center max-w-xs mx-4 border border-indigo-400/25"
            >
              <motion.div
                className="w-32 h-32 rounded-full bg-indigo-400/15 border-2 border-indigo-400/35 mx-auto mb-6 flex items-center justify-center"
                animate={{ scale: breathingPhase === "inhale" ? 1.55 : breathingPhase === "hold" ? 1.55 : 1 }}
                transition={{ duration: breathingPhase === "inhale" ? 4 : breathingPhase === "hold" ? 0.1 : 6, ease: "easeInOut" }}
              >
                <Wind className="w-10 h-10 text-indigo-300" />
              </motion.div>
              <h2 className="font-serif text-2xl font-bold text-indigo-200 mb-1">
                {breathingPhase === "inhale" ? "Inhale…" : breathingPhase === "hold" ? "Hold…" : "Exhale…"}
              </h2>
              <p className="text-sm text-indigo-300/70 mb-4">
                {breathingPhase === "inhale" ? "4 seconds" : breathingPhase === "hold" ? "4 seconds" : "6 seconds"}
              </p>
              <p className="text-xs text-muted-foreground">One full cycle earns +10 Neural Energy</p>
              <button onClick={() => setShowBreathing(false)} className="mt-4 text-xs text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors">Skip</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compassion Jackpot overlay */}
      <AnimatePresence>
        {showJackpot && (
          <CompassionJackpotOverlay
            sponsor={CURRENT_SPONSOR}
            profile={profile ?? null}
            spinCount={spinCount}
            onClose={() => { setShowJackpot(false); resetSpin() }}
          />
        )}
      </AnimatePresence>

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 pt-10">
        {/* Back */}
        <motion.button initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to Dashboard</span>
        </motion.button>

        {/* Sleep mode banner */}
        {isSleepMode && (
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-2xl bg-indigo-950/50 border border-indigo-400/20 px-5 py-4 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <Moon className="w-5 h-5 text-indigo-300 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-indigo-200">Meditation Lounge is open</p>
                <p className="text-xs text-indigo-300/60">It's late. Center your mind before you play.</p>
              </div>
            </div>
            <button onClick={startBreathing} disabled={showBreathing}
              className="shrink-0 text-xs font-bold bg-indigo-400/15 border border-indigo-400/25 px-4 py-2 rounded-full text-indigo-300 hover:bg-indigo-400/25 transition-colors disabled:opacity-50"
            >
              Breathe +10
            </button>
          </motion.div>
        )}

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
          <div className="inline-flex items-center gap-3 mb-1.5">
            <Sparkles className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-serif font-bold text-gradient-gold">Compassion Wheel</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Each play costs <span className="text-primary font-bold">−10 Neural Energy</span>
            <span className="mx-2 text-white/20">·</span>
            <span className="text-rose-400 font-semibold">3× ♡ = Compassion Impact</span>
          </p>
        </motion.div>

        {/* ── Community Pool Counter ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="mb-5 rounded-2xl bg-gradient-to-r from-rose-500/10 via-rose-400/5 to-rose-500/10 border border-rose-400/30 px-5 py-3.5"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-400/20 rounded-xl shrink-0">
                <Globe className="w-4 h-4 text-rose-400" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400/70 mb-0.5">Community Heart Pool — Live</p>
                <SocialProofTicker />
              </div>
            </div>
            <div className="text-right shrink-0">
              <motion.p
                key={communityPool}
                initial={{ scale: 1.15, color: "#f87171" }}
                animate={{ scale: 1, color: "#fb7185" }}
                transition={{ duration: 0.3 }}
                className="font-serif font-bold text-2xl text-rose-400 tabular-nums drop-shadow-[0_0_10px_rgba(251,113,133,0.5)]"
              >
                {communityPool.toLocaleString()}
              </motion.p>
              <p className="text-[10px] text-rose-300/50 uppercase tracking-widest">lives touched</p>
            </div>
          </div>
        </motion.div>

        {/* Entertainment-only disclaimer */}
        <div className="flex items-center justify-center gap-2 mb-4 px-4 py-2 rounded-2xl bg-white/3 border border-white/8 mx-auto max-w-sm">
          <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">For Entertainment Only</span>
          <span className="text-white/15">·</span>
          <span className="text-[10px] text-white/25">For wellness purposes · Neural Energy has no cash value</span>
        </div>

        {/* Balances */}
        <div className="flex justify-center gap-4 mb-5 flex-wrap">
          <div className="glass-panel px-5 py-2 rounded-full flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium tabular-nums">{profile?.neural_energy ?? "—"} energy</span>
          </div>
          <div className="glass-panel px-5 py-2 rounded-full flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-400" />
            <span className="text-sm font-medium tabular-nums">{profile?.compassion_points ?? "—"} compassion</span>
          </div>
          {totalWon !== 0 && (
            <div className={cn("glass-panel px-5 py-2 rounded-full flex items-center gap-2 text-sm font-medium tabular-nums", totalWon > 0 ? "text-emerald-400" : "text-rose-400")}>
              <Zap className="w-4 h-4" />
              Session: {totalWon > 0 ? "+" : ""}{totalWon}
            </div>
          )}
        </div>

        {/* Sponsored jackpot banner */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mb-4">
          <a href={`${BASE}/sponsor`} onClick={e => { e.preventDefault(); navigate("/sponsor") }} className="block group">
            <div className="flex items-center justify-between gap-3 px-5 py-3 rounded-2xl bg-cyan-500/10 border border-cyan-400/30 hover:border-cyan-400/55 hover:bg-cyan-500/15 transition-all cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-cyan-400/20 rounded-lg shrink-0"><Gift className="w-4 h-4 text-cyan-400" /></div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-cyan-400">Compassion Impact — Sponsored</p>
                  <p className="text-sm font-semibold text-foreground">
                    <span className="text-rose-300">3× ♡</span> → micro-donation by <span className="text-cyan-300">{CURRENT_SPONSOR.brand}</span>
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right hidden sm:block">
                <p className="text-xs text-muted-foreground italic">{CURRENT_SPONSOR.tagline}</p>
                <p className="text-[10px] text-cyan-400/70 uppercase tracking-widest mt-0.5 group-hover:text-cyan-400 transition-colors">Your brand here →</p>
              </div>
            </div>
          </a>
        </motion.div>

        {/* Streak pill */}
        {streak.streak_count > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center mb-4">
            <div className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-bold uppercase tracking-widest",
              streak.is_electric_blue ? "bg-blue-500/15 border-blue-400/50 text-blue-300" : "bg-amber-400/15 border-amber-400/40 text-amber-300"
            )}>
              <Flame className={cn("w-3.5 h-3.5", streak.is_electric_blue ? "text-blue-400" : "text-amber-400")} />
              {streak.streak_count}-Day Streak · {streak.is_electric_blue ? "⚡ Electric Blue" : "✦ Lucky Gold"} · {streak.multiplier.toFixed(2)}× Boost
            </div>
          </motion.div>
        )}

        {/* Pre-spin affirmation */}
        <PreSpinAffirmation visible={phase === "idle" && !result} />

        {/* Compassion charge meter */}
        <AnimatePresence>
          {phase === "result" && result && (
            <CompassionChargeMeter heartCount={result.heartCount} visible={true} />
          )}
        </AnimatePresence>

        {/* Machine body */}
        <GlassCard
          className={cn(
            "mb-6 transition-all duration-700",
            streak.is_electric_blue && !isHeartResult ? "streak-blue-glow" : "slot-machine-glow",
            isHeartResult && "!border-rose-400/60 ![animation:none] shadow-[0_0_0_1px_rgba(251,113,133,0.6),0_0_40px_rgba(251,113,133,0.35)]",
            isNearMissResult && "!border-rose-400/30 shadow-[0_0_0_1px_rgba(251,113,133,0.3),0_0_20px_rgba(251,113,133,0.15)]"
          )}
        >
          <GlassCardContent className="p-6 sm:p-8">
            {/* Reels */}
            <div className="flex justify-center items-stretch gap-1 sm:gap-3 mb-8 relative">
              <div className={cn(
                "absolute inset-0 rounded-2xl border pointer-events-none transition-colors duration-700",
                isHeartResult ? "border-rose-400/50" : isNearMissResult ? "border-rose-400/25" : "border-primary/20"
              )} />
              {[0, 1, 2].map(i => (
                <React.Fragment key={i}>
                  <Reel
                    spinning={phase === "spinning"}
                    finalIdx={finalReels ? finalReels[i] : null}
                    stopDelay={i * 300}
                    onStopped={() => playReelStop()}
                    glowHeart={isHeartResult}
                    isNearMiss={isNearMissResult}
                  />
                  {i < 2 && <div className="w-px bg-white/10 self-stretch mx-1" />}
                </React.Fragment>
              ))}
            </div>

            {/* Result banner */}
            <AnimatePresence mode="wait">
              {phase === "result" && result && (
                <motion.div key="result" initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }} className="text-center mb-6">
                  <p className={cn("text-xl font-serif font-bold mb-1", tierColor[result.tier])}>
                    {isNearMissResult ? "♡♡ So Close…" : tierLabel[result.tier]}
                  </p>
                  {result.tier !== "compassion_jackpot" && !isNearMissResult && (
                    <p className={cn("text-sm font-medium", result.payout >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {result.payout >= 0 ? `+${result.payout}` : result.payout} Neural Energy
                    </p>
                  )}
                  {isNearMissResult && (
                    <p className="text-sm text-rose-300/70">The third heart was listening… play again.</p>
                  )}
                  {result.tier === "compassion_jackpot" && (
                    <p className="text-sm font-medium text-rose-300">+{COMPASSION_JACKPOT} Compassion Points</p>
                  )}
                  {result.payout > 0 && result.tier !== "compassion_jackpot" && (
                    <button
                      onClick={async () => {
                        const tierNames: Record<string, string> = { jackpot: "Milestone", three: "Triple Match", two: "Double Match" }
                        const text = `${tierNames[result.tier] ?? "Win"}! 🧠 I just earned +${result.payout} Neural Energy™ on NeuroQuest's Compassion Wheel! Every play funds hunger relief. #NeuroQuest #CompassionImpact`
                        const url = typeof window !== "undefined" ? window.location.origin + BASE : ""
                        const copyFallback = async () => {
                          try {
                            await navigator.clipboard.writeText(`${text}\n\n${url}`)
                            toast({ title: "Copied!", description: "Your win has been copied to clipboard." })
                          } catch {
                            toast({ title: "Share", description: text })
                          }
                        }
                        if (navigator.share) {
                          try { await navigator.share({ title: "NeuroQuest Win!", text, url }) }
                          catch (e: any) { if (e?.name !== "AbortError") await copyFallback() }
                        } else {
                          await copyFallback()
                        }
                      }}
                      className="inline-flex items-center gap-1.5 mt-2 px-4 py-1.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold hover:bg-primary/25 transition-all"
                    >
                      <Share2 className="w-3.5 h-3.5" /> Share Win
                    </button>
                  )}
                </motion.div>
              )}
              {phase === "idle" && !result && (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center mb-6 text-muted-foreground text-sm">
                  Focus your energy. Trust the mind.
                </motion.div>
              )}
              {phase === "spinning" && (
                <motion.div key="spinning" initial={{ opacity: 0 }}
                  animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 0.8 }}
                  className="text-center mb-6 text-primary text-sm font-medium tracking-widest uppercase"
                >
                  Playing…
                </motion.div>
              )}
            </AnimatePresence>

            {/* Spin button */}
            <div className="flex flex-col items-center gap-3">
              <motion.div
                animate={phase === "idle" && canSpin
                  ? { scale: [1, 1.025, 1], transition: { repeat: Infinity, duration: 1.8, ease: "easeInOut" } }
                  : { scale: 1 }
                }
              >
                <LuxuryButton
                  size="lg"
                  onClick={() => {
                    if (phase === "result" && !showJackpot) { resetSpin() }
                    else { handleSpin() }
                  }}
                  disabled={showJackpot || (phase === "idle" && !canSpin) || phase === "spinning" || isPending}
                  className={cn(
                    "w-52 gap-3 font-serif font-bold text-base tracking-wide transition-all duration-300",
                    phase === "result" && result && result.payout >= 0 && !isHeartResult ? "shadow-[0_0_30px_rgba(212,175,55,0.5)]" : "",
                    isHeartResult ? "shadow-[0_0_30px_rgba(251,113,133,0.5)]" : "",
                    isNearMissResult ? "bg-rose-500/80 hover:bg-rose-500 border-rose-400/50 shadow-[0_0_25px_rgba(251,113,133,0.4)]" : ""
                  )}
                >
                  <Heart className={cn("w-5 h-5", isNearMissResult ? "fill-white" : "")} />
                  {phase === "result" && !showJackpot
                    ? (isNearMissResult ? "Play Again ♡" : "Play Again")
                    : `Play (–${SPIN_COST})`
                  }
                </LuxuryButton>
              </motion.div>

              {profile && profile.neural_energy < SPIN_COST && phase !== "spinning" && !showJackpot && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="mt-4 w-full text-center px-5 py-5 rounded-2xl bg-rose-500/5 border border-rose-400/20 space-y-3"
                >
                  <Brain className="w-10 h-10 text-rose-400 mx-auto animate-pulse" />
                  <div>
                    <p className="font-serif text-base font-bold text-rose-300">Recharge Your Mind</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                      You need {SPIN_COST} Neural Energy to play. Earn more free or grab 10 instant plays.
                    </p>
                  </div>

                  {/* Instant buy */}
                  <LuxuryButton
                    onClick={handleBuySpins}
                    disabled={buyingSpins}
                    className="gap-2 w-full sm:w-auto bg-primary/18 border-primary/40 hover:bg-primary/28 text-primary"
                  >
                    {buyingSpins
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Redirecting…</>
                      : <><CreditCard className="w-3.5 h-3.5" /> Buy 10 Plays — $2.99</>
                    }
                  </LuxuryButton>

                  <div className="flex items-center gap-2 justify-center">
                    <div className="h-px flex-1 bg-white/8" />
                    <span className="text-[10px] text-white/20 font-semibold uppercase tracking-widest">or earn free</span>
                    <div className="h-px flex-1 bg-white/8" />
                  </div>

                  <LuxuryButton size="sm" onClick={() => navigate("/brain-game")}
                    className="gap-2 bg-rose-500/15 border-rose-400/30 hover:bg-rose-500/25 text-rose-200 mx-auto"
                  >
                    <Brain className="w-3.5 h-3.5" /> Play Memory Match → +50 Energy
                  </LuxuryButton>
                </motion.div>
              )}
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* Pay table toggle */}
        <div className="flex justify-center mb-4">
          <button onClick={() => setShowPay(v => !v)}
            className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
          >
            <Crown className="w-3.5 h-3.5" />
            {showPay ? "Hide" : "View"} Rewards Table
          </button>
        </div>
        <AnimatePresence>
          {showPay && (
            <motion.div key="pay" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-6">
              <PayTable />
            </motion.div>
          )}
        </AnimatePresence>

        {/* How it works blurb */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="rounded-2xl bg-white/3 border border-white/8 px-5 py-4 mb-8"
        >
          <div className="flex items-start gap-3">
            <Users className="w-4 h-4 text-rose-400/70 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-rose-400/60 mb-1">How Compassion Impact Works</p>
              <p className="text-xs text-white/40 leading-relaxed">
                Sponsored brands fund the donation pool. When you land 3× ♡, a real micro-donation is triggered automatically in your name.
                No extra cost to you — your generosity is built into every play.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
