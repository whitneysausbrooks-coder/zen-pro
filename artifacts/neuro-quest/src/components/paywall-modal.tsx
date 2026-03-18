import React, { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Crown, Zap, Heart, Bitcoin, Smartphone, CreditCard, Copy, Check, Clock, Infinity, X, Shield, ExternalLink, Loader2, ChevronRight } from "lucide-react"
import { LuxuryButton } from "@/components/ui/luxury-button"
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card"
import { cn } from "@/lib/utils"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

const CASHAPP = "$whitneyshauntaye"
const BITCOIN = "bc1q8q0nguhkdl8t7searxdfuaew8x64afa772l0ns"
const X_HANDLE = "@whitneyshauntaye"

type Tier = "daily" | "pro"
type PayMethod = "cashapp" | "bitcoin" | "stripe"

interface AccessStatus {
  has_access: boolean
  access_type: "pro" | "daily_pass" | null
  daily_pass_expires: string | null
}

async function fetchAccessStatus(): Promise<AccessStatus> {
  const r = await fetch(`${BASE}/api/quest/access-status`, { credentials: "include" })
  if (!r.ok) return { has_access: false, access_type: null, daily_pass_expires: null }
  return r.json()
}

async function fetchStripeStatus(): Promise<{ configured: boolean; priceId: string | null }> {
  try {
    const r = await fetch(`${BASE}/api/stripe/zen-pro-price`, { credentials: "include" })
    if (!r.ok) return { configured: false, priceId: null }
    const d = await r.json()
    return { configured: d.configured, priceId: d.priceId }
  } catch {
    return { configured: false, priceId: null }
  }
}

async function startStripeCheckout(priceId: string): Promise<string | null> {
  try {
    const r = await fetch(`${BASE}/api/stripe/checkout`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId }),
    })
    const d = await r.json()
    return d.url ?? null
  } catch {
    return null
  }
}

async function startDailyPassCheckout(hours = 24): Promise<string | null> {
  try {
    const r = await fetch(`${BASE}/api/stripe/daily-pass-checkout`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours }),
    })
    const d = await r.json()
    return d.url ?? null
  } catch {
    return null
  }
}

/* ─── Countdown timer ──────────────────────────────────── */
function useCountdown(expiresAt: string | null) {
  const [remaining, setRemaining] = useState("")
  useEffect(() => {
    if (!expiresAt) return
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now()
      if (diff <= 0) { setRemaining("Expired"); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setRemaining(`${h}h ${m}m ${s}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])
  return remaining
}

/* ─── Copy button ─────────────────────────────────────── */
function CopyBtn({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }
  return (
    <button
      onClick={copy}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
        copied ? "bg-emerald-500/20 border border-emerald-400/40 text-emerald-300" : "bg-white/8 border border-white/12 text-white/60 hover:bg-white/12"
      )}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied!" : label}
    </button>
  )
}

/* ─── Payment method panel ────────────────────────────── */
interface PayPanelProps {
  tier: Tier
  method: PayMethod
  stripeConfigured: boolean
  stripePriceId: string | null
}

function PayPanel({ tier, method, stripeConfigured, stripePriceId }: PayPanelProps) {
  const price = tier === "daily" ? "$5" : "$9.99/mo"
  const label = tier === "daily" ? "Daily Pass" : "Zen Pro"
  const [stripeLoading, setStripeLoading] = useState(false)

  const handleStripe = async () => {
    setStripeLoading(true)
    if (tier === "daily") {
      const url = await startDailyPassCheckout(24)
      if (url) window.location.href = url
    } else {
      if (!stripePriceId) { setStripeLoading(false); return }
      const url = await startStripeCheckout(stripePriceId)
      if (url) window.location.href = url
    }
    setStripeLoading(false)
  }

  if (method === "cashapp") {
    return (
      <div className="space-y-3">
        <div className="rounded-xl bg-[#00D64F]/10 border border-[#00D64F]/25 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#00D64F]" />
              <span className="text-sm font-bold text-[#00D64F]">CashApp</span>
            </div>
            <span className="font-bold text-white text-lg">{price}</span>
          </div>
          <div className="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2">
            <span className="font-mono text-white font-bold">{CASHAPP}</span>
            <CopyBtn text={CASHAPP} label="Copy" />
          </div>
        </div>
        <div className="rounded-xl bg-amber-400/8 border border-amber-400/20 px-4 py-3">
          <p className="text-xs text-amber-200/80 leading-relaxed">
            <span className="font-bold text-amber-300">After sending:</span> DM{" "}
            <a href={`https://x.com/${X_HANDLE.slice(1)}`} target="_blank" rel="noopener noreferrer" className="text-amber-300 underline font-bold">
              {X_HANDLE}
            </a>{" "}
            on X with your payment screenshot + "{label}" and we'll activate you within 1 hour.
          </p>
        </div>
        <a
          href={`https://cash.app/${CASHAPP}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <LuxuryButton className="w-full gap-2">
            <ExternalLink className="w-4 h-4" />
            Open CashApp &rarr; {CASHAPP}
          </LuxuryButton>
        </a>
      </div>
    )
  }

  if (method === "bitcoin") {
    return (
      <div className="space-y-3">
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Bitcoin className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-bold text-amber-400">Bitcoin</span>
            </div>
            <span className="font-bold text-white text-lg">{price} USD</span>
          </div>
          <div className="bg-black/30 rounded-lg px-3 py-2 mb-2">
            <p className="font-mono text-[11px] text-white/70 break-all leading-relaxed">{BITCOIN}</p>
          </div>
          <CopyBtn text={BITCOIN} label="Copy BTC address" />
        </div>
        <div className="rounded-xl bg-amber-400/8 border border-amber-400/20 px-4 py-3">
          <p className="text-xs text-amber-200/80 leading-relaxed">
            <span className="font-bold text-amber-300">After sending:</span> DM{" "}
            <a href={`https://x.com/${X_HANDLE.slice(1)}`} target="_blank" rel="noopener noreferrer" className="text-amber-300 underline font-bold">
              {X_HANDLE}
            </a>{" "}
            on X with your transaction ID + "{label}" and we'll activate you within 1 hour.
          </p>
        </div>
      </div>
    )
  }

  if (method === "stripe") {
    const canPay = stripeConfigured && (tier === "daily" || !!stripePriceId)
    if (!canPay) {
      return (
        <div className="rounded-xl bg-white/4 border border-white/10 p-5 text-center">
          <CreditCard className="w-8 h-8 text-white/20 mx-auto mb-2" />
          <p className="text-sm text-white/40">Card payments coming soon.</p>
          <p className="text-xs text-white/25 mt-1">Use CashApp or Bitcoin to activate instantly.</p>
        </div>
      )
    }
    return (
      <div className="space-y-3">
        <div className="rounded-xl bg-violet-500/10 border border-violet-500/25 p-4 text-center">
          <CreditCard className="w-6 h-6 text-violet-300 mx-auto mb-2" />
          <p className="text-sm text-white/70">Pay securely with any card via Stripe</p>
          <p className="text-base font-bold text-white mt-1">{price}</p>
        </div>
        <LuxuryButton onClick={handleStripe} disabled={stripeLoading} className="w-full gap-2">
          {stripeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
          {stripeLoading ? "Redirecting…" : `Pay ${price} with Card`}
        </LuxuryButton>
      </div>
    )
  }

  return null
}

/* ─── Main gate component ─────────────────────────────── */
interface PaywallGateProps {
  children: React.ReactNode
  gameName?: string
}

export function PaywallGate({ children, gameName = "this game" }: PaywallGateProps) {
  const [status, setStatus] = useState<AccessStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [tier, setTier] = useState<Tier>("daily")
  const [method, setMethod] = useState<PayMethod>("cashapp")
  const [stripeInfo, setStripeInfo] = useState<{ configured: boolean; priceId: string | null }>({ configured: false, priceId: null })

  const countdown = useCountdown(status?.daily_pass_expires ?? null)

  const load = useCallback(async () => {
    setLoading(true)
    const [s, stripe] = await Promise.all([fetchAccessStatus(), fetchStripeStatus()])
    setStatus(s)
    setStripeInfo(stripe)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary"
          />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    )
  }

  if (status?.has_access) {
    return (
      <>
        {children}
        {/* Expiry reminder banner for daily pass */}
        {status.access_type === "daily_pass" && status.daily_pass_expires && (
          <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-amber-500/20 border border-amber-400/35 backdrop-blur-sm">
            <p className="text-xs font-semibold text-amber-300 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              Daily Pass expires in {countdown}
            </p>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        {/* Blurred game preview bg */}
        <div className="absolute inset-0 bg-[#0a1510] opacity-90" />
        <div className="absolute inset-0 bg-gradient-radial from-primary/6 via-transparent to-transparent" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="rounded-3xl border border-white/12 bg-[#0D1A10]/95 backdrop-blur-2xl shadow-2xl overflow-hidden">

          {/* Hero */}
          <div className="relative px-6 pt-8 pb-5 text-center bg-gradient-to-b from-primary/8 to-transparent">
            <motion.div
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 3.5, repeat: Infinity }}
              className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/15 border border-primary/30 mb-3"
            >
              <Crown className="w-7 h-7 text-primary" />
            </motion.div>
            <h2 className="font-serif text-2xl font-bold text-gradient-gold mb-1">Unlock Full Access</h2>
            <p className="text-sm text-white/50 leading-relaxed">
              Play all games, spin the Compassion Jackpot™, and fund lives worldwide.
            </p>
          </div>

          <div className="px-6 pb-6 space-y-5">

            {/* Tier toggle */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-black/30 border border-white/8">
              {([
                { id: "daily", icon: Clock, label: "Daily Pass", price: "$5", sub: "24 hrs of full play" },
                { id: "pro", icon: Infinity, label: "Zen Pro", price: "$9.99", sub: "Per month, cancel any time" },
              ] as const).map(({ id, icon: Icon, label, price, sub }) => (
                <button
                  key={id}
                  onClick={() => setTier(id)}
                  className={cn(
                    "relative flex flex-col items-center gap-1 px-3 py-3 rounded-xl transition-all",
                    tier === id
                      ? "bg-primary/20 border border-primary/40 text-primary"
                      : "text-white/40 hover:text-white/60"
                  )}
                >
                  {id === "pro" && (
                    <span className="absolute -top-2 right-2 text-[9px] font-bold bg-primary text-[#1B3022] px-1.5 py-0.5 rounded-full">BEST VALUE</span>
                  )}
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-bold">{label}</span>
                  <span className="text-lg font-serif font-bold text-white">{price}</span>
                  <span className="text-[10px] opacity-60 leading-tight text-center">{sub}</span>
                </button>
              ))}
            </div>

            {/* What's included */}
            <div className="space-y-1.5">
              {[
                { icon: "🧠", text: "All 4 neuroplasticity games unlocked" },
                { icon: "♡", text: "Compassion Jackpot™ spins — fund real hunger relief" },
                { icon: "⚡", text: tier === "pro" ? "2× Neural Energy (Pro exclusive)" : "Full Neural Energy rewards" },
                { icon: "🌍", text: "Every session tracked in Global Impact Chronicle" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/3 border border-white/6">
                  <span className="shrink-0 text-sm">{item.icon}</span>
                  <span className="text-xs text-white/60">{item.text}</span>
                </div>
              ))}
            </div>

            {/* Payment method tabs */}
            <div>
              <p className="text-xs text-white/35 uppercase tracking-widest font-semibold mb-2">Pay with</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: "cashapp", icon: Smartphone, label: "CashApp", color: "text-[#00D64F]", bg: "bg-[#00D64F]/15" },
                  { id: "bitcoin", icon: Bitcoin, label: "Bitcoin", color: "text-amber-400", bg: "bg-amber-400/15" },
                  { id: "stripe", icon: CreditCard, label: "Card", color: "text-violet-300", bg: "bg-violet-300/15" },
                ] as const).map(({ id, icon: Icon, label, color, bg }) => (
                  <button
                    key={id}
                    onClick={() => setMethod(id)}
                    className={cn(
                      "flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-semibold transition-all",
                      method === id
                        ? `${bg} border-white/25 ${color}`
                        : "bg-white/3 border-white/8 text-white/35 hover:text-white/55"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment details */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${tier}-${method}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <PayPanel
                  tier={tier}
                  method={method}
                  stripeConfigured={stripeInfo.configured}
                  stripePriceId={stripeInfo.priceId}
                />
              </motion.div>
            </AnimatePresence>

            {/* Legal */}
            <div className="flex items-start gap-2 text-[10px] text-white/25">
              <Shield className="w-3 h-3 shrink-0 mt-0.5" />
              <span>
                Payments are manual-activation (CashApp/BTC) or via Stripe. Daily Pass = 24 hours. Zen Pro auto-renews monthly.
                Contact {X_HANDLE} to cancel. No refunds on daily passes once activated.
                © {new Date().getFullYear()} NeuroQuest™ by Whitney Shauntaye.
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
