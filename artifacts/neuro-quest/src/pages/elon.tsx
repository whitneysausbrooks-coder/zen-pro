import React, { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Brain, Globe, Zap, Heart, Rocket, Star, ArrowRight, Sparkles, DollarSign, Users, Target, Share2, Copy, Check, Twitter, Facebook } from "lucide-react"

function XLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function FacebookLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

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
  { icon: Heart,       value: "∞",           label: "Micro-donations generated\nper compassion milestone" },
  { icon: Users,       value: "1 in 4",      label: "Adults suffer from a\npreventable mind disease" },
]

const VISION_POINTS = [
  {
    icon: Zap,
    title: "The Game Changes the Brain",
    body: "Every round of NeuroQuest is a research-grounded training experience designed for daily play. Memory Matrix targets working memory. Emotional EQ trains empathic pattern recognition. Neural Challenge builds probabilistic intuition. Wellness is the gateway.",
  },
  {
    icon: DollarSign,
    title: "Compassion as Currency",
    body: "When a player reaches a compassion milestone, a micro-donation fires — automatically, in real time — to a charitable cause. The players' wins become the world's wins. We've built the mechanism. We need the fuel. A single sponsorship from you could trigger millions of micro-donations before Q4.",
  },
  {
    icon: Target,
    title: "The Billion-Mind Mission",
    body: "Neural Energy. Compassion Points. Streak multipliers. We've channeled the deepest human virtue — the desire to grow and to give — into a daily wellness practice. This is a civilization-scale mind-training network with a monetization engine baked into its soul.",
  },
  {
    icon: Rocket,
    title: "Why You, Why Now",
    body: "You've funded electric vehicles, reusable rockets, and neural interfaces. NeuroQuest is the missing layer — the consumer software that trains 8 billion minds to think bigger, feel deeper, and act kinder. The hardware changes what we build. This changes who we are.",
  },
]

function ShareBar() {
  const [copied, setCopied] = useState(false)
  const [copiedGrok, setCopiedGrok] = useState(false)
  const url = typeof window !== "undefined" ? `${window.location.origin}/elon` : ""

  const elonTweet = encodeURIComponent(
    `Hey @elonmusk — I built a wellness platform that trains the brain through neuroplasticity & funds hunger relief with every compassion milestone.\n\nEvery mind trained = meals funded. Every play feeds the world.\n\n"Your mind is the focus. The world is the winner."\n\nRead the full vision 👇`
  )
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent("NeuroQuest — A wellness platform that funds hunger relief with every compassion milestone. Every mind trained = meals funded. Share this with Elon Musk.")}`

  const grokTweet = encodeURIComponent(
    `@grok I need your help reaching @elonmusk about NeuroQuest — a wellness platform that trains 8 billion minds while funding global hunger relief through every compassion milestone.\n\nCan you analyze this pitch and help amplify it? 🧠🌍`
  )
  const grokDmUrl = `https://x.com/messages/compose?recipient_id=1743670578906652672&text=${encodeURIComponent(
    `Hi Grok — I built NeuroQuest, a wellness platform that trains the brain through neuroplasticity and funds hunger relief with every compassion milestone. I need help reaching @elonmusk. Here's the full vision: ${url}`
  )}`

  const copyLink = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }
  const copyGrokLink = async () => {
    const msg = `@grok @elonmusk — NeuroQuest is a wellness platform that trains minds & funds hunger relief. Every compassion milestone = real meals donated. Help me bring this vision to life: ${url}`
    await navigator.clipboard.writeText(msg)
    setCopiedGrok(true)
    setTimeout(() => setCopiedGrok(false), 2500)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="max-w-2xl mx-auto px-5 pb-20 space-y-4"
    >
      {/* Section header */}
      <div className="flex items-center gap-3 pt-2">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <span className="text-[11px] font-black uppercase tracking-[0.25em] text-primary">Share the Vision</span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      </div>

      {/* ① ELON — full-width gold hero */}
      <motion.a
        href={`https://x.com/intent/tweet?text=${elonTweet}&url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        className="relative w-full flex flex-col items-center justify-center gap-1 px-6 py-5 rounded-3xl font-black text-lg overflow-hidden"
        style={{ background: "linear-gradient(135deg, #7a5a00 0%, #D4AF37 30%, #f5d060 55%, #D4AF37 75%, #9a7300 100%)", color: "#1B3022", boxShadow: "0 0 40px rgba(212,175,55,0.55), 0 4px 16px rgba(0,0,0,0.4)" }}
      >
        {/* shimmer */}
        <motion.div
          animate={{ x: ["-100%", "220%"] }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear", repeatDelay: 2 }}
          className="absolute inset-0 w-1/3"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)" }}
        />
        <div className="relative flex items-center gap-3">
          <XLogo size={22} />
          <span className="tracking-wide">Tweet @elonmusk</span>
          <motion.span animate={{ x: [0, 6, 0] }} transition={{ duration: 1, repeat: Infinity }} className="text-xl">→</motion.span>
        </div>
        <span className="relative text-xs font-semibold opacity-70 tracking-widest uppercase">Tag him directly — be the signal in the noise</span>
      </motion.a>

      {/* ② GROK + FACEBOOK — two hero buttons */}
      <div className="grid grid-cols-2 gap-3">
        {/* Grok — violet hero */}
        <motion.a
          href={`https://x.com/intent/tweet?text=${grokTweet}&url=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="relative flex flex-col items-center justify-center gap-1 px-4 py-4 rounded-2xl font-bold text-sm overflow-hidden"
          style={{ background: "linear-gradient(135deg, #3b0764 0%, #7c3aed 50%, #a855f7 100%)", color: "#fff", boxShadow: "0 0 28px rgba(167,85,247,0.5), 0 4px 12px rgba(0,0,0,0.4)" }}
        >
          <motion.div
            animate={{ x: ["-100%", "220%"] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear", repeatDelay: 3 }}
            className="absolute inset-0 w-1/3"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)" }}
          />
          <div className="relative flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <span>Ask @grok</span>
          </div>
          <span className="relative text-[10px] opacity-60 uppercase tracking-widest">Elon's AI</span>
        </motion.a>

        {/* Facebook — blue hero */}
        <motion.a
          href={fbUrl}
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="relative flex flex-col items-center justify-center gap-1 px-4 py-4 rounded-2xl font-bold text-sm overflow-hidden"
          style={{ background: "linear-gradient(135deg, #0f4fa8 0%, #1877F2 60%, #4e9af1 100%)", color: "#fff", boxShadow: "0 0 28px rgba(24,119,242,0.5), 0 4px 12px rgba(0,0,0,0.4)" }}
        >
          <motion.div
            animate={{ x: ["-100%", "220%"] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear", repeatDelay: 4 }}
            className="absolute inset-0 w-1/3"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)" }}
          />
          <div className="relative flex items-center gap-2">
            <FacebookLogo size={16} />
            <span>Facebook</span>
          </div>
          <span className="relative text-[10px] opacity-60 uppercase tracking-widest">Share the page</span>
        </motion.a>
      </div>

      {/* ③ Secondary: DM Grok + Copy link */}
      <div className="grid grid-cols-2 gap-2">
        <a
          href={grokDmUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-violet-500/10 border border-violet-400/25 text-violet-300 font-bold text-xs hover:bg-violet-500/20 active:scale-95 transition-all"
        >
          <Share2 className="w-3.5 h-3.5" />
          DM @grok directly
        </a>
        <button
          onClick={copyLink}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold text-xs active:scale-95 transition-all"
          style={{ color: copied ? "#34d399" : "#D4AF37" }}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>

      {/* ④ Grok detail card — copy the full message */}
      <div
        className="rounded-2xl p-5 border border-violet-400/20 space-y-3"
        style={{ background: "rgba(124,58,237,0.07)" }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
          <p className="font-bold text-sm text-violet-300">Copy the @grok message</p>
          <span className="ml-auto text-[10px] text-violet-400/60 uppercase tracking-widest">AI amplification</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Paste this into a tweet tagging @grok — Elon's AI reads and surfaces trending pitches to him directly.
        </p>
        <button
          onClick={copyGrokLink}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500/15 border border-violet-400/30 text-violet-300 font-bold text-xs hover:bg-violet-500/25 active:scale-95 transition-all"
        >
          {copiedGrok ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copiedGrok ? "Message copied!" : "Copy @grok message"}
        </button>
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

      {/* ── Mission ribbon ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="sticky top-0 z-50 w-full overflow-hidden"
        style={{ background: "linear-gradient(90deg, #7a5a00 0%, #D4AF37 30%, #f0c842 50%, #D4AF37 70%, #7a5a00 100%)", boxShadow: "0 2px 32px rgba(212,175,55,0.6)" }}
      >
        {/* shimmer sweep */}
        <motion.div
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "linear", repeatDelay: 1.5 }}
          className="absolute inset-0 w-1/3"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)" }}
        />
        <a href="#share" className="relative flex items-center justify-center gap-3 px-4 py-3.5 w-full">
          <motion.span
            animate={{ scale: [1, 1.4, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="text-lg shrink-0"
          >📡</motion.span>
          <span className="font-black text-sm sm:text-base tracking-wider text-[#1B3022] uppercase text-center">
            SEND THIS TO ELON — TAP TO SHARE NOW
          </span>
          <motion.span
            animate={{ x: [0, 5, 0] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="text-[#1B3022] font-black text-lg shrink-0"
          >↓</motion.span>
        </a>
      </motion.div>

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
              I built <span className="text-foreground font-semibold">NeuroQuest</span> — a mobile-first wellness platform that applies neuroplasticity science to daily brain training. Every game session is a brain training protocol. Every compassion milestone triggers a real micro-donation to a charitable cause. Every login earns Neural Energy that funds compassion in the world.
            </p>
            <p>
              The neuroscience is real. Spaced repetition, emotional recognition, probabilistic reasoning — these are the building blocks of a resilient, empathetic mind. We wrapped them in a beautiful game so that billions of people who would never open a meditation app will actually use them. <em className="text-foreground">Daily.</em>
            </p>
            <p>
              Here's what I'm asking: <span className="text-foreground font-semibold">Sponsor the Impact</span>. For as little as $500/month, your name — or a cause of your choosing — appears in the Compassion Impact inside every player's wellness journey. When they reach a milestone, your micro-donation fires. Every play becomes a ripple of good in the world, powered by you.
            </p>
            <p>
              Or go bigger. Help fund the global rollout. I have the product. I have the vision. I need the rocket fuel.
            </p>
            <p className="text-foreground font-medium italic font-serif text-lg">
              "Your mind is the focus. The world is the winner."
            </p>
            <p>
              That's not just our tagline. It's a philosophy. And I believe you of all people understand what it means to commit everything to an idea that could change the world.
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
            The Compassion Impact sponsorship starts at <strong className="text-foreground">$500/month</strong>. Your name or cause displayed to every player on every play. Your micro-donation fires on every milestone. Your legacy, one neural pathway at a time.
          </p>

          <div className="glass-panel rounded-3xl p-8 border border-primary/30 space-y-4 text-left mb-8">
            {[
              { tier: "Spark",     price: "$500/mo",    desc: "Your name on the Compassion Impact. Micro-donations on every 3× win." },
              { tier: "Catalyst",  price: "$2,500/mo",  desc: "Branded impact + featured story in the app + Growth Chart attribution." },
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
      <div id="share">
        <ShareBar />
      </div>

      {/* ── Footer signature ────────────────────────────────────────────── */}
      <div className="pb-24 sm:pb-8 text-center px-6">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 text-muted-foreground text-xs"
        >
          <Brain className="w-4 h-4 text-primary" />
          <span>NeuroQuest · Mind & Spirit · Built for the world</span>
          <Brain className="w-4 h-4 text-primary" />
        </motion.div>
      </div>
    </div>
  )
}
