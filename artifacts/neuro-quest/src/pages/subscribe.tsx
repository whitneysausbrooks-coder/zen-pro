import React, { useEffect, useState } from "react"
import { useLocation, Link } from "wouter"
import { motion, AnimatePresence } from "framer-motion"
import {
  Crown, Zap, Dices, Infinity, Star, CheckCircle2,
  ArrowLeft, Sparkles, TrendingUp, Users, Shield, Loader2,
  Bitcoin, CreditCard, Clock, Copy, Check, ExternalLink
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
    sub: "The wellness experience in pure 24-karat style",
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

const BITCOIN = "bc1q8q0nguhkdl8t7searxdfuaew8x64afa772l0ns"

function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }
  return (
    <button
      onClick={copy}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
        copied ? "bg-emerald-500/20 border border-emerald-400/40 text-emerald-300" : "bg-white/8 border border-white/12 text-white/60 hover:bg-white/14"
      }`}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied!" : label}
    </button>
  )
}

async function startDailyPassCheckout(): Promise<string | null> {
  try {
    const r = await fetch(`${BASE}/api/stripe/daily-pass-checkout`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours: 24 }),
    })
    const d = await r.json()
    return d.url ?? null
  } catch {
    return null
  }
}

function ApplePayIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  )
}

function DailyPassCard() {
  const [method, setMethod] = useState<"apple" | "bitcoin" | "card">("apple")
  const [cardLoading, setCardLoading] = useState(false)

  const handleCardCheckout = async () => {
    setCardLoading(true)
    const url = await startDailyPassCheckout()
    if (url) window.location.href = url
    else setCardLoading(false)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
      <GlassCard className="relative overflow-hidden border-amber-500/20">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
        <div className="p-6 sm:p-8">
          {/* Badge */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-400/12 border border-amber-400/30 text-amber-300 text-xs font-bold uppercase tracking-widest">
              <Clock className="w-3.5 h-3.5" />
              Daily Pass — 24 Hours
            </div>
            <div className="text-right">
              <span className="font-serif text-4xl font-bold text-gradient-gold">$5</span>
              <p className="text-[11px] text-white/30 mt-0.5">One-time · 24 hrs access</p>
            </div>
          </div>

          <p className="text-sm text-white/55 leading-relaxed mb-5">
            Try everything before committing. 24 hours of full, unlimited play across all 4 games, Compassion Impact™ milestones, and Neural Energy rewards.
          </p>

          {/* What's included */}
          <div className="grid grid-cols-2 gap-2 mb-5">
            {[
              { icon: "♡", text: "Compassion Impact™" },
              { icon: "🧠", text: "All 4 brain games" },
              { icon: "⚡", text: "Full Neural Energy" },
              { icon: "🌍", text: "Global impact tracking" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/3 border border-white/6 text-xs text-white/55">
                <span>{item.icon}</span>
                {item.text}
              </div>
            ))}
          </div>

          {/* Payment method toggle */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {([
              { id: "apple",   icon: <ApplePayIcon size={14} />, label: "Apple Pay", active: "bg-white/15 border-white/30 text-white" },
              { id: "bitcoin", icon: <Bitcoin className="w-3.5 h-3.5" />, label: "Bitcoin", active: "bg-amber-400/18 border-amber-400/40 text-amber-400" },
              { id: "card",    icon: <CreditCard className="w-3.5 h-3.5" />, label: "Card", active: "bg-violet-400/18 border-violet-400/40 text-violet-300" },
            ] as const).map((m) => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                  method === m.id ? m.active : "bg-white/3 border-white/8 text-white/40"
                }`}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>

          {method === "apple" && (
            <div className="rounded-xl bg-white/6 border border-white/15 p-4 space-y-3">
              <p className="text-xs text-white/50 leading-relaxed text-center">
                Apple Pay activates automatically on <strong className="text-white/80">iPhone, iPad or Mac in Safari</strong>. On other browsers you'll pay by card — same price, instant access.
              </p>
              <LuxuryButton onClick={handleCardCheckout} disabled={cardLoading} className="w-full gap-2 bg-white/10 border-white/25 hover:bg-white/18 text-white">
                {cardLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ApplePayIcon size={14} />}
                {cardLoading ? "Redirecting…" : "Pay $5 with Apple Pay"}
              </LuxuryButton>
            </div>
          )}

          {method === "bitcoin" && (
            <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 p-4 space-y-3">
              <p className="font-mono text-[11px] text-white/60 break-all">{BITCOIN}</p>
              <CopyField value={BITCOIN} label="Copy BTC address" />
            </div>
          )}

          {method === "card" && (
            <div className="rounded-xl bg-violet-500/10 border border-violet-500/25 p-4 space-y-3 text-center">
              <CreditCard className="w-6 h-6 text-violet-300 mx-auto" />
              <p className="text-sm text-white/70">Pay $5 instantly with any card — access granted automatically.</p>
              <LuxuryButton
                className="w-full gap-2"
                onClick={handleCardCheckout}
                disabled={cardLoading}
              >
                {cardLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                {cardLoading ? "Redirecting to Stripe…" : "Pay $5 with Card"}
              </LuxuryButton>
            </div>
          )}

          {method !== "card" && (
            <div className="mt-4 rounded-xl bg-white/4 border border-white/8 px-4 py-3">
              <p className="text-xs text-white/45 leading-relaxed">
                <span className="text-white/70 font-semibold">After paying:</span> DM{" "}
                <a href="https://x.com/whitneyshauntaye" target="_blank" rel="noopener noreferrer" className="text-primary underline font-semibold">
                  @whitneyshauntaye
                </a>{" "}
                on X with your payment screenshot + "Daily Pass" — activated within 1 hour.
              </p>
            </div>
          )}
        </div>
      </GlassCard>
    </motion.div>
  )
}

export default function Subscribe() {
  const [, navigate] = useLocation()
  const { toast } = useToast()

  const [isPro, setIsPro] = useState(false)
  const [priceInfo, setPriceInfo] = useState<{ priceId: string | null; amount: number; interval: string; configured: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkingOut, setCheckingOut] = useState(false)
  const [success, setSuccess] = useState(false)
  const [dailySuccess, setDailySuccess] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("success") === "1") setSuccess(true)
    if (params.get("daily_success") === "1") setDailySuccess(true)

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
        {dailySuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-2xl mb-6"
          >
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-semibold">Daily Pass Activated!</p>
                <p className="text-sm opacity-80">You have 24 hours of full access. Go play!</p>
              </div>
            </div>
          </motion.div>
        )}
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

        {/* Daily Pass card */}
        <DailyPassCard />

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/8" />
          <span className="text-xs text-white/25 font-semibold uppercase tracking-widest">Or go unlimited</span>
          <div className="flex-1 h-px bg-white/8" />
        </div>

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
            Elevate Your<br />Wellness Journey
          </h1>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto leading-relaxed">
            The premium layer of NeuroQuest. Infinite access, amplified power, and a wellness experience dressed in gold.
          </p>
        </motion.div>

        {/* Pricing card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <GlassCard className="accent-glow relative overflow-hidden">
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
                      <p className="text-sm text-muted-foreground mt-1">Auto-renews monthly · Cancel any time · No contracts.</p>
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

                    <Link href="/payment?tab=apple">
                      <button className="flex items-center justify-between w-full px-5 py-4 rounded-2xl bg-white/8 border border-white/20 hover:bg-white/12 active:scale-98 transition-all group">
                        <div className="flex items-center gap-3">
                          <ApplePayIcon size={20} />
                          <div className="text-left">
                            <p className="text-sm font-bold text-foreground">Apple Pay</p>
                            <p className="text-xs text-muted-foreground">iPhone, iPad, Mac · one-touch</p>
                          </div>
                        </div>
                        <span className="text-xs text-white/60 font-semibold">$9.99 →</span>
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

                  <div className="text-center space-y-1">
                    <p className="text-xs text-muted-foreground">
                      All payment methods accepted · Cancel any time
                      <Shield className="inline w-3 h-3 ml-1 opacity-50" />
                    </p>
                    <p className="text-[11px] text-white/25 leading-relaxed">
                      Zen Pro subscription auto-renews at $9.99/month until cancelled. Cancellation takes effect at the end of the current billing period. No refunds on partial periods.
                    </p>
                  </div>
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
