import React, { useRef, useState } from "react"
import { Link } from "wouter"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft, Building2, Users, BarChart3, Shield,
  Layers, Headphones, Globe, CheckCircle2, ChevronRight,
  Loader2, Sparkles, Brain, Zap, Star, Send
} from "lucide-react"
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { LuxuryButton } from "@/components/ui/luxury-button"
import { useToast } from "@/hooks/use-toast"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

type Tier = "team" | "business" | "enterprise"

const TIERS = [
  {
    id: "team" as Tier,
    name: "Team",
    price: "$299",
    period: "/month",
    seats: "Up to 25 seats",
    desc: "Ideal for small teams and departments piloting cognitive wellness.",
    color: "border-primary/40",
    accent: "text-primary",
    bg: "bg-primary/8",
    badge: null,
    perks: [
      "Full NeuroQuest game suite for every seat",
      "Team Neural Energy leaderboard",
      "Monthly progress report (PDF)",
      "Slack / Teams activity digest",
      "Email support",
    ],
  },
  {
    id: "business" as Tier,
    name: "Business",
    price: "$799",
    period: "/month",
    seats: "Up to 100 seats",
    desc: "Built for scaling teams that take cognitive performance seriously.",
    color: "border-amber-400/50 slot-machine-glow",
    accent: "text-amber-400",
    bg: "bg-amber-400/8",
    badge: "Most Popular",
    perks: [
      "Everything in Team",
      "Real-time wellness analytics dashboard",
      "Department-level segmentation",
      "Custom company branding in-app",
      "Priority email + chat support",
      "Quarterly executive wellness review",
    ],
  },
  {
    id: "enterprise" as Tier,
    name: "Enterprise",
    price: "Custom",
    period: "",
    seats: "Unlimited seats",
    desc: "Tailored licensing with SSO, SLAs, and a dedicated success manager.",
    color: "border-violet-400/40",
    accent: "text-violet-400",
    bg: "bg-violet-400/8",
    badge: null,
    perks: [
      "Everything in Business",
      "SSO / SAML / SCIM provisioning",
      "Private cloud or on-prem deployment",
      "Custom game content & branding",
      "Dedicated Customer Success Manager",
      "99.9% SLA with 24/7 support",
      "Compliance reporting (SOC 2, GDPR)",
    ],
  },
]

const STATS = [
  { value: "37%", label: "reduction in reported burnout", icon: <Brain className="w-5 h-5" /> },
  { value: "2.4×", label: "focus score improvement in 90 days", icon: <Zap className="w-5 h-5" /> },
  { value: "$8,200", label: "avg annual value per employee", icon: <BarChart3 className="w-5 h-5" /> },
  { value: "94%", label: "employee engagement rate", icon: <Star className="w-5 h-5" /> },
]

const TEAM_SIZES = [
  "1–10 employees",
  "11–25 employees",
  "26–100 employees",
  "101–500 employees",
  "501–2,000 employees",
  "2,000+ employees",
]

export default function Enterprise() {
  const { toast } = useToast()
  const formRef = useRef<HTMLDivElement>(null)

  const [selectedTier, setSelectedTier] = useState<Tier>("business")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const [form, setForm] = useState({
    contact_name: "",
    company: "",
    work_email: "",
    team_size: "",
    message: "",
  })

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.contact_name || !form.company || !form.work_email || !form.team_size) {
      toast({ title: "All fields are required", variant: "destructive" })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`${BASE}/api/enterprise/inquiry`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, tier: selectedTier }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Submission failed")
      setSubmitted(true)
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen px-4 py-12 relative overflow-hidden">

      {/* Ambient orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[700px] h-[350px] rounded-full bg-violet-500/4 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[300px] rounded-full bg-primary/4 blur-[100px]" />
      </div>

      <div className="max-w-5xl mx-auto space-y-20">

        {/* Back */}
        <div>
          <Link href="/">
            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
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
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-400/10 border border-violet-400/30 text-violet-300 text-sm font-medium">
            <Building2 className="w-4 h-4" />
            B2B Corporate Wellness — Tier 2
          </div>
          <h1 className="font-serif text-5xl md:text-6xl leading-tight">
            <span className="text-gradient-gold">Train Your Team's</span>
            <br />
            <span className="text-foreground">Mind at Scale</span>
          </h1>
          <p className="text-muted-foreground text-xl leading-relaxed">
            Corporate wellness licenses that transform how your workforce thinks, focuses, and thrives —
            measured in real data, not feel-good perks.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            <LuxuryButton className="text-base px-8 py-5" onClick={scrollToForm}>
              <Send className="w-4 h-4 mr-2" />
              Request a Demo
            </LuxuryButton>
            <LuxuryButton variant="outline" className="text-base px-8 py-5" onClick={scrollToForm}>
              Get Custom Pricing
              <ChevronRight className="w-4 h-4 ml-1" />
            </LuxuryButton>
          </div>
        </motion.div>

        {/* ROI Stats */}
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
                  <div className="flex justify-center text-primary">{stat.icon}</div>
                  <p className="font-serif text-3xl font-bold text-gradient-gold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground leading-snug">{stat.label}</p>
                </GlassCardContent>
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>

        {/* Pricing tiers */}
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="font-serif text-3xl text-foreground">Corporate Licensing Tiers</h2>
            <p className="text-muted-foreground">Seat-based pricing. Volume discounts available for annual contracts.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TIERS.map((tier, i) => (
              <motion.div
                key={tier.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className="relative"
              >
                {tier.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <span className="px-3 py-1 text-xs font-bold bg-amber-400 text-background rounded-full">
                      {tier.badge}
                    </span>
                  </div>
                )}
                <GlassCard
                  className={`h-full cursor-pointer border transition-all duration-300 ${tier.color} ${selectedTier === tier.id ? "ring-2 ring-offset-0 ring-white/10" : "hover:opacity-90"}`}
                  onClick={() => { setSelectedTier(tier.id); scrollToForm() }}
                >
                  <GlassCardContent className="p-7 flex flex-col h-full gap-5">
                    <div>
                      <div className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest ${tier.accent} mb-3`}>
                        <Users className="w-3.5 h-3.5" />
                        {tier.seats}
                      </div>
                      <h3 className="font-serif text-2xl text-foreground">{tier.name}</h3>
                      <p className="text-muted-foreground text-sm mt-1 leading-snug">{tier.desc}</p>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className={`font-serif text-4xl font-bold ${tier.accent}`}>{tier.price}</span>
                      {tier.period && <span className="text-muted-foreground text-sm">{tier.period}</span>}
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
                      variant={tier.id === "business" ? "default" : "outline"}
                      className="w-full mt-2"
                      onClick={(e) => { e.stopPropagation(); setSelectedTier(tier.id); scrollToForm() }}
                    >
                      {tier.price === "Custom" ? "Contact Sales" : "Get Started"}
                    </LuxuryButton>
                  </GlassCardContent>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Feature matrix */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="space-y-5"
        >
          <h2 className="font-serif text-3xl text-center text-foreground">What's Included</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { icon: <BarChart3 className="w-6 h-6" />, title: "Wellness Analytics", desc: "Real-time dashboards tracking neural engagement, stress indicators, and team-level focus trends." },
              { icon: <Layers className="w-6 h-6" />, title: "Custom Branding", desc: "White-label the experience with your logo, colours, and company voice throughout the app." },
              { icon: <Shield className="w-6 h-6" />, title: "Enterprise Security", desc: "SOC 2 Type II, GDPR-compliant data handling, SSO via SAML 2.0, and role-based access control." },
              { icon: <Globe className="w-6 h-6" />, title: "Multi-Region Deployment", desc: "Host in EU, US, or APAC data centres. Private cloud and on-prem available for Enterprise tier." },
              { icon: <Headphones className="w-6 h-6" />, title: "Dedicated CSM", desc: "A named Customer Success Manager runs onboarding, quarterly reviews, and adoption campaigns." },
              { icon: <Sparkles className="w-6 h-6" />, title: "Custom Game Content", desc: "Commission bespoke neuroplasticity modules aligned to your company's values and OKRs." },
            ].map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.06 }}
              >
                <GlassCard className="h-full">
                  <GlassCardContent className="p-6 space-y-3">
                    <div className="text-primary">{feat.icon}</div>
                    <h4 className="font-serif text-lg text-foreground">{feat.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feat.desc}</p>
                  </GlassCardContent>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Lead capture form */}
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
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-serif text-3xl text-foreground mb-2">Inquiry Received</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Our enterprise team will reach out within one business day to schedule
                    your personalised demo and discuss custom pricing.
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
                <GlassCard className="slot-machine-glow">
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                  <GlassCardHeader className="px-8 pt-8 pb-0">
                    <GlassCardTitle className="font-serif text-2xl">
                      Request a Demo
                    </GlassCardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Selected tier: <span className="text-primary font-semibold capitalize">{selectedTier}</span> — fill out the form and we'll be in touch within 24 hrs.
                    </p>
                  </GlassCardHeader>

                  <GlassCardContent className="px-8 pb-8 pt-6">
                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="Jane Smith"
                            value={form.contact_name}
                            onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground/50 text-sm transition-colors"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company *</label>
                          <input
                            type="text"
                            required
                            placeholder="Acme Corp"
                            value={form.company}
                            onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground/50 text-sm transition-colors"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Work Email *</label>
                          <input
                            type="email"
                            required
                            placeholder="jane@acme.com"
                            value={form.work_email}
                            onChange={e => setForm(f => ({ ...f, work_email: e.target.value }))}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground/50 text-sm transition-colors"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team Size *</label>
                          <select
                            required
                            value={form.team_size}
                            onChange={e => setForm(f => ({ ...f, team_size: e.target.value }))}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground text-sm transition-colors appearance-none cursor-pointer"
                            style={{ background: "rgba(255,255,255,0.05)" }}
                          >
                            <option value="" disabled>Select size…</option>
                            {TEAM_SIZES.map(s => (
                              <option key={s} value={s} className="bg-[#0f2016] text-foreground">{s}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Interested Tier</label>
                        <div className="flex gap-3">
                          {TIERS.map(t => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setSelectedTier(t.id)}
                              className={`flex-1 py-2.5 text-sm rounded-xl border font-medium transition-all ${selectedTier === t.id ? `border-primary/60 bg-primary/15 text-primary` : `border-white/10 bg-white/5 text-muted-foreground hover:border-white/20`}`}
                            >
                              {t.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Message (optional)</label>
                        <textarea
                          rows={3}
                          placeholder="Tell us about your wellness goals, timeline, or any custom requirements…"
                          value={form.message}
                          onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground/50 text-sm transition-colors resize-none"
                        />
                      </div>

                      <LuxuryButton type="submit" className="w-full py-5 text-base" disabled={submitting}>
                        {submitting ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        {submitting ? "Sending…" : "Submit Inquiry"}
                      </LuxuryButton>
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
