import React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Brain, Heart, Clover, Sparkles, History, RotateCcw, Gamepad2, Zap, Crown, Building2, Flame, Megaphone, Globe, Share2, Layers, CheckCircle2, X } from "lucide-react"
import { UserAuthButton } from "@/components/user-auth-button"
import { useQueryClient } from "@tanstack/react-query"
import { useLocation } from "wouter"
import { MorningBloomModal } from "@/components/morning-bloom-modal"
import { RaidModeBanner } from "@/components/raid-mode-banner"
import { NotificationWidget } from "@/components/notification-widget"
import { ReturnNudge } from "@/components/return-nudge"
import { GrowthChart } from "@/components/growth-chart"
import { GlobalImpactBanner } from "@/components/global-impact-banner"
import { CopyrightFooter } from "@/components/copyright-footer"
import { CelebrationOverlay, type CelebrationType } from "@/components/celebration-overlay"

import { 
  useGetProfile, 
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

function computeEmpathyIndex(profile: { compassion_points?: number; level?: number; neural_energy?: number }) {
  const cp = profile.compassion_points ?? 0
  const lvl = profile.level ?? 1
  const compassionScore = Math.min(50, Math.sqrt(cp) * 2)
  const levelScore = Math.min(30, lvl * 3)
  const consistencyScore = Math.min(20, (cp > 0 && (profile.neural_energy ?? 0) > 0) ? 10 + Math.min(10, Math.log2(cp + 1) * 2) : 0)
  return Math.round(Math.min(100, compassionScore + levelScore + consistencyScore))
}

function computeHBHS(profile: { neural_energy?: number; compassion_points?: number; level?: number }) {
  const ne = profile.neural_energy ?? 0
  const cp = profile.compassion_points ?? 0
  const lvl = profile.level ?? 1
  const brainScore = Math.min(40, Math.sqrt(ne) * 0.8)
  const heartScore = Math.min(40, Math.sqrt(cp) * 1.2)
  const balance = ne > 0 && cp > 0
    ? 1 - Math.abs(Math.sqrt(ne) - Math.sqrt(cp)) / (Math.sqrt(ne) + Math.sqrt(cp))
    : 0
  const harmonyBonus = Math.min(20, balance * 15 + lvl * 0.5)
  return Math.round(Math.min(100, brainScore + heartScore + harmonyBonus))
}

const ENERGY_ACTIONS = [
  { id: "deep-work",   label: "Deep Work (1 hr)", amount: 50 },
  { id: "meditation",  label: "Meditation (15 min)", amount: 20 },
  { id: "read-chapter", label: "Read a Chapter", amount: 15 },
]

const COMPASSION_ACTIONS = [
  { id: "help-colleague",    label: "Help a Colleague", amount: 30 },
  { id: "active-listening",  label: "Active Listening", amount: 20 },
  { id: "express-gratitude", label: "Express Gratitude", amount: 10 },
]

export default function Dashboard() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [, navigate] = useLocation()

  const { data: profile, isLoading: isProfileLoading } = useGetProfile()
  const { data: activities, isLoading: isActivitiesLoading } = useGetActivities()

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() })
    queryClient.invalidateQueries({ queryKey: getGetActivitiesQueryKey() })
  }

  const { mutate: resetProfile, isPending: isResetPending } = useResetProfile({
    mutation: {
      onSuccess: () => {
        invalidateQueries()
        toast({ title: "Path Reset", description: "You have returned to the beginning." })
      }
    }
  })

  const [taskCompletions, setTaskCompletions] = React.useState<Record<string, { done: boolean; response: string }>>({})
  const [reflectionModal, setReflectionModal] = React.useState<{ taskId: string; label: string; amount: number; type: "energy" | "compassion" } | null>(null)
  const [reflectionText, setReflectionText] = React.useState("")
  const [isSubmittingTask, setIsSubmittingTask] = React.useState(false)
  const [celebration, setCelebration] = React.useState<{
    type: CelebrationType; amount?: number; title: string; subtitle: string; impactLine?: string
  } | null>(null)

  React.useEffect(() => {
    fetch(`${BASE}/api/quest/task-status`, { credentials: "include" })
      .then(r => r.json())
      .then(data => setTaskCompletions(data.completions || {}))
      .catch(() => {})
  }, [])

  const handleAction = (type: "energy" | "compassion", taskId: string, label: string, amount: number) => {
    if (taskCompletions[taskId]?.done) return
    setReflectionModal({ taskId, label, amount, type })
    setReflectionText("")
  }

  const submitReflection = async () => {
    if (!reflectionModal) return
    if (reflectionText.trim().length < 15) {
      toast({ title: "Too short", description: "Please write at least 15 characters about your session.", variant: "destructive" })
      return
    }
    setIsSubmittingTask(true)
    try {
      const resp = await fetch(`${BASE}/api/quest/complete-task`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: reflectionModal.taskId, response: reflectionText.trim() }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        if (data.already_done) {
          setTaskCompletions(prev => ({ ...prev, [reflectionModal.taskId]: { done: true, response: reflectionText.trim() } }))
          toast({ title: "Already completed", description: "You have already finished this task today." })
        } else {
          toast({ title: "Error", description: data.error || "Could not complete task.", variant: "destructive" })
        }
        setReflectionModal(null)
        return
      }
      setTaskCompletions(prev => ({ ...prev, [reflectionModal.taskId]: { done: true, response: reflectionText.trim() } }))
      invalidateQueries()
      setReflectionModal(null)

      if (data.level_changed) {
        setCelebration({
          type: "level-up",
          title: `Level ${data.new_level} — ${data.new_title}`,
          subtitle: "Your consistent practice is reshaping your neural pathways.",
        })
      } else if (reflectionModal.type === "compassion" && data.meals_contributed > 0) {
        setCelebration({
          type: "compassion",
          amount: data.awarded_amount,
          title: "Compassion earned.",
          subtitle: "Your spirit grows stronger with every act of kindness.",
          impactLine: `+${data.meals_contributed} meals closer to ending hunger`,
        })
      } else {
        setCelebration({
          type: "energy",
          amount: data.awarded_amount ?? reflectionModal.amount,
          title: reflectionModal.type === "energy" ? "Neural pathways strengthened." : "Compassion deepened.",
          subtitle: reflectionModal.type === "energy"
            ? "Each session builds on the last. Your mind remembers."
            : "Connection and empathy — the foundation of growth.",
        })
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" })
    } finally {
      setIsSubmittingTask(false)
    }
  }

  const isPending = isSubmittingTask

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

  React.useEffect(() => {
    fetch(`${BASE}/api/quest/gratitude-status`, { credentials: "include" })
      .then(r => r.json())
      .then(data => { if (!data.done_today) setShowGratitudeModal(true) })
      .catch(() => {})
  }, [])

  return (
    <div className="min-h-screen relative overflow-hidden pb-20">
      <CelebrationOverlay celebration={celebration} onDone={() => setCelebration(null)} />

      <AnimatePresence>
        {showGratitudeModal && (
          <MorningBloomModal onComplete={() => {
            setShowGratitudeModal(false)
            invalidateQueries()
          }} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reflectionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !isSubmittingTask && setReflectionModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md"
            >
              <GlassCard>
                <GlassCardContent className="p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-serif font-bold text-foreground">{reflectionModal.label}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        +{reflectionModal.amount} {reflectionModal.type === "energy" ? "Neural Energy" : "Compassion Points"}
                      </p>
                    </div>
                    <button
                      onClick={() => setReflectionModal(null)}
                      disabled={isSubmittingTask}
                      className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground block mb-2">
                      What did you do? Describe your session.
                    </label>
                    <textarea
                      value={reflectionText}
                      onChange={(e) => setReflectionText(e.target.value)}
                      placeholder="e.g. I meditated for 15 minutes using guided breathing exercises..."
                      rows={4}
                      maxLength={500}
                      className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 resize-none transition-colors"
                      autoFocus
                    />
                    <div className="flex items-center justify-between mt-1.5">
                      <p className={cn("text-[11px]", reflectionText.trim().length >= 15 ? "text-emerald-400" : "text-muted-foreground")}>
                        {reflectionText.trim().length}/15 characters minimum
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {reflectionText.length}/500
                      </p>
                    </div>
                  </div>

                  <LuxuryButton
                    className="w-full gap-2"
                    onClick={submitReflection}
                    disabled={isSubmittingTask || reflectionText.trim().length < 15}
                  >
                    {isSubmittingTask ? "Saving…" : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Complete & Earn +{reflectionModal.amount}
                      </>
                    )}
                  </LuxuryButton>
                </GlassCardContent>
              </GlassCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <header className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-2xl border border-primary/30">
              <Clover className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-serif font-bold text-gradient-gold">NeuroQuest</h1>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest mt-1">
                Mind & Spirit
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <UserAuthButton />

            {profile && (
              <div className="flex items-center gap-4 bg-white/5 px-6 py-3 rounded-full border border-white/10">
                <div className="flex flex-col items-end">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Level {profile.level}</span>
                  <span className="font-serif font-semibold text-primary">{profile.title}</span>
                </div>
                <div className="w-px h-8 bg-white/20 mx-2" />
                <LuxuryButton
                  variant="outline"
                  size="icon"
                  title="Share Profile"
                  className="border-primary/30 hover:border-primary/60"
                  onClick={() => navigate("/share")}
                >
                  <Share2 className="w-5 h-5" />
                </LuxuryButton>
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
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-8 space-y-6">

            {streak && streak.streak_count > 0 && (
              <div
                className={cn(
                  "flex items-center justify-between gap-4 px-5 py-4 rounded-2xl border",
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
                        ? "Electric Blue wellness boost active"
                        : "Keep going — one more day unlocks Electric Blue"}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn("font-bold text-base leading-none", streak.is_electric_blue ? "text-blue-300" : "text-amber-300")}>
                    {streak.multiplier.toFixed(2)}×
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Boost</p>
                </div>
              </div>
            )}

            <ReturnNudge />
            <NotificationWidget />
            <RaidModeBanner />
            <GlobalImpactBanner compassionPoints={profile?.compassion_points} />

            <GlassCard>
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

            <GlassCard
              className="cursor-pointer group hover:border-primary/40 transition-colors"
              onClick={() => navigate("/brain-game")}
            >
              <GlassCardContent className="p-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/20 rounded-2xl border border-primary/30">
                    <Gamepad2 className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-serif font-semibold text-lg text-foreground">Neural Challenge</h3>
                    <p className="text-sm text-muted-foreground">4×4 Memory Match · Train pattern recognition</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/30 rounded-full px-4 py-2 shrink-0">
                  <Zap className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold text-primary">+50</span>
                </div>
              </GlassCardContent>
            </GlassCard>

            <GlassCard
              className="cursor-pointer group hover:border-cyan-400/40 transition-colors"
              onClick={() => navigate("/eq-game")}
            >
              <GlassCardContent className="p-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-cyan-400/15 rounded-2xl border border-cyan-400/25">
                    <Brain className="w-7 h-7 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="font-serif font-semibold text-lg text-foreground">Emotional EQ</h3>
                    <p className="text-sm text-muted-foreground">10 faces · 1.5s each · Train emotional intelligence</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-cyan-400/10 border border-cyan-400/25 rounded-full px-4 py-2 shrink-0">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-bold text-cyan-400">+60</span>
                </div>
              </GlassCardContent>
            </GlassCard>

            <GlassCard
              className="cursor-pointer group hover:border-violet-400/40 transition-colors"
              onClick={() => navigate("/pattern-pulse")}
            >
              <GlassCardContent className="p-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-violet-400/15 rounded-2xl border border-violet-400/25">
                    <Layers className="w-7 h-7 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="font-serif font-semibold text-lg text-foreground">Pattern Pulse</h3>
                    <p className="text-sm text-muted-foreground">7 levels · Visual-spatial working memory</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-violet-400/10 border border-violet-400/25 rounded-full px-4 py-2 shrink-0">
                  <Zap className="w-4 h-4 text-violet-400" />
                  <span className="text-sm font-bold text-violet-400">+90</span>
                </div>
              </GlassCardContent>
            </GlassCard>

            <GlassCard
              className="cursor-pointer group hover:border-rose-400/40 transition-colors"
              onClick={() => navigate("/wellness")}
            >
              <GlassCardContent className="p-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-rose-400/15 rounded-2xl border border-rose-400/30">
                    <Heart className="w-7 h-7 text-rose-300" />
                  </div>
                  <div>
                    <h3 className="font-serif font-semibold text-lg text-foreground">Compassion Wheel</h3>
                    <p className="text-sm text-muted-foreground">3× ♡ triggers a real micro-donation · Sponsored</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-rose-400/10 border border-rose-400/30 rounded-full px-4 py-2 shrink-0">
                  <Heart className="w-4 h-4 text-rose-400" />
                  <span className="text-sm font-bold text-rose-400">Impact</span>
                </div>
              </GlassCardContent>
            </GlassCard>

            <GlassCard
              className="cursor-pointer group hover:border-indigo-400/40 transition-colors"
              onClick={() => navigate("/blackjack")}
            >
              <GlassCardContent className="p-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-400/15 rounded-2xl border border-indigo-400/25">
                    <Crown className="w-7 h-7 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="font-serif font-semibold text-lg text-foreground">Mind-Reader Blackjack</h3>
                    <p className="text-sm text-muted-foreground">Predict dealer's card · +60% bonus win</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-indigo-400/10 border border-indigo-400/25 rounded-full px-4 py-2 shrink-0">
                  <Zap className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm font-bold text-indigo-400">×1.6</span>
                </div>
              </GlassCardContent>
            </GlassCard>

            {profile && (() => {
              const empathy = computeEmpathyIndex(profile)
              const hbhs = computeHBHS(profile)
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <GlassCard>
                    <GlassCardContent className="p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-rose-400/15 rounded-xl border border-rose-400/25">
                          <Heart className="w-5 h-5 text-rose-400" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400/70">Empathy Index</p>
                          <p className="text-xs text-muted-foreground">Emotional awareness score</p>
                        </div>
                      </div>
                      <div className="relative h-3 bg-white/5 rounded-full overflow-hidden mb-2">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-rose-500 to-rose-400 transition-all duration-700"
                          style={{ width: `${empathy}%` }}
                        />
                      </div>
                      <div className="flex items-end justify-between">
                        <span className="font-serif font-bold text-2xl text-rose-400">{empathy}</span>
                        <span className="text-[10px] text-muted-foreground">/ 100</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {empathy >= 80 ? "Exceptional emotional resonance." :
                         empathy >= 60 ? "Strong empathic awareness developing." :
                         empathy >= 40 ? "Growing emotional intelligence." :
                         "Building your empathy foundation."}
                      </p>
                    </GlassCardContent>
                  </GlassCard>

                  <GlassCard>
                    <GlassCardContent className="p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-gradient-to-br from-cyan-400/20 to-rose-400/20 rounded-xl border border-cyan-400/20">
                          <Brain className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-400/70">Heart-Brain Score</p>
                          <p className="text-xs text-muted-foreground">Mind + spirit harmony</p>
                        </div>
                      </div>
                      <div className="relative h-3 bg-white/5 rounded-full overflow-hidden mb-2">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-500 via-violet-400 to-rose-400 transition-all duration-700"
                          style={{ width: `${hbhs}%` }}
                        />
                      </div>
                      <div className="flex items-end justify-between">
                        <span className="font-serif font-bold text-2xl bg-gradient-to-r from-cyan-400 to-rose-400 bg-clip-text text-transparent">
                          {hbhs}
                        </span>
                        <span className="text-[10px] text-muted-foreground">/ 100</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {hbhs >= 80 ? "Remarkable mind-spirit integration." :
                         hbhs >= 60 ? "Strong cognitive-emotional balance." :
                         hbhs >= 40 ? "Building neural-heart coherence." :
                         "The journey of integration begins here."}
                      </p>
                    </GlassCardContent>
                  </GlassCard>
                </div>
              )
            })()}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <GlassCard>
                <GlassCardHeader>
                  <GlassCardTitle className="text-xl">Focus & Mind</GlassCardTitle>
                  <p className="text-sm text-muted-foreground mt-2">Cultivate neural pathways and deepen your concentration.</p>
                </GlassCardHeader>
                <GlassCardContent className="space-y-3">
                  {ENERGY_ACTIONS.map((action) => {
                    const completed = taskCompletions[action.id]?.done
                    return (
                      <div key={action.id} className="space-y-1">
                        <LuxuryButton
                          variant="outline"
                          className={cn("w-full justify-between", completed && "opacity-60 cursor-default")}
                          onClick={() => handleAction("energy", action.id, action.label, action.amount)}
                          disabled={isPending || completed}
                        >
                          <span className="flex items-center gap-2">
                            {completed && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                            {action.label}
                          </span>
                          {completed
                            ? <span className="text-emerald-400 text-xs font-semibold">Done today</span>
                            : <span className="text-primary font-serif font-bold">+{action.amount}</span>
                          }
                        </LuxuryButton>
                        {completed && taskCompletions[action.id]?.response && (
                          <p className="text-[11px] text-muted-foreground italic pl-7 truncate">
                            "{taskCompletions[action.id].response}"
                          </p>
                        )}
                      </div>
                    )
                  })}
                </GlassCardContent>
              </GlassCard>

              <GlassCard>
                <GlassCardHeader>
                  <GlassCardTitle className="text-xl">Heart & Spirit</GlassCardTitle>
                  <p className="text-sm text-muted-foreground mt-2">Extend your compassion and connect with others.</p>
                </GlassCardHeader>
                <GlassCardContent className="space-y-3">
                  {COMPASSION_ACTIONS.map((action) => {
                    const completed = taskCompletions[action.id]?.done
                    return (
                      <div key={action.id} className="space-y-1">
                        <LuxuryButton
                          variant="glass"
                          className={cn("w-full justify-between border-rose-400/30 hover:border-rose-400/60", completed && "opacity-60 cursor-default")}
                          onClick={() => handleAction("compassion", action.id, action.label, action.amount)}
                          disabled={isPending || completed}
                        >
                          <span className={cn("flex items-center gap-2", !completed && "text-rose-100")}>
                            {completed && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                            {action.label}
                          </span>
                          {completed
                            ? <span className="text-emerald-400 text-xs font-semibold">Done today</span>
                            : <span className="text-rose-400 font-serif font-bold">+{action.amount}</span>
                          }
                        </LuxuryButton>
                        {completed && taskCompletions[action.id]?.response && (
                          <p className="text-[11px] text-muted-foreground italic pl-7 truncate">
                            "{taskCompletions[action.id].response}"
                          </p>
                        )}
                      </div>
                    )
                  })}
                </GlassCardContent>
              </GlassCard>
            </div>

            <GlassCard>
              <GlassCardContent className="p-6 flex items-center gap-5">
                <div className="p-3 bg-rose-400/15 rounded-2xl border border-rose-400/30 shrink-0">
                  <Globe className="w-7 h-7 text-rose-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400/70 mb-0.5">Global Leaderboard</p>
                  <h3 className="font-serif font-semibold text-lg text-foreground">
                    Total Lives Impacted
                  </h3>
                  <p className="text-xs text-muted-foreground">Increases every time anyone reaches a Compassion Milestone</p>
                </div>
                <div className="text-right shrink-0">
                  {livesImpacted === null ? (
                    <div className="w-12 h-8 bg-white/5 rounded-lg animate-pulse" />
                  ) : (
                    <span className="font-serif font-bold text-3xl text-rose-400">
                      {livesImpacted.toLocaleString()}
                    </span>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-0.5">micro-donations</p>
                </div>
              </GlassCardContent>
            </GlassCard>

            <GlassCard
              className="cursor-pointer group hover:border-primary/40 transition-colors"
              onClick={() => navigate("/subscribe")}
            >
              <GlassCardContent className="p-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/20 rounded-2xl border border-primary/40">
                    <Crown className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-serif font-semibold text-lg text-gradient-gold">Zen Pro</h3>
                    <p className="text-sm text-muted-foreground">2x Energy · Gold skins · Unlimited games</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/30 rounded-full px-4 py-2 shrink-0">
                  <span className="text-sm font-bold text-primary font-serif">$9.99/mo</span>
                </div>
              </GlassCardContent>
            </GlassCard>

            <GlassCard
              className="cursor-pointer group hover:border-violet-400/40 transition-colors"
              onClick={() => navigate("/enterprise")}
            >
              <GlassCardContent className="p-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-violet-400/15 rounded-2xl border border-violet-400/30">
                    <Building2 className="w-7 h-7 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="font-serif font-semibold text-lg text-foreground">Corporate Wellness</h3>
                    <p className="text-sm text-muted-foreground">Team licences · Analytics · SSO · Custom branding</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-violet-400/10 border border-violet-400/25 rounded-full px-4 py-2 shrink-0">
                  <span className="text-sm font-bold text-violet-400 font-serif">From $299/mo</span>
                </div>
              </GlassCardContent>
            </GlassCard>

            <GlassCard
              className="cursor-pointer group hover:border-cyan-400/40 transition-colors"
              onClick={() => navigate("/sponsor")}
            >
              <GlassCardContent className="p-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-cyan-400/15 rounded-2xl border border-cyan-400/30">
                    <Megaphone className="w-7 h-7 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="font-serif font-semibold text-lg text-foreground">Sponsored Impact</h3>
                    <p className="text-sm text-muted-foreground">Brands sponsor wellness · Players earn real rewards</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-cyan-400/10 border border-cyan-400/25 rounded-full px-4 py-2 shrink-0">
                  <span className="text-sm font-bold text-cyan-400 font-serif">From $500/mo</span>
                </div>
              </GlassCardContent>
            </GlassCard>
          </div>

          <div className="lg:col-span-4 space-y-6">
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
  )
}
