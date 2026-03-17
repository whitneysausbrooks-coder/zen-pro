import React, { useEffect, useState } from "react"
import { useLocation, Link } from "wouter"
import { motion, AnimatePresence } from "framer-motion"
import {
  Crown, Zap, Dices, Infinity, Star, CheckCircle2,
  ArrowLeft, Sparkles, TrendingUp, Users, Shield, Loader2,
  Smartphone, Bitcoin, CreditCard
} from "lucide-react"
import { UserAuthButton } from "@/components/user-auth-button"
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card"
import { LuxuryButton } from "@/components/ui/luxury-button"
import { useToast } from "@/hooks/use-toast"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

async function fetchProStatus(): Promise<{ is_pro: boolean }> {
  const r = await fetch(`${BASE}/api/stripe/status`, { credentials: "include" })
  return r.json()
}

async function fetchZenProPrice(): Promise<{ priceId: string | null; amount: number; currency: string; interval: string; configured: boolean }> {
  const r = await fetch(`${BASE}/api/stripe/zen-pro-price`, { credentials: "include" })
  return r.json()
}

async function startCheckout(priceId: string): Promise<{ url?: string; error?: string }> {
  const r = await fetch(`${BASE}/api/stripe/checkout`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ priceId }),
  })
  return r.json()
}

async function openPortal(): Promise<{ url?: string; error?: string }> {
  const r = await fetch(`${BASE}/api/stripe/portal`, {
    method: "POST",
    credentials: "include",
  })
  return r.json()
}

const PERKS = [
  {
    icon: <Infinity className="w-5 h-5" />,
    label: "Unlimited Neuroplasticity Games",
    sub: "Every advanced game, forever unlocked",
    color: "text-primary",
    bg: "bg-primary/15 border-primary/30",
  },
  {
    icon: <Zap className="w-5 h-5" />,
    label: "2× Neural Energy Generation",
    sub: "Double the gains from every action",
    color: "text-amber-400",
    bg: "bg-amber-400/10 border-amber-400/25",
  },
  {
    icon: <Dices className="w-5 h-5" />,
    label: "Exclusive Gold Slot Skins",
    sub: "The casino floor in pure 24-karat style",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10 border-yellow-400/25",
  },
  {
    icon: <Crown className="w-5 h-5" />,
    label: "\"Luminary\" Title Boost",
    sub: "Skip ahead in the prestige ladder",
    color: "text-rose-400",
    bg: "bg-rose-400/10 border-rose-400/25",
  },
  {
    icon: <Star className="w-5 h-5" />,
    label: "Priority Early Access",
    sub: "First to every new game & feature",
    color: "text-violet-400",
    bg: "bg-violet-400/10 border-violet-400/25",
  },
]

const MRR_GOAL = 100_000
const MRR_CURRENT = 12_480
const MRR_PCT = Math.min((MRR_CURRENT / MRR_GOAL) * 100, 100)

export default function Subscribe() {
  const [, navigate] = useLocation()
  const { toast } = useToast()

  const [isPro, setIsPro] = useState(false)
  const [priceInfo, setPriceInfo] = useState<{ priceId: string | null; amount: number; interval: string; configured: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkingOut, setCheckingOut] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("success") === "1") setSuccess(true)

    Promise.all([fetchProStatus(), fetchZenProPrice()])
      .then(([status, price]) => {
        setIsPro(status.is_pro)
        setPriceInfo(price)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleActivate = async () => {
    if (!priceInfo?.configured) {
      toast({
        title: "Stripe not configured",
        description: "Add your STRIPE_SECRET_KEY secret to enable payments.",
        variant: "destructive",
      })
      return
    }
    if (!priceInfo.priceId) {
      toast({
        title: "Product not found",
        description: "Run the seed script to create the Zen Pro product in Stripe.",
        variant: "destructive",
      })
      return
    }

    setCheckingOut(true)
    try {
      const { url, error } = await startCheckout(priceInfo.priceId)
      if (error || !url) {
        toast({ title: "Checkout failed", description: error || "Unknown error", variant: "destructive" })
        setCheckingOut(false)
        return
      }
      window.location.href = url
    } catch (err: any) {
      toast({ title: "Checkout failed", description: err.message, variant: "destructive" })
      setCheckingOut(false)
    }
  }

  const handleManage = async () => {
    setCheckingOut(true)
    try {
      const { url, error } = await openPortal()
      if (error || !url) {
        toast({ title: "Portal failed", description: error || "Unknown error", variant: "destructive" })
        setCheckingOut(false)
        return
      }
      window.location.href = url
    } catch (err: any) {
      toast({ title: "Portal error", description: err.message, variant: "destructive" })
      setCheckingOut(false)
    }
  }

  const displayPrice = priceInfo ? `$${(priceInfo.amount / 100).toFixed(2)}` : "$9.99"
  const displayInterval = priceInfo?.interval ?? "month"

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-12 relative overflow-hidden">

      {/* Ambient glow orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-amber-500/5 blur-[100px]" />
      </div>

      {/* Back nav */}
      <div className="w-full max-w-2xl mb-10 flex items-center justify-between">
        <Link href="/">
          <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </Link>
        <UserAuthButton />
      </div>

      {/* Success banner */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-2xl mb-6"
          >
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-semibold">Welcome to Zen Pro.</p>
                <p className="text-sm opacity-80">Your consciousness upgrade is active.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-2xl space-y-6">

        {/* Hero header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 text-primary text-sm font-medium mb-2">
            <Crown className="w-4 h-4" />
            Zen Pro — Tier 1
          </div>
          <h1 className="font-serif text-5xl md:text-6xl text-gradient-gold leading-tight">
            Elevate Your<br />Mind & Spirit
          </h1>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto leading-relaxed">
            The premium layer of NeuroQuest. Infinite access, amplified power, and a casino floor dressed in gold.
          </p>
        </motion.div>

        {/* Pricing card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <GlassCard className="slot-machine-glow relative overflow-hidden">
            {/* Gold shimmer strip */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

            <GlassCardContent className="p-8 md:p-10">

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : isPro ? (
                /* ── Active state ── */
                <div className="text-center space-y-6">
                  <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-sm font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    Zen Pro — Active
                  </div>
                  <p className="text-muted-foreground">
                    You are running at full power. Every perk below is unlocked.
                  </p>
                  <LuxuryButton
                    variant="outline"
                    onClick={handleManage}
                    disabled={checkingOut}
                    className="w-full"
                  >
                    {checkingOut ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Manage Subscription
                  </LuxuryButton>
                </div>
              ) : (
                /* ── Pricing state ── */
                <div className="space-y-8">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="font-serif text-6xl font-bold text-gradient-gold">{displayPrice}</span>
                        <span className="text-muted-foreground text-lg">/{displayInterval}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">Cancel any time. No contracts.</p>
                    </div>
                    <div className="shrink-0 p-4 rounded-2xl bg-primary/10 border border-primary/25">
                      <Crown className="w-8 h-8 text-primary" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    {PERKS.map((perk, i) => (
                      <motion.div
                        key={perk.label}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + i * 0.06 }}
                        className={`flex items-start gap-3 p-3.5 rounded-xl border ${perk.bg}`}
                      >
                        <div className={`mt-0.5 shrink-0 ${perk.color}`}>{perk.icon}</div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{perk.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{perk.sub}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Direct payment options */}
                  <div className="space-y-3">
                    <p className="text-xs text-center text-muted-foreground uppercase tracking-wider">Choose how to pay</p>

                    <Link href="/payment">
                      <button className="flex items-center justify-between w-full px-5 py-4 rounded-2xl bg-[#00D64F]/10 border border-[#00D64F]/30 hover:bg-[#00D64F]/18 active:scale-98 transition-all group">
                        <div className="flex items-center gap-3">
                          <Smartphone className="w-5 h-5 text-[#00D64F]" />
                          <div className="text-left">
                            <p className="text-sm font-bold text-foreground">CashApp</p>
                            <p className="text-xs text-muted-foreground">$whitneyshauntaye · instant</p>
                          </div>
                        </div>
                        <span className="text-xs text-[#00D64F] font-semibold">$9.99 →</span>
                      </button>
                    </Link>

                    <Link href="/payment?tab=bitcoin">
                      <button className="flex items-center justify-between w-full px-5 py-4 rounded-2xl bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/18 active:scale-98 transition-all group">
                        <div className="flex items-center gap-3">
                          <Bitcoin className="w-5 h-5 text-orange-400" />
                          <div className="text-left">
                            <p className="text-sm font-bold text-foreground">Bitcoin</p>
                            <p className="text-xs text-muted-foreground">bc1q8q0…72l0ns · private</p>
                          </div>
                        </div>
                        <span className="text-xs text-orange-400 font-semibold">≈ 0.000095 BTC →</span>
                      </button>
                    </Link>

                    <LuxuryButton
                      className="w-full text-base py-4"
                      onClick={handleActivate}
                      disabled={checkingOut}
                    >
                      {checkingOut ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <CreditCard className="w-4 h-4 mr-2" />
                      )}
                      {checkingOut ? "Redirecting…" : "Pay by Card (Stripe)"}
                    </LuxuryButton>
                  </div>

                  <p className="text-center text-xs text-muted-foreground">
                    All payment methods accepted · Cancel any time
                    <Shield className="inline w-3 h-3 ml-1 opacity-50" />
                  </p>
                </div>
              )}
            </GlassCardContent>
          </GlassCard>
        </motion.div>

        {/* MRR progress — social proof */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          <GlassCard>
            <GlassCardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Revenue Progress
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="w-3.5 h-3.5" />
                  Goal: 10,000 minds · $100k MRR
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>${MRR_CURRENT.toLocaleString()} MRR</span>
                  <span>{MRR_PCT.toFixed(1)}% of goal</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${MRR_PCT}%` }}
                    transition={{ duration: 1.2, delay: 0.4, ease: "easeOut" }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center pt-1">
                  Every subscription accelerates the mission — training 10,000 minds toward neuroplasticity mastery.
                </p>
              </div>
            </GlassCardContent>
          </GlassCard>
        </motion.div>

      </div>
    </div>
  )
}
