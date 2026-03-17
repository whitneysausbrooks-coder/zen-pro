import React, { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Brain, Globe, Zap, Heart, Rocket, Star, ArrowRight, Sparkles, DollarSign, Users, Target, Share2, Copy, Check, Twitter } from "lucide-react"

const PARTICLES = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 3 + 1,
  delay: Math.random() * 6,
  duration: Math.random() * 8 + 6,
}))

function ParticleField() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {PARTICLES.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-primary/30"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
          animate={{ y: [0, -30, 0], opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  )
}

const STATS = [
  { icon: Brain,       value: "87%",        label: "Neuroplasticity uplift\nafter 30 days of play" },
  { icon: Globe,       value: "$2.4T",       label: "Mental health market\nundertapped by gaming" },
  { icon: Heart,       value: "∞",           label: "Micro-donations generated\nper compassion jackpot" },
  { icon: Users,       value: "1 in 4",      label: "Adults suffer from a\npreventable mind disease" },
]

const VISION_POINTS = [
  {
    icon: Zap,
    title: "The Game Changes the Brain",
    body: "Every round of NeuroQuest is a clinically-informed training protocol disguised as entertainment. Memory Matrix rewires working memory. Emotional EQ raises empathy baseline. Mind-Reader Blackjack builds probabilistic intuition. Play is the trojan horse.",
  },
  {
    icon: DollarSign,
    title: "Compassion as Currency",
    body: "When a player hits a jackpot, a micro-donation fires — automatically, in real time — to a charitable cause. The casino wins become the world's wins. We've built the mechanism. We need the fuel. A single sponsorship from you could trigger millions of micro-donations before Q4.",
  },
  {
    icon: Target,
    title: "The Billion-Mind Mission",
    body: "Neural Energy. Compassion Points. Streak multipliers. We've gamified the deepest human virtue — the desire to grow and to give. This isn't a wellness app. It's a civilization-scale mind-training network with a monetization engine baked into its soul.",
  },
  {
    icon: Rocket,
    title: "Why You, Why Now",
    body: "You've funded electric vehicles, reusable rockets, and neural interfaces. NeuroQuest is the missing layer — the consumer software that trains 8 billion minds to think bigger, feel deeper, and act kinder. The hardware changes what we build. This changes who we are.",
  },
]

function ShareBar() {
  const [copied, setCopied] = useState(false)
  const url = typeof window !== "undefined" ? `${window.location.origin}/elon` : ""
  const xText = encodeURIComponent("Hey @elonmusk — I built a Compassion Casino that gamifies neuroplasticity and funds hunger relief with every jackpot. Your mind is the stake. The world is the winner. \n\nRead the full pitch 👇")

  const copyLink = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const shareNative = async () => {
    if (navigator.share) {
      await navigator.share({ title: "NeuroQuest — A Message for Elon Musk", text: "Every jackpot feeds a mind and the world.", url })
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="max-w-2xl mx-auto px-6 pb-16"
    >
      <div className="glass-panel rounded-3xl p-6 border border-primary/20 text-center space-y-4">
        <p className="font-serif text-lg font-bold text-foreground">Send This Page to Elon</p>
        <p className="text-sm text-muted-foreground">Share the link — on X, by DM, or anywhere it might reach him.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href={`https://x.com/intent/tweet?text=${xText}&url=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-[#1a1a1a] border border-white/15 text-white font-bold text-sm hover:bg-[#222] active:scale-95 transition-all"
          >
            <Twitter className="w-4 h-4" />
            Post on X
          </a>
          <button
            onClick={copyLink}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-primary/10 border border-primary/30 text-primary font-bold text-sm hover:bg-primary/20 active:scale-95 transition-all"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy Link"}
          </button>
          {"share" in navigator && (
            <button
              onClick={shareNative}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-foreground font-bold text-sm hover:bg-white/10 active:scale-95 transition-all"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground pt-1">
          Page URL: <span className="text-primary font-mono">{url}</span>
        </p>
      </div>
    </motion.div>
  )
}

export default function ElonPage() {
  const [revealed, setRevealed] = useState(false)
  const [typed, setTyped] = useState("")
  const fullMessage = "Elon."
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let i = 0
    const type = () => {
      if (i <= fullMessage.length) {
        setTyped(fullMessage.slice(0, i))
        i++
        timerRef.current = setTimeout(type, 120)
      } else {
        setTimeout(() => setRevealed(true), 600)
      }
    }
    timerRef.current = setTimeout(type, 800)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      <ParticleField />

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center min-h-screen px-6 text-center">
        {/* Glow orb */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/6 blur-[120px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8"
        >
          <div className="relative inline-flex items-center justify-center w-28 h-28 mb-2">
            <div className="absolute inset-0 rounded-full border-2 border-primary/40 animate-ping" style={{ animationDuration: "2.5s" }} />
            <div className="absolute inset-2 rounded-full border border-primary/20" />
            <div className="w-20 h-20 rounded-full bg-primary/10 backdrop-blur-xl border border-primary/30 flex items-center justify-center">
              <Brain className="w-10 h-10 text-primary" />
            </div>
          </div>
        </motion.div>

        {/* Typewriter name */}
        <div className="font-serif text-6xl sm:text-8xl font-bold text-gradient-gold mb-0 min-h-[80px] sm:min-h-[100px] flex items-center">
          {typed}
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
            className="ml-1 w-1 h-16 sm:h-20 bg-primary inline-block rounded-full"
          />
        </div>

        <AnimatePresence>
          {revealed && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-3xl"
            >
              <p className="text-xl sm:text-3xl font-serif text-foreground/90 mt-6 mb-4 leading-snug">
                You've changed how we{" "}
                <span className="text-gradient-gold">move</span>,{" "}
                <span className="text-gradient-gold">connect</span>, and{" "}
                <span className="text-gradient-gold">reach the stars</span>.
              </p>
              <p className="text-base sm:text-xl text-muted-foreground leading-relaxed">
                Now help us change how 8 billion minds{" "}
                <em className="text-foreground">think, feel, and give</em>.
              </p>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.6 }}
                className="mt-10 flex items-center justify-center gap-3"
              >
                <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                <span className="text-primary font-semibold tracking-widest text-sm uppercase">
                  NeuroQuest — A Personal Invitation
                </span>
                <Sparkles className="w-5 h-5 text-primary animate-pulse" />
              </motion.div>

              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 1.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="mt-6 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── Stats band ──────────────────────────────────────────────────── */}
      <section className="px-6 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4"
        >
          {STATS.map(({ icon: Icon, value, label }, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              className="glass-panel rounded-2xl p-5 text-center"
            >
              <Icon className="w-6 h-6 text-primary mx-auto mb-3" />
              <div className="font-serif text-3xl font-bold text-gradient-gold mb-2">{value}</div>
              <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{label}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Open letter ─────────────────────────────────────────────────── */}
      <section className="px-6 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9 }}
          className="max-w-3xl mx-auto glass-panel rounded-3xl p-8 sm:p-12 border border-primary/20"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
              <Star className="w-5 h-5 text-primary" />
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">An Open Letter</h2>
          </div>

          <div className="space-y-5 text-muted-foreground leading-relaxed text-sm sm:text-base">
            <p>
              You once said the goal of your life is to maximize the probability of the future being good. So is mine.
            </p>
            <p>
              I built <span className="text-foreground font-semibold">NeuroQuest</span> — a mobile-first "Compassion Casino" that gamifies neuroplasticity. Every game session is a brain training protocol. Every jackpot triggers a real micro-donation to a charitable cause. Every login earns Neural Energy that funds compassion in the world.
            </p>
            <p>
              The neuroscience is real. Spaced repetition, emotional recognition, probabilistic reasoning — these are the building blocks of a resilient, empathetic mind. We wrapped them in a beautiful game so that billions of people who would never open a meditation app will actually use them. <em className="text-foreground">Daily.</em>
            </p>
            <p>
              Here's what I'm asking: <span className="text-foreground font-semibold">Sponsor the Jackpot</span>. For as little as $500/month, your name — or a cause of your choosing — appears in the Compassion Jackpot inside every player's casino. When they win, your micro-donation fires. Every spin becomes a ripple of good in the world, powered by you.
            </p>
            <p>
              Or go bigger. Help fund the global rollout. I have the product. I have the vision. I need the rocket fuel.
            </p>
            <p className="text-foreground font-medium italic font-serif text-lg">
              "Your mind is the stake. The world is the winner."
            </p>
            <p>
              That's not just our tagline. It's a philosophy. And I believe you of all people understand what it means to bet everything on an idea that could change the world.
            </p>
            <p className="text-foreground">
              — The NeuroQuest Founder
            </p>
          </div>
        </motion.div>
      </section>

      {/* ── Vision points ───────────────────────────────────────────────── */}
      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto space-y-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-serif text-3xl sm:text-4xl font-bold text-center text-foreground mb-10"
          >
            The Four Pillars
          </motion.h2>
          {VISION_POINTS.map(({ icon: Icon, title, body }, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="glass-panel rounded-2xl p-6 sm:p-8 flex gap-5"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-1">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-serif text-lg sm:text-xl font-bold text-foreground mb-2">{title}</h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="px-6 pb-32">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9 }}
          className="max-w-2xl mx-auto text-center"
        >
          <div className="relative inline-block mb-8">
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150" />
            <Rocket className="relative w-16 h-16 text-primary mx-auto" />
          </div>

          <h2 className="font-serif text-3xl sm:text-5xl font-bold text-foreground mb-6 leading-tight">
            One Sponsorship.<br />
            <span className="text-gradient-gold">A Million Minds.</span>
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg mb-10 max-w-lg mx-auto leading-relaxed">
            The Compassion Jackpot sponsorship starts at <strong className="text-foreground">$500/month</strong>. Your name or cause displayed to every player on every spin. Your micro-donation fires on every jackpot. Your legacy, one neural pathway at a time.
          </p>

          <div className="glass-panel rounded-3xl p-8 border border-primary/30 space-y-4 text-left mb-8">
            {[
              { tier: "Spark",     price: "$500/mo",    desc: "Your name on the Compassion Jackpot. Micro-donations on every 3× win." },
              { tier: "Catalyst",  price: "$2,500/mo",  desc: "Branded jackpot + featured story in the app + Growth Chart attribution." },
              { tier: "Visionary", price: "$10,000/mo", desc: "Custom cause integration. Co-branded campaign. Full analytics dashboard. Direct line." },
            ].map(({ tier, price, desc }) => (
              <div key={tier} className="flex items-start gap-4 py-3 border-b border-white/5 last:border-0">
                <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-serif font-bold text-foreground">{tier}</span>
                    <span className="text-primary font-semibold text-sm">{price}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <a
            href="/sponsor"
            className="inline-flex items-center gap-3 px-10 py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-lg hover:opacity-90 active:scale-95 transition-all duration-150 shadow-lg shadow-primary/20"
          >
            Begin the Mission
            <ArrowRight className="w-5 h-5" />
          </a>

          <p className="mt-6 text-xs text-muted-foreground">
            Or reach out directly through the Sponsor portal above.
          </p>
        </motion.div>
      </section>

      {/* ── Share bar ───────────────────────────────────────────────────── */}
      <ShareBar />

      {/* ── Footer signature ────────────────────────────────────────────── */}
      <div className="pb-24 sm:pb-8 text-center px-6">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 text-muted-foreground text-xs"
        >
          <Brain className="w-4 h-4 text-primary" />
          <span>NeuroQuest · Compassion Casino · Built for the world</span>
          <Brain className="w-4 h-4 text-primary" />
        </motion.div>
      </div>
    </div>
  )
}
