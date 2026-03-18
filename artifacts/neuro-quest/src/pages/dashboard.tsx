import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Brain, Heart, Clover, Sparkles, History, RotateCcw, Gamepad2, Zap, Dices, Crown, Building2, Flame, Megaphone, Globe, TrendingUp, Users } from "lucide-react"
import { UserAuthButton } from "@/components/user-auth-button"
import { useQueryClient } from "@tanstack/react-query"
import { useLocation } from "wouter"
import { MorningBloomModal } from "@/components/morning-bloom-modal"
import { RaidModeBanner } from "@/components/raid-mode-banner"
import { NotificationWidget } from "@/components/notification-widget"
import { ReturnNudge } from "@/components/return-nudge"
import { GrowthChart } from "@/components/growth-chart"
import { GlobalImpactBanner } from "@/components/global-impact-banner"
import { FloatingShareButton } from "@/components/social-share"
import { CopyrightFooter } from "@/components/copyright-footer"

import { 
  useGetProfile, 
  useEarnEnergy, 
  useEarnCompassion, 
  useGetActivities,
  useResetProfile,
  getGetProfileQueryKey,
  getGetActivitiesQueryKey
} from "@workspace/api-client-react"

import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { LuxuryButton } from "@/components/ui/luxury-button"
import { StatRing } from "@/components/dashboard/stat-ring"
import { ActivityFeed } from "@/components/dashboard/activity-feed"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

const ENERGY_ACTIONS = [
  { label: "Deep Work (1 hr)", amount: 50 },
  { label: "Meditation (15 min)", amount: 20 },
  { label: "Read a Chapter", amount: 15 },
]

const COMPASSION_ACTIONS = [
  { label: "Help a Colleague", amount: 30 },
  { label: "Active Listening", amount: 20 },
  { label: "Express Gratitude", amount: 10 },
]

const DASH_SOCIAL_PROOF = [
  { name: "Layla", city: "Atlanta" },
  { name: "Marcus", city: "Chicago" },
  { name: "Soo-Yeon", city: "Seoul" },
  { name: "Destiny", city: "Houston" },
  { name: "Andres", city: "Miami" },
  { name: "Imani", city: "Brooklyn" },
]

function useDashCommunityPool(base = 12847) {
  const [pool, setPool] = React.useState(base)
  React.useEffect(() => {
    const tick = () => {
      setPool(p => p + Math.floor(Math.random() * 3 + 1))
      setTimeout(tick, Math.random() * 10000 + 5000)
    }
    const t = setTimeout(tick, 4000)
    return () => clearTimeout(t)
  }, [])
  return pool
}

function DashSocialProofTicker() {
  const [idx, setIdx] = React.useState(0)
  React.useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % DASH_SOCIAL_PROOF.length), 5000)
    return () => clearInterval(t)
  }, [])
  const w = DASH_SOCIAL_PROOF[idx]
  return (
    <AnimatePresence mode="wait">
      <motion.span key={idx} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.35 }}
        className="text-xs text-rose-300/60"
      >
        <span className="font-bold text-rose-300/80">{w.name}</span> in {w.city} just hit a Compassion Jackpot ♡
      </motion.span>
    </AnimatePresence>
  )
}

export default function Dashboard() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [, navigate] = useLocation()
  const communityPool = useDashCommunityPool()

  const { data: profile, isLoading: isProfileLoading } = useGetProfile()
  const { data: activities, isLoading: isActivitiesLoading } = useGetActivities()

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() })
    queryClient.invalidateQueries({ queryKey: getGetActivitiesQueryKey() })
  }

  const { mutate: earnEnergy, isPending: isEnergyPending } = useEarnEnergy({
    mutation: {
      onSuccess: () => {
        invalidateQueries()
        toast({ title: "Neural Energy gained.", description: "Your mind sharpens." })
      }
    }
  })

  const { mutate: earnCompassion, isPending: isCompassionPending } = useEarnCompassion({
    mutation: {
      onSuccess: () => {
        invalidateQueries()
        toast({ title: "Compassion earned.", description: "Your spirit warms." })
      }
    }
  })

  const { mutate: resetProfile, isPending: isResetPending } = useResetProfile({
    mutation: {
      onSuccess: () => {
        invalidateQueries()
        toast({ title: "Path Reset", description: "You have returned to the beginning." })
      }
    }
  })

  const handleAction = (type: "energy" | "compassion", activity: string, amount: number) => {
    if (type === "energy") {
      earnEnergy({ data: { activity, amount } })
    } else {
      earnCompassion({ data: { activity, amount } })
    }
  }

  const isPending = isEnergyPending || isCompassionPending

  const [streak, setStreak] = React.useState<{
    streak_count: number
    multiplier: number
    is_lucky_gold: boolean
    is_electric_blue: boolean
  } | null>(null)

  const [showGratitudeModal, setShowGratitudeModal] = React.useState(false)
  const [livesImpacted, setLivesImpacted] = React.useState<number | null>(null)

  React.useEffect(() => {
    fetch(`${BASE}/api/quest/leaderboard`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setLivesImpacted(d.lives_impacted ?? 0))
      .catch(() => {})
  }, [])

  React.useEffect(() => {
    fetch(`${BASE}/api/quest/streak`, { credentials: "include" })
      .then(r => r.json())
      .then(setStreak)
      .catch(() => {})
  }, [])

  // Check if gratitude has been completed today
  React.useEffect(() => {
    fetch(`${BASE}/api/quest/gratitude-status`, { credentials: "include" })
      .then(r => r.json())
      .then(data => { if (!data.done_today) setShowGratitudeModal(true) })
      .catch(() => {})
  }, [])

  return (
    <>
    <div className="min-h-screen relative overflow-hidden pb-20">
      {/* Morning Bloom Modal */}
      <AnimatePresence>
        {showGratitudeModal && (
          <MorningBloomModal onComplete={() => {
            setShowGratitudeModal(false)
            invalidateQueries()
          }} />
        )}
      </AnimatePresence>

      {/* Background Image Overlay */}
      <div 
        className="absolute inset-0 z-0 opacity-40 mix-blend-overlay pointer-events-none bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/zen-bg.png)` }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="p-3 bg-primary/20 rounded-2xl backdrop-blur-md border border-primary/30">
              <Clover className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-serif font-bold text-gradient-gold">NeuroQuest</h1>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest mt-1">
                Mind & Spirit
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <UserAuthButton />

            {profile && (
              <div className="flex items-center gap-4 bg-white/5 px-6 py-3 rounded-full border border-white/10 backdrop-blur-sm">
                <div className="flex flex-col items-end">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Level {profile.level}</span>
                  <span className="font-serif font-semibold text-primary">{profile.title}</span>
                </div>
                <div className="w-px h-8 bg-white/20 mx-2" />
                <LuxuryButton 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => resetProfile()}
                  disabled={isResetPending}
                  title="Reset Journey"
                >
                  <RotateCcw className="w-5 h-5 opacity-70 hover:opacity-100 transition-opacity" />
                </LuxuryButton>
              </div>
            )}
          </motion.div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Stats Column */}
          <div className="lg:col-span-8 space-y-8">

            {/* ── Neural Streak Banner ──────────────────────────────── */}
            {streak && streak.streak_count > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className={cn(
                  "flex items-center justify-between gap-4 px-5 py-4 rounded-2xl border backdrop-blur-md",
                  streak.is_electric_blue
                    ? "bg-blue-500/10 border-blue-400/40"
                    : "bg-amber-400/10 border-amber-400/30"
                )}
              >
                <div className="flex items-center gap-3">
                  <Flame className={cn("w-6 h-6 shrink-0", streak.is_electric_blue ? "text-blue-400" : "text-amber-400")} />
                  <div>
                    <p className={cn("font-serif font-bold text-lg leading-none", streak.is_electric_blue ? "text-blue-200" : "text-amber-200")}>
                      {streak.streak_count}-Day Neural Streak
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {streak.is_electric_blue
                        ? "Don't break it — Electric Blue jackpot boost active!"
                        : "Keep going — one more day unlocks Electric Blue!"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className={cn(
                    "flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border",
                    streak.is_electric_blue
                      ? "bg-blue-400/20 border-blue-400/40 text-blue-300"
                      : "bg-amber-400/20 border-amber-400/30 text-amber-300"
                  )}>
                    {streak.is_electric_blue ? "⚡ Electric Blue" : "✦ Lucky Gold"}
                  </div>
                  <div className="text-right">
                    <p className={cn("font-bold text-base leading-none", streak.is_electric_blue ? "text-blue-300" : "text-amber-300")}>
                      {streak.multiplier.toFixed(2)}×
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Boost</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Return Nudge — shows after 24h+ absence */}
            <ReturnNudge />

            {/* Notification opt-in widget */}
            <NotificationWidget />

            {/* Raid Mode Live Event Banner */}
            <RaidModeBanner />

            {/* Global Abundance Mission */}
            <GlobalImpactBanner compassionPoints={profile?.compassion_points} />

            <GlassCard glow>
              <GlassCardHeader>
                <GlassCardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" /> 
                  Current Resonance
                </GlassCardTitle>
              </GlassCardHeader>
              <GlassCardContent>
                <div className="flex flex-col sm:flex-row justify-around items-center gap-8 py-4">
                  <StatRing 
                    value={profile?.neural_energy || 0} 
                    label="Neural Energy" 
                    icon={<Brain className="w-6 h-6" />}
                    colorClass="text-primary"
                  />
                  <div className="hidden sm:block w-px h-32 bg-gradient-to-b from-transparent via-white/20 to-transparent" />
                  <StatRing 
                    value={profile?.compassion_points || 0} 
                    label="Compassion" 
                    icon={<Heart className="w-6 h-6" />}
                    colorClass="text-rose-400"
                  />
                </div>
              </GlassCardContent>
            </GlassCard>

            {/* Neural Stake — Brain Game */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <GlassCard
                className="cursor-pointer group hover:border-primary/40 transition-all duration-300"
                glow
                onClick={() => navigate("/brain-game")}
              >
                <GlassCardContent className="p-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/20 rounded-2xl border border-primary/30 group-hover:bg-primary/30 transition-colors">
                      <Gamepad2 className="w-7 h-7 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-serif font-semibold text-lg text-foreground">Neural Stake</h3>
                      <p className="text-sm text-muted-foreground">4×4 Memory Match · Train pattern recognition</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/30 rounded-full px-4 py-2 shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Zap className="w-4 h-4 text-primary" />
                    <span className="text-sm font-bold text-primary">+50</span>
                  </div>
                </GlassCardContent>
              </GlassCard>
            </motion.div>

            {/* Emotional EQ Game */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.13 }}
            >
              <GlassCard
                className="cursor-pointer group hover:border-cyan-400/40 transition-all duration-300"
                onClick={() => navigate("/eq-game")}
              >
                <GlassCardContent className="p-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-cyan-400/15 rounded-2xl border border-cyan-400/25 group-hover:bg-cyan-400/25 transition-colors">
                      <Brain className="w-7 h-7 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="font-serif font-semibold text-lg text-foreground">Emotional EQ</h3>
                      <p className="text-sm text-muted-foreground">10 faces · 1.5s each · Train emotional intelligence</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-cyan-400/10 border border-cyan-400/25 rounded-full px-4 py-2 shrink-0 group-hover:bg-cyan-400/20 transition-colors">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm font-bold text-cyan-400">+60</span>
                  </div>
                </GlassCardContent>
              </GlassCard>
            </motion.div>

            {/* Casino — Compassion Jackpot Hero */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <GlassCard
                className="cursor-pointer group hover:border-rose-400/50 transition-all duration-300 relative overflow-hidden slot-machine-glow"
                onClick={() => navigate("/casino")}
              >
                {/* Ambient gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-rose-500/8 via-transparent to-orange-400/5 pointer-events-none" />

                <GlassCardContent className="p-0">
                  {/* Top bar: live pool */}
                  <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse shrink-0" />
                      <DashSocialProofTicker />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Users className="w-3 h-3 text-rose-400/60" />
                      <motion.span
                        key={communityPool}
                        initial={{ color: "#f87171" }}
                        animate={{ color: "#fb7185" }}
                        transition={{ duration: 0.4 }}
                        className="text-xs font-bold tabular-nums text-rose-400"
                      >
                        {communityPool.toLocaleString()}
                      </motion.span>
                      <span className="text-xs text-white/30">lives touched</span>
                    </div>
                  </div>

                  {/* Main content */}
                  <div className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="relative p-3 bg-rose-400/15 rounded-2xl border border-rose-400/30 group-hover:bg-rose-400/25 transition-colors shrink-0">
                        <Dices className="w-7 h-7 text-rose-300" />
                        <motion.div
                          animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
                          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                          className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-400 flex items-center justify-center"
                        >
                          <Heart className="w-2 h-2 text-white fill-white" />
                        </motion.div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="font-serif font-semibold text-lg text-foreground">The Casino</h3>
                          <span className="text-[9px] font-bold uppercase tracking-widest bg-rose-400/15 text-rose-300 border border-rose-400/30 rounded-full px-2 py-0.5">
                            Compassion Jackpot
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">3× ♡ = real micro-donation funded · Sponsored</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center gap-1 bg-rose-400/15 border border-rose-400/35 rounded-full px-3 py-1.5 group-hover:bg-rose-400/25 transition-colors">
                        {[0,1,2].map(i => (
                          <motion.div key={i} animate={{ scale: [1, 1.15, 1] }} transition={{ delay: i * 0.18, repeat: Infinity, duration: 1.4, ease: "easeInOut" }}>
                            <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                          </motion.div>
                        ))}
                      </div>
                      <span className="text-[10px] text-rose-400/60 font-semibold">Win = Change a Life</span>
                    </div>
                  </div>

                  {/* Impact bar */}
                  <div className="px-5 pb-4 flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-rose-400/50 shrink-0" />
                    <p className="text-[11px] text-white/35 leading-relaxed">
                      Every jackpot triggers a real donation to <span className="text-rose-300/60 font-semibold">World Hunger Relief Fund</span> — at no extra cost to you.
                    </p>
                  </div>
                </GlassCardContent>
              </GlassCard>
            </motion.div>

            {/* Mind-Reader Blackjack */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.17 }}
            >
              <GlassCard
                className="cursor-pointer group hover:border-indigo-400/40 transition-all duration-300"
                onClick={() => navigate("/blackjack")}
              >
                <GlassCardContent className="p-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-400/15 rounded-2xl border border-indigo-400/25 group-hover:bg-indigo-400/25 transition-colors">
                      <Crown className="w-7 h-7 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="font-serif font-semibold text-lg text-foreground">Mind-Reader Blackjack</h3>
                      <p className="text-sm text-muted-foreground">Predict dealer's card · +60% bonus win</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-indigo-400/10 border border-indigo-400/25 rounded-full px-4 py-2 shrink-0 group-hover:bg-indigo-400/20 transition-colors">
                    <Zap className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm font-bold text-indigo-400">×1.6</span>
                  </div>
                </GlassCardContent>
              </GlassCard>
            </motion.div>

            {/* Global Leaderboard — Total Lives Impacted */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
            >
              <GlassCard className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-rose-500/5 via-transparent to-rose-400/5 pointer-events-none" />
                <GlassCardContent className="p-6 flex items-center gap-5">
                  <div className="p-3 bg-rose-400/15 rounded-2xl border border-rose-400/30 shrink-0">
                    <Globe className="w-7 h-7 text-rose-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400/70 mb-0.5">Global Leaderboard</p>
                    <h3 className="font-serif font-semibold text-lg text-foreground flex items-baseline gap-2">
                      Total Lives Impacted
                    </h3>
                    <p className="text-xs text-muted-foreground">Increases every time anyone hits a Heart Jackpot</p>
                  </div>
                  <div className="text-right shrink-0">
                    {livesImpacted === null ? (
                      <div className="w-12 h-8 bg-white/5 rounded-lg animate-pulse" />
                    ) : (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="font-serif font-bold text-3xl text-rose-400 drop-shadow-[0_0_12px_rgba(251,113,133,0.5)]"
                      >
                        {livesImpacted.toLocaleString()}
                      </motion.div>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">micro-donations</p>
                  </div>
                </GlassCardContent>
              </GlassCard>
            </motion.div>

            {/* Zen Pro Upgrade CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <GlassCard
                className="cursor-pointer group slot-machine-glow hover:!border-primary/70 transition-all duration-300 relative overflow-hidden"
                onClick={() => navigate("/subscribe")}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-amber-400/5 pointer-events-none" />
                <GlassCardContent className="p-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/20 rounded-2xl border border-primary/40 group-hover:bg-primary/30 transition-colors">
                      <Crown className="w-7 h-7 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-serif font-semibold text-lg text-gradient-gold">Zen Pro</h3>
                        <span className="text-[10px] font-bold uppercase tracking-widest bg-primary/20 text-primary border border-primary/30 rounded-full px-2 py-0.5">Tier 1</span>
                      </div>
                      <p className="text-sm text-muted-foreground">2× Energy · Gold skins · Unlimited games</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/30 rounded-full px-4 py-2 shrink-0 group-hover:bg-primary/20 transition-colors">
                    <span className="text-sm font-bold text-primary font-serif">$9.99/mo</span>
                  </div>
                </GlassCardContent>
              </GlassCard>
            </motion.div>

            {/* Enterprise CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <GlassCard
                className="cursor-pointer group hover:border-violet-400/50 transition-all duration-300 relative overflow-hidden"
                onClick={() => navigate("/enterprise")}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-transparent to-primary/5 pointer-events-none" />
                <GlassCardContent className="p-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-violet-400/15 rounded-2xl border border-violet-400/30 group-hover:bg-violet-400/25 transition-colors">
                      <Building2 className="w-7 h-7 text-violet-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-serif font-semibold text-lg text-foreground">Corporate Wellness</h3>
                        <span className="text-[10px] font-bold uppercase tracking-widest bg-violet-400/15 text-violet-400 border border-violet-400/30 rounded-full px-2 py-0.5">Tier 2</span>
                      </div>
                      <p className="text-sm text-muted-foreground">Team licences · Analytics · SSO · Custom branding</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-violet-400/10 border border-violet-400/25 rounded-full px-4 py-2 shrink-0 group-hover:bg-violet-400/15 transition-colors">
                    <span className="text-sm font-bold text-violet-400 font-serif">From $299/mo</span>
                  </div>
                </GlassCardContent>
              </GlassCard>
            </motion.div>

            {/* Sponsored Jackpots CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <GlassCard
                className="cursor-pointer group hover:border-cyan-400/50 transition-all duration-300 relative overflow-hidden"
                onClick={() => navigate("/sponsor")}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-teal-400/5 pointer-events-none" />
                <GlassCardContent className="p-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-cyan-400/15 rounded-2xl border border-cyan-400/30 group-hover:bg-cyan-400/25 transition-colors">
                      <Megaphone className="w-7 h-7 text-cyan-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-serif font-semibold text-lg text-foreground">Sponsored Jackpots</h3>
                        <span className="text-[10px] font-bold uppercase tracking-widest bg-cyan-400/15 text-cyan-400 border border-cyan-400/30 rounded-full px-2 py-0.5">Tier 3</span>
                      </div>
                      <p className="text-sm text-muted-foreground">Brands sponsor prizes · Players win real rewards</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-cyan-400/10 border border-cyan-400/25 rounded-full px-4 py-2 shrink-0 group-hover:bg-cyan-400/15 transition-colors">
                    <span className="text-sm font-bold text-cyan-400 font-serif">From $500/mo</span>
                  </div>
                </GlassCardContent>
              </GlassCard>
            </motion.div>

            {/* Actions Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Focus Actions */}
              <GlassCard>
                <GlassCardHeader>
                  <GlassCardTitle className="text-xl">Focus & Mind</GlassCardTitle>
                  <p className="text-sm text-muted-foreground mt-2">Cultivate neural pathways and deepen your concentration.</p>
                </GlassCardHeader>
                <GlassCardContent className="space-y-3">
                  {ENERGY_ACTIONS.map((action) => (
                    <LuxuryButton
                      key={action.label}
                      variant="outline"
                      className="w-full justify-between"
                      onClick={() => handleAction("energy", action.label, action.amount)}
                      disabled={isPending}
                    >
                      <span>{action.label}</span>
                      <span className="text-primary font-serif font-bold">+{action.amount}</span>
                    </LuxuryButton>
                  ))}
                </GlassCardContent>
              </GlassCard>

              {/* Heart Actions */}
              <GlassCard>
                <GlassCardHeader>
                  <GlassCardTitle className="text-xl">Heart & Spirit</GlassCardTitle>
                  <p className="text-sm text-muted-foreground mt-2">Extend your compassion and connect with others.</p>
                </GlassCardHeader>
                <GlassCardContent className="space-y-3">
                  {COMPASSION_ACTIONS.map((action) => (
                    <LuxuryButton
                      key={action.label}
                      variant="glass"
                      className="w-full justify-between border-rose-400/30 hover:border-rose-400/60"
                      onClick={() => handleAction("compassion", action.label, action.amount)}
                      disabled={isPending}
                    >
                      <span className="text-rose-100">{action.label}</span>
                      <span className="text-rose-400 font-serif font-bold">+{action.amount}</span>
                    </LuxuryButton>
                  ))}
                </GlassCardContent>
              </GlassCard>
            </div>
          </div>

          {/* Sidebar / Activity Feed */}
          <div className="lg:col-span-4 space-y-6">
            {/* 7-Day Growth Chart */}
            <GrowthChart />

            <GlassCard className="min-h-[400px]">
              <GlassCardHeader>
                <GlassCardTitle className="flex items-center gap-2 text-xl">
                  <History className="w-5 h-5 text-primary" />
                  Chronicle
                </GlassCardTitle>
              </GlassCardHeader>
              <GlassCardContent>
                <ActivityFeed 
                  activities={activities || []} 
                  isLoading={isActivitiesLoading} 
                />
              </GlassCardContent>
            </GlassCard>
          </div>

        </div>
      </div>

      <CopyrightFooter />
    </div>

    <FloatingShareButton config={{
      url: typeof window !== "undefined" ? window.location.origin + BASE : "",
      title: "NeuroQuest — Compassion Casino",
      description: "I'm training my mind & funding hunger relief with every spin. Your mind is the stake. The world is the winner.",
      hashtags: ["NeuroQuest", "CompassionCasino", "Neuroplasticity"],
    }} />
    </>
  )
}
