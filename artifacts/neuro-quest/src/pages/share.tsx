import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { useLocation } from "wouter"
import { ArrowLeft, Download, Smartphone, Monitor, Star, Zap, Heart, Brain, Share2 } from "lucide-react"
import { SocialSharePanel } from "@/components/social-share"
import { CopyrightFooter } from "@/components/copyright-footer"
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { LuxuryButton } from "@/components/ui/luxury-button"
import { cn } from "@/lib/utils"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

const SHARE_CONFIGS = [
  {
    id: "general",
    label: "General",
    icon: Star,
    color: "text-primary",
    config: {
      title: "NeuroQuest — Compassion Casino",
      description: "I'm training my mind & funding hunger relief with every spin. Your mind is the stake. The world is the winner.",
      hashtags: ["NeuroQuest", "CompassionCasino", "Neuroplasticity", "GlobalAbundance"],
    },
  },
  {
    id: "jackpot",
    label: "Jackpot Win",
    icon: Heart,
    color: "text-rose-400",
    config: {
      title: "I just hit the Compassion Jackpot on NeuroQuest!",
      description: "3 hearts aligned and a real meal was funded in my name. This is the most meaningful win I've ever had in any game. 💚",
      hashtags: ["CompassionJackpot", "NeuroQuestImpact", "NeuroQuest", "GivingBack"],
    },
  },
  {
    id: "challenge",
    label: "Challenge a Friend",
    icon: Brain,
    color: "text-cyan-400",
    config: {
      title: "I challenge you to NeuroQuest",
      description: "Can you beat my Neural Energy score? NeuroQuest trains your brain AND funds hunger relief. Join me — first spin is free.",
      hashtags: ["NeuroQuest", "BrainChallenge", "Neuroplasticity", "CompassionCasino"],
    },
  },
  {
    id: "streak",
    label: "Sharing My Streak",
    icon: Zap,
    color: "text-amber-400",
    config: {
      title: "My NeuroQuest streak is unstoppable",
      description: "Daily brain training + compassion jackpots. I'm building mental resilience and funding world hunger relief simultaneously. Come join the mission.",
      hashtags: ["NeuroQuest", "NeuralStreak", "ElectricBlue", "MindAndSpirit"],
    },
  },
]

function PWAInstallSection() {
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [installed, setInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent))
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener("beforeinstallprompt", handler)
    window.addEventListener("appinstalled", () => setInstalled(true))
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === "accepted") setInstalled(true)
    setInstallPrompt(null)
  }

  return (
    <GlassCard>
      <GlassCardHeader>
        <GlassCardTitle className="flex items-center gap-2 text-base">
          <Download className="w-4 h-4 text-primary" />
          Add to Home Screen
        </GlassCardTitle>
      </GlassCardHeader>
      <GlassCardContent className="pt-0 space-y-4">
        <p className="text-sm text-muted-foreground">
          Install NeuroQuest as a native app — no app store needed. Plays like a mobile game, works offline.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
            <Smartphone className="w-5 h-5 text-primary" />
            <p className="text-xs font-semibold text-foreground">Mobile (iOS/Android)</p>
            {isIOS ? (
              <p className="text-[11px] text-white/45 leading-relaxed">
                Tap the <span className="text-primary font-bold">Share</span> icon in Safari, then <span className="text-primary font-bold">"Add to Home Screen"</span>
              </p>
            ) : (
              <p className="text-[11px] text-white/45 leading-relaxed">
                Tap the browser menu (<span className="text-primary font-bold">⋮</span>) and select <span className="text-primary font-bold">"Add to Home screen"</span>
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
            <Monitor className="w-5 h-5 text-primary" />
            <p className="text-xs font-semibold text-foreground">Desktop</p>
            <p className="text-[11px] text-white/45 leading-relaxed">
              Look for the install icon (<span className="text-primary font-bold">⊕</span>) in your browser's address bar
            </p>
          </div>
        </div>

        {installPrompt && !installed && (
          <LuxuryButton onClick={handleInstall} className="w-full gap-2">
            <Download className="w-4 h-4" />
            Install NeuroQuest App
          </LuxuryButton>
        )}

        {installed && (
          <div className="text-center py-3 rounded-xl bg-emerald-500/10 border border-emerald-400/25">
            <p className="text-sm font-bold text-emerald-300">✓ NeuroQuest installed!</p>
            <p className="text-xs text-emerald-300/60 mt-1">Find it on your home screen</p>
          </div>
        )}
      </GlassCardContent>
    </GlassCard>
  )
}

export default function SharePage() {
  const [, navigate] = useLocation()
  const [activeTab, setActiveTab] = useState("general")

  const currentConfig = SHARE_CONFIGS.find(c => c.id === activeTab) ?? SHARE_CONFIGS[0]
  const shareConfig = {
    ...currentConfig.config,
    url: typeof window !== "undefined" ? window.location.origin + BASE : "",
  }

  return (
    <div className="min-h-screen relative overflow-hidden pb-4">
      <div
        className="absolute inset-0 z-0 opacity-40 mix-blend-overlay pointer-events-none bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/zen-bg.png)` }}
      />

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 pt-10">
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to Dashboard</span>
        </motion.button>

        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-2">
            <Share2 className="w-7 h-7 text-primary" />
            <h1 className="text-3xl font-serif font-bold text-gradient-gold">Share NeuroQuest</h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Every share spreads the Compassion Jackpot to a new mind.
            Choose your platform — your link is ready.
          </p>
        </motion.div>

        {/* Message preset tabs */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
          <GlassCard>
            <GlassCardHeader>
              <GlassCardTitle className="text-sm text-muted-foreground font-medium uppercase tracking-widest">
                Choose Your Message
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent className="pt-0">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {SHARE_CONFIGS.map(cfg => {
                  const Icon = cfg.icon
                  const isActive = activeTab === cfg.id
                  return (
                    <button
                      key={cfg.id}
                      onClick={() => setActiveTab(cfg.id)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-xs font-semibold transition-all",
                        isActive
                          ? "bg-primary/15 border-primary/40 text-primary"
                          : "bg-white/3 border-white/10 text-white/50 hover:bg-white/8 hover:text-white/70"
                      )}
                    >
                      <Icon className={cn("w-4 h-4", isActive ? cfg.color : "")} />
                      {cfg.label}
                    </button>
                  )
                })}
              </div>

              {/* Preview of message */}
              <div className="rounded-xl bg-black/20 border border-white/8 px-4 py-3 mb-4">
                <p className="text-xs font-bold text-primary mb-1 uppercase tracking-widest">{currentConfig.config.title}</p>
                <p className="text-xs text-white/55 leading-relaxed">{currentConfig.config.description}</p>
                <p className="text-[11px] text-white/30 mt-2">
                  {currentConfig.config.hashtags.map(h => `#${h}`).join("  ")}
                </p>
              </div>

              <SocialSharePanel config={shareConfig} />
            </GlassCardContent>
          </GlassCard>
        </motion.div>

        {/* PWA Install */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-6">
          <PWAInstallSection />
        </motion.div>

        {/* Referral CTA */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mb-6">
          <GlassCard>
            <GlassCardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-rose-400/15 rounded-xl border border-rose-400/25 shrink-0">
                  <Heart className="w-5 h-5 text-rose-400 fill-rose-400/50" />
                </div>
                <div>
                  <h3 className="font-serif font-semibold text-base mb-1">Every Share Funds a Life</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Every new player you bring to NeuroQuest adds another spin to the Compassion Jackpot pool.
                    More players = more micro-donations = more meals funded worldwide.
                  </p>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>
        </motion.div>
      </div>

      <CopyrightFooter />
    </div>
  )
}
