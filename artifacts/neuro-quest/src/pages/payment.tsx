import React, { useState } from "react"
import { Link } from "wouter"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft, Copy, Check, Crown, ExternalLink, Smartphone, Bitcoin, CreditCard, Sparkles
} from "lucide-react"
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card"
import { useToast } from "@/hooks/use-toast"
import { UserAuthButton } from "@/components/user-auth-button"

const CASHAPP_TAG = "$whitneyshauntaye"
const CASHAPP_URL = "https://cash.app/$whitneyshauntaye"
const BTC_ADDRESS = "bc1q8q0nguhkdl8t7searxdfuaew8x64afa772l0ns"
const ZEN_PRO_PRICE = "$9.99"
const ZEN_PRO_AMOUNT_BTC_APPROX = "≈ 0.000095 BTC"

type Tab = "cashapp" | "bitcoin" | "card"

export default function PaymentPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>("cashapp")
  const [copiedBtc, setCopiedBtc] = useState(false)
  const [copiedTag, setCopiedTag] = useState(false)

  const copyBtc = async () => {
    await navigator.clipboard.writeText(BTC_ADDRESS)
    setCopiedBtc(true)
    toast({ title: "Bitcoin address copied!", description: "Send exactly " + ZEN_PRO_AMOUNT_BTC_APPROX + " for Zen Pro." })
    setTimeout(() => setCopiedBtc(false), 3000)
  }

  const copyTag = async () => {
    await navigator.clipboard.writeText(CASHAPP_TAG)
    setCopiedTag(true)
    toast({ title: "CashApp tag copied!", description: "Send $9.99 to " + CASHAPP_TAG })
    setTimeout(() => setCopiedTag(false), 3000)
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "cashapp", label: "CashApp", icon: <Smartphone className="w-4 h-4" /> },
    { id: "bitcoin", label: "Bitcoin", icon: <Bitcoin className="w-4 h-4" /> },
    { id: "card",    label: "Card / Stripe", icon: <CreditCard className="w-4 h-4" /> },
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
        {tab === "cashapp" && (
          <motion.div
            key="cashapp"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="w-full max-w-lg"
          >
            <GlassCard className="rounded-3xl border border-emerald-500/20">
              <GlassCardContent className="p-8 text-center space-y-6">
                {/* CashApp logo block */}
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-[#00D64F]/15 border border-[#00D64F]/30 flex items-center justify-center">
                    <Smartphone className="w-8 h-8 text-[#00D64F]" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Send to</p>
                    <p className="font-mono text-2xl font-bold text-[#00D64F]">{CASHAPP_TAG}</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                  <p className="text-3xl font-serif font-bold text-foreground">{ZEN_PRO_PRICE}</p>
                  <p className="text-xs text-muted-foreground mt-1">per month · Zen Pro subscription</p>
                </div>

                <div className="space-y-3">
                  <a
                    href={CASHAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-[#00D64F] text-black font-bold text-base hover:bg-[#00D64F]/90 active:scale-98 transition-all"
                  >
                    <ExternalLink className="w-5 h-5" />
                    Open CashApp & Pay
                  </a>
                  <button
                    onClick={copyTag}
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-sm text-muted-foreground hover:bg-white/10 transition-all"
                  >
                    {copiedTag ? <Check className="w-4 h-4 text-[#00D64F]" /> : <Copy className="w-4 h-4" />}
                    {copiedTag ? "Copied!" : "Copy $cashtag"}
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 text-left">
                  <p className="text-xs text-amber-300/80 leading-relaxed">
                    <strong className="text-amber-300">After paying:</strong> Message us on X{" "}
                    <a href="https://x.com/intent/tweet?text=Hey%20%40NeuroQuestApp%20I%20just%20paid%20for%20Zen%20Pro%20via%20CashApp!" target="_blank" rel="noopener noreferrer" className="underline">
                      @NeuroQuestApp
                    </a>{" "}
                    with your payment confirmation and we'll activate Zen Pro within 24 hours.
                  </p>
                </div>
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

                <Link href="/subscribe">
                  <button className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-violet-500 text-white font-bold text-base hover:bg-violet-600 active:scale-98 transition-all">
                    <CreditCard className="w-5 h-5" />
                    Pay by Card
                  </button>
                </Link>

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
