import React, { useState } from "react"
import { Link } from "wouter"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft, Copy, Check, Crown, Bitcoin, CreditCard, Sparkles, Loader2
} from "lucide-react"
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card"
import { useToast } from "@/hooks/use-toast"
import { UserAuthButton } from "@/components/user-auth-button"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")
const BTC_ADDRESS = "bc1q8q0nguhkdl8t7searxdfuaew8x64afa772l0ns"
const ZEN_PRO_PRICE = "$9.99"
const ZEN_PRO_AMOUNT_BTC_APPROX = "≈ 0.000095 BTC"

function ApplePayIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  )
}

async function startProCheckout(): Promise<string | null> {
  try {
    const r = await fetch(`${BASE}/api/stripe/zen-pro-price`, { credentials: "include" })
    const d = await r.json()
    if (!d.configured || !d.priceId) return null
    const r2 = await fetch(`${BASE}/api/stripe/checkout`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId: d.priceId }),
    })
    const d2 = await r2.json()
    return d2.url ?? null
  } catch { return null }
}

type Tab = "apple" | "bitcoin" | "card"

export default function PaymentPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>("apple")
  const [copiedBtc, setCopiedBtc] = useState(false)
  const [appleLoading, setAppleLoading] = useState(false)
  const [cardLoading, setCardLoading] = useState(false)

  const copyBtc = async () => {
    await navigator.clipboard.writeText(BTC_ADDRESS)
    setCopiedBtc(true)
    toast({ title: "Bitcoin address copied!", description: "Send exactly " + ZEN_PRO_AMOUNT_BTC_APPROX + " for Zen Pro." })
    setTimeout(() => setCopiedBtc(false), 3000)
  }

  const handleApplePay = async () => {
    setAppleLoading(true)
    const url = await startProCheckout()
    if (url) window.location.href = url
    else { toast({ title: "Checkout unavailable", description: "Please try Card payment instead.", variant: "destructive" }); setAppleLoading(false) }
  }

  const handleCard = async () => {
    setCardLoading(true)
    const url = await startProCheckout()
    if (url) window.location.href = url
    else { toast({ title: "Checkout unavailable", description: "Please try again shortly.", variant: "destructive" }); setCardLoading(false) }
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "apple",   label: "Apple Pay", icon: <ApplePayIcon size={16} /> },
    { id: "bitcoin", label: "Bitcoin",   icon: <Bitcoin className="w-4 h-4" /> },
    { id: "card",    label: "Card",      icon: <CreditCard className="w-4 h-4" /> },
  ]

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-12 relative overflow-hidden pb-28">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px] rounded-full bg-amber-500/5 blur-[100px]" />
      </div>

      {/* Nav bar */}
      <div className="w-full max-w-lg mb-10 flex items-center justify-between">
        <Link href="/subscribe">
          <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </Link>
        <UserAuthButton />
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg text-center mb-8"
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-semibold uppercase tracking-wider mb-4">
          <Crown className="w-3.5 h-3.5" />
          Zen Pro — {ZEN_PRO_PRICE}/month
        </div>
        <h1 className="font-serif text-3xl font-bold text-gradient-gold mb-2">Choose Your Payment</h1>
        <p className="text-muted-foreground text-sm">
          Pay directly — instant access to all Zen Pro perks after sending.
        </p>
      </motion.div>

      {/* Tab selector */}
      <div className="w-full max-w-lg mb-6">
        <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/10">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all ${
                tab === t.id
                  ? "bg-primary text-background shadow-lg"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Panel */}
      <AnimatePresence mode="wait">
        {tab === "apple" && (
          <motion.div
            key="apple"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="w-full max-w-lg"
          >
            <GlassCard className="rounded-3xl border border-white/15">
              <GlassCardContent className="p-8 text-center space-y-6">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
                    <ApplePayIcon size={36} />
                  </div>
                  <div>
                    <p className="font-bold text-xl text-white">Apple Pay</p>
                    <p className="text-xs text-muted-foreground mt-1">Fast, secure, one-touch payment</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                  <p className="text-3xl font-serif font-bold text-foreground">{ZEN_PRO_PRICE}<span className="text-base text-muted-foreground font-normal">/mo</span></p>
                  <p className="text-xs text-muted-foreground mt-1">Zen Pro subscription · cancel any time</p>
                </div>

                <div className="p-3 rounded-xl bg-blue-500/8 border border-blue-400/20 text-left">
                  <p className="text-xs text-blue-300/80 leading-relaxed">
                    Apple Pay activates automatically on <strong className="text-blue-300">iPhone, iPad, or Mac with Safari</strong>. On other browsers, you'll pay by card instead — same price, same instant access.
                  </p>
                </div>

                <button
                  onClick={handleApplePay}
                  disabled={appleLoading}
                  className="flex items-center justify-center gap-2.5 w-full py-4 rounded-2xl bg-white text-black font-bold text-base hover:bg-white/90 active:scale-98 transition-all disabled:opacity-60"
                >
                  {appleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ApplePayIcon size={22} />}
                  {appleLoading ? "Redirecting…" : "Pay with Apple Pay"}
                </button>
              </GlassCardContent>
            </GlassCard>
          </motion.div>
        )}

        {tab === "bitcoin" && (
          <motion.div
            key="bitcoin"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="w-full max-w-lg"
          >
            <GlassCard className="rounded-3xl border border-orange-500/20">
              <GlassCardContent className="p-8 text-center space-y-6">
                {/* Bitcoin icon */}
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center">
                    <Bitcoin className="w-8 h-8 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Bitcoin (BTC)</p>
                    <p className="text-3xl font-serif font-bold text-foreground">{ZEN_PRO_PRICE}</p>
                    <p className="text-sm text-orange-400 mt-1">{ZEN_PRO_AMOUNT_BTC_APPROX} <span className="text-muted-foreground text-xs">(check live rate)</span></p>
                  </div>
                </div>

                {/* QR placeholder + address */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Wallet Address</p>
                  <div className="p-3 rounded-xl bg-black/40 border border-orange-500/20 font-mono text-xs text-orange-300 break-all leading-relaxed select-all">
                    {BTC_ADDRESS}
                  </div>
                  <button
                    onClick={copyBtc}
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-300 font-semibold text-sm hover:bg-orange-500/25 active:scale-98 transition-all"
                  >
                    {copiedBtc ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedBtc ? "Address Copied!" : "Copy Address"}
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 text-left">
                  <p className="text-xs text-amber-300/80 leading-relaxed">
                    <strong className="text-amber-300">After paying:</strong> DM or tweet{" "}
                    <a href="https://x.com/intent/tweet?text=Hey%20%40NeuroQuestApp%20I%20just%20paid%20for%20Zen%20Pro%20via%20Bitcoin!" target="_blank" rel="noopener noreferrer" className="underline">
                      @NeuroQuestApp
                    </a>{" "}
                    with your transaction ID and we'll activate Zen Pro within 24 hours.
                  </p>
                </div>
              </GlassCardContent>
            </GlassCard>
          </motion.div>
        )}

        {tab === "card" && (
          <motion.div
            key="card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="w-full max-w-lg"
          >
            <GlassCard className="rounded-3xl border border-violet-500/20">
              <GlassCardContent className="p-8 text-center space-y-6">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
                    <CreditCard className="w-8 h-8 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Credit / Debit Card</p>
                    <p className="text-3xl font-serif font-bold text-foreground">{ZEN_PRO_PRICE}<span className="text-base text-muted-foreground font-normal">/mo</span></p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-violet-500/8 border border-violet-500/20 text-center space-y-2">
                  <Sparkles className="w-5 h-5 text-violet-400 mx-auto" />
                  <p className="text-sm text-violet-300 font-medium">Automatic Recurring Billing</p>
                  <p className="text-xs text-muted-foreground">Powered by Stripe — cancel any time from your billing portal.</p>
                </div>

                <button
                  onClick={handleCard}
                  disabled={cardLoading}
                  className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-violet-500 text-white font-bold text-base hover:bg-violet-600 active:scale-98 transition-all disabled:opacity-60"
                >
                  {cardLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                  {cardLoading ? "Redirecting…" : "Pay by Card"}
                </button>

                <p className="text-xs text-muted-foreground">Stripe handles all card details securely. We never see your card number.</p>
              </GlassCardContent>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Perks reminder */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="w-full max-w-lg mt-8"
      >
        <GlassCard className="rounded-3xl border border-primary/10">
          <GlassCardContent className="p-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4 text-center">What you unlock with Zen Pro</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                "Unlimited Neuroplasticity Games",
                "2× Neural Energy Generation",
                "Exclusive Gold Slot Skins",
                "\"Luminary\" Title Boost",
                "Priority Early Access",
              ].map((perk) => (
                <div key={perk} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                  {perk}
                </div>
              ))}
            </div>
          </GlassCardContent>
        </GlassCard>
      </motion.div>
    </div>
  )
}
