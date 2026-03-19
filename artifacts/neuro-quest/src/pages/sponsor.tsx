import React, { useRef, useState } from "react"
import { Link } from "wouter"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft, Gift, Target, BarChart3, Zap, Eye, Shield,
  Sparkles, Crown, CheckCircle2, ChevronRight, Send, Star,
  Loader2, Megaphone, TrendingUp, Users, DollarSign
} from "lucide-react"
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { LuxuryButton } from "@/components/ui/luxury-button"
import { useToast } from "@/hooks/use-toast"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

const SPONSOR_TIERS = [
  {
    id: "starter",
    name: "Starter",
    price: "$500",
    period: "/month",
    prize_budget: "Up to $1,000 in charity donations/mo",
    desc: "Test the channel with a curated donation pool and banner placement.",
    color: "border-cyan-400/35",
    accent: "text-cyan-400",
    badge: null,
    perks: [
      "50 sponsored jackpot triggers per month",
      "Jackpot banner in The Casino",
      "Brand name + logo in win overlay",
      "Monthly impressions report",
      "Email support",
    ],
  },
  {
    id: "featured",
    name: "Featured",
    price: "$2,500",
    period: "/month",
    prize_budget: "Up to $5,000 in charity donations/mo",
    desc: "Exclusive branded jackpot symbol and priority placement across all sessions.",
    color: "border-cyan-400/55",
    accent: "text-cyan-300",
    badge: "Most Popular",
    perks: [
      "250 sponsored jackpot triggers per month",
      "Exclusive Sponsored Jackpot symbol on the reels",
      "Full branded win overlay & animations",
      "Priority banner placement",
      "Weekly analytics dashboard",
      "Dedicated sponsor account manager",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: "$10,000",
    period: "/month",
    prize_budget: "Unlimited donation pool",
    desc: "Full Casino experience takeover — custom skin, symbol, and real-time dashboard.",
    color: "border-fuchsia-400/40",
    accent: "text-fuchsia-300",
    badge: "Max Impact",
    perks: [
      "Unlimited sponsored jackpot triggers",
      "Full Casino UI skin & colour takeover",
      "Custom reel symbol (your brand icon)",
      "Real-time winner dashboard",
      "Co-branded press release on launch",
      "Quarterly strategy review",
      "Priority 24/7 support + SLA",
    ],
  },
]

const STATS = [
  { value: "94%", label: "brand recall vs 23% for banner ads", icon: <Eye className="w-5 h-5" /> },
  { value: "12 min", label: "average Casino session length", icon: <Target className="w-5 h-5" /> },
  { value: "0", label: "ad-blockers — native in-game placement", icon: <Shield className="w-5 h-5" /> },
  { value: "3.2×", label: "average ROI vs CPM advertising", icon: <TrendingUp className="w-5 h-5" /> },
]

const HOW_IT_WORKS = [
  {
    step: "01",
    icon: <Gift className="w-6 h-6" />,
    title: "Fund the Compassion Jackpot",
    desc: "Commit a monthly micro-donation budget. When players hit 3× Hearts, your brand pays for a micro-donation made in the player's name — no fulfilment overhead.",
  },
  {
    step: "02",
    icon: <Sparkles className="w-6 h-6" />,
    title: "Player Wins, Brand Shines",
    desc: "The winning screen reads \"A micro-donation has been made in your name\" followed by a full-screen \"Sponsored by {Your Brand}\" attribution. Heartfelt, unskippable, zero ad-blockers.",
  },
  {
    step: "03",
    icon: <BarChart3 className="w-6 h-6" />,
    title: "Measure Brand Impact",
    desc: "Track jackpot impressions, donation count, banner clicks, and brand recall in your live sponsor dashboard. You pay per Compassion Jackpot won — pure performance marketing.",
  },
]

const BUDGETS = [
  "Under $1,000/month",
  "$1,000–$5,000/month",
  "$5,000–$10,000/month",
  "$10,000–$25,000/month",
  "$25,000+/month",
]

export default function Sponsor() {
  const { toast } = useToast()
  const formRef = useRef<HTMLDivElement>(null)
  const [selectedTier, setSelectedTier] = useState<string>("featured")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const [form, setForm] = useState({
    brand_name: "",
    contact_name: "",
    work_email: "",
    prize_idea: "",
    monthly_budget: "",
  })

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.brand_name || !form.contact_name || !form.work_email || !form.monthly_budget) {
      toast({ title: "Please fill in all required fields.", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`${BASE}/api/sponsor/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...form, tier: selectedTier }),
      })
      if (!res.ok) throw new Error("Failed")
      setSubmitted(true)
    } catch {
      toast({ title: "Something went wrong.", description: "Please try again or email us directly.", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden pb-20">
      <div
        className="absolute inset-0 z-0 opacity-30 mix-blend-overlay pointer-events-none bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/zen-bg.png)` }}
      />
      {/* Cyan glow sphere */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-cyan-400/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-fuchsia-400/5 blur-[100px] pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 space-y-20">

        {/* Back */}
        <div>
          <Link href="/">
            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-cyan-400 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </button>
          </Link>
        </div>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="text-center space-y-6 max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-400/10 border border-cyan-400/30 text-cyan-300 text-sm font-medium">
            <Megaphone className="w-4 h-4" />
            Brand Partnerships — Tier 3
          </div>
          <h1 className="font-serif text-5xl md:text-6xl leading-tight">
            <span className="text-gradient-gold">Make Your Brand</span>
            <br />
            <span className="text-foreground">the Jackpot</span>
          </h1>
          <p className="text-muted-foreground text-xl leading-relaxed">
            Sponsor the <strong className="text-rose-300 font-semibold">Compassion Jackpot</strong>.
            When a player hits 3× Hearts, your brand funds the micro-donation — and earns a
            heartfelt "Sponsored by {"{"}your brand{"}"}" shoutout on the winning screen.
            Zero banner blindness. No ad-blockers. Pure goodwill.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            <LuxuryButton
              className="text-base px-8 py-5 bg-cyan-500/20 border-cyan-400/50 hover:bg-cyan-500/30 text-cyan-100"
              onClick={scrollToForm}
            >
              <Send className="w-4 h-4 mr-2" />
              Become a Sponsor
            </LuxuryButton>
            <LuxuryButton variant="outline" className="text-base px-8 py-5" onClick={scrollToForm}>
              View Packages
              <ChevronRight className="w-4 h-4 ml-1" />
            </LuxuryButton>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.07 }}
            >
              <GlassCard className="h-full text-center">
                <GlassCardContent className="p-5 space-y-2">
                  <div className="flex justify-center text-cyan-400">{stat.icon}</div>
                  <p className="font-serif text-3xl font-bold text-gradient-gold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground leading-snug">{stat.label}</p>
                </GlassCardContent>
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12 }}
          className="space-y-8"
        >
          <h2 className="font-serif text-3xl text-center text-foreground">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {HOW_IT_WORKS.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.08 }}
              >
                <GlassCard className="h-full border-cyan-400/20 hover:border-cyan-400/40 transition-colors">
                  <GlassCardContent className="p-7 space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="font-serif text-4xl font-bold text-cyan-400/40">{step.step}</span>
                      <div className="text-cyan-400">{step.icon}</div>
                    </div>
                    <h3 className="font-serif text-xl text-foreground">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                  </GlassCardContent>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Pricing tiers */}
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="font-serif text-3xl text-foreground">Sponsorship Packages</h2>
            <p className="text-muted-foreground">
              All packages include brand placement, winner fulfilment, and performance reporting.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SPONSOR_TIERS.map((tier, i) => (
              <motion.div
                key={tier.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className="relative"
              >
                {tier.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <span className={`px-3 py-1 text-xs font-bold rounded-full ${tier.id === "premium" ? "bg-fuchsia-400 text-background" : "bg-cyan-400 text-background"}`}>
                      {tier.badge}
                    </span>
                  </div>
                )}
                <GlassCard
                  className={`h-full cursor-pointer border transition-all duration-300 ${tier.color} ${selectedTier === tier.id ? "ring-2 ring-offset-0 ring-cyan-400/20" : "hover:opacity-90"}`}
                  onClick={() => { setSelectedTier(tier.id); scrollToForm() }}
                >
                  <GlassCardContent className="p-7 flex flex-col h-full gap-5">
                    <div>
                      <div className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest ${tier.accent} mb-3`}>
                        <Gift className="w-3.5 h-3.5" />
                        {tier.prize_budget}
                      </div>
                      <h3 className="font-serif text-2xl text-foreground">{tier.name}</h3>
                      <p className="text-muted-foreground text-sm mt-1 leading-snug">{tier.desc}</p>
                    </div>
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className={`font-serif text-4xl font-bold ${tier.accent}`}>{tier.price}</span>
                        <span className="text-muted-foreground text-sm">{tier.period}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">+ your donation budget · cancel anytime</p>
                    </div>
                    <ul className="space-y-2.5 flex-1">
                      {tier.perks.map((perk) => (
                        <li key={perk} className="flex items-start gap-2.5 text-sm text-foreground/80">
                          <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${tier.accent}`} />
                          {perk}
                        </li>
                      ))}
                    </ul>
                    <LuxuryButton
                      variant={tier.id === "featured" ? "default" : "outline"}
                      className={`w-full mt-2 ${tier.id === "featured" ? "bg-cyan-500/20 border-cyan-400/50 hover:bg-cyan-500/30 text-cyan-100" : ""}`}
                      onClick={(e) => { e.stopPropagation(); setSelectedTier(tier.id); scrollToForm() }}
                    >
                      Get Started
                    </LuxuryButton>
                  </GlassCardContent>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>

        {/* What brands say (social proof placeholder) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <GlassCard className="border-cyan-400/25 bg-cyan-400/5">
            <GlassCardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                {[
                  { icon: <Users className="w-6 h-6" />, label: "Active Casino Players / Month", value: "18,400+" },
                  { icon: <DollarSign className="w-6 h-6" />, label: "Avg Charity Donation Per Jackpot Win", value: "$34" },
                  { icon: <Star className="w-6 h-6 fill-current" />, label: "Sponsor Satisfaction Score", value: "4.9 / 5" },
                ].map(({ icon, label, value }) => (
                  <div key={label} className="space-y-2">
                    <div className="flex justify-center text-cyan-400">{icon}</div>
                    <p className="font-serif text-3xl font-bold text-cyan-300">{value}</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest">{label}</p>
                  </div>
                ))}
              </div>
            </GlassCardContent>
          </GlassCard>
        </motion.div>

        {/* Lead form */}
        <div ref={formRef} className="scroll-mt-8 max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            {submitted ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-center space-y-6 py-16"
              >
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-cyan-500/15 border border-cyan-500/30">
                  <CheckCircle2 className="w-10 h-10 text-cyan-400" />
                </div>
                <div>
                  <h3 className="font-serif text-3xl text-foreground mb-2">Sponsorship Inquiry Received</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Our partnerships team will reach out within one business day to design
                    your custom sponsorship package and launch timeline.
                  </p>
                </div>
                <Link href="/">
                  <LuxuryButton variant="outline">Return to Dashboard</LuxuryButton>
                </Link>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <GlassCard className="border-cyan-400/30">
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
                  <GlassCardHeader className="px-8 pt-8 pb-0">
                    <GlassCardTitle className="font-serif text-2xl">
                      Become a Sponsor
                    </GlassCardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Selected package: <span className="text-cyan-400 font-semibold capitalize">{selectedTier}</span> — fill in your details and we'll build your prize campaign.
                    </p>
                  </GlassCardHeader>

                  <GlassCardContent className="px-8 pb-8 pt-6">
                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Brand Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="MindFuel Coffee Co."
                            value={form.brand_name}
                            onChange={e => setForm(f => ({ ...f, brand_name: e.target.value }))}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/30 text-foreground placeholder:text-muted-foreground/50 text-sm transition-colors"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="Alex Rivera"
                            value={form.contact_name}
                            onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/30 text-foreground placeholder:text-muted-foreground/50 text-sm transition-colors"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Work Email *</label>
                        <input
                          type="email"
                          required
                          placeholder="alex@mindfuelcoffee.com"
                          value={form.work_email}
                          onChange={e => setForm(f => ({ ...f, work_email: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/30 text-foreground placeholder:text-muted-foreground/50 text-sm transition-colors"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prize Idea (optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. $50 gift card, free product sample, discount code…"
                          value={form.prize_idea}
                          onChange={e => setForm(f => ({ ...f, prize_idea: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/30 text-foreground placeholder:text-muted-foreground/50 text-sm transition-colors"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Monthly Budget *</label>
                        <select
                          required
                          value={form.monthly_budget}
                          onChange={e => setForm(f => ({ ...f, monthly_budget: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/30 text-foreground text-sm transition-colors appearance-none"
                        >
                          <option value="" disabled className="bg-background">Select budget range…</option>
                          {BUDGETS.map(b => (
                            <option key={b} value={b} className="bg-background">{b}</option>
                          ))}
                        </select>
                      </div>

                      <LuxuryButton
                        type="submit"
                        className="w-full py-4 text-base bg-cyan-500/20 border-cyan-400/50 hover:bg-cyan-500/30 text-cyan-100"
                        disabled={submitting}
                      >
                        {submitting ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</>
                        ) : (
                          <><Send className="w-4 h-4 mr-2" /> Submit Sponsorship Inquiry</>
                        )}
                      </LuxuryButton>

                      <p className="text-center text-xs text-muted-foreground">
                        Our partnerships team responds within 1 business day.
                      </p>
                    </form>
                  </GlassCardContent>
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  )
}
