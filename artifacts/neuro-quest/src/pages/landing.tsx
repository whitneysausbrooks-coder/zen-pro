import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Sparkles, Moon, Waves, ChevronRight } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ZenProPrice {
  amount: number;
  currency: string;
  interval: string;
  configured: boolean;
}

async function fetchZenProPrice(): Promise<ZenProPrice | null> {
  try {
    const r = await fetch(`${BASE}/api/stripe/zen-pro-price`, {
      credentials: "include",
    });
    if (!r.ok) return null;
    return (await r.json()) as ZenProPrice;
  } catch {
    return null;
  }
}

/**
 * Reveal-on-scroll wrapper. Fades and lifts content into view as it enters
 * the viewport. Honors prefers-reduced-motion by skipping the transform.
 */
function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 28 }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Abstract fluid hero visual — pure SVG/CSS so it ships zero new bytes and
 * scales perfectly on retina + mobile. Three slow-drifting radial gradients
 * read as "mental clarity / neural ambient" without falling into the
 * stock-photo trap the brief explicitly calls out.
 */
function FluidHeroVisual() {
  const reduce = useReducedMotion();
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      <motion.div
        className="absolute -top-[15%] -right-[10%] w-[60vw] h-[60vw] max-w-[820px] max-h-[820px] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(212,175,55,0.28) 0%, rgba(212,175,55,0) 70%)",
        }}
        animate={
          reduce
            ? undefined
            : { scale: [1, 1.08, 1], x: [0, 18, 0], y: [0, -12, 0] }
        }
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[20%] -left-[15%] w-[55vw] h-[55vw] max-w-[720px] max-h-[720px] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(102,153,128,0.22) 0%, rgba(102,153,128,0) 70%)",
        }}
        animate={
          reduce
            ? undefined
            : { scale: [1, 1.12, 1], x: [0, -22, 0], y: [0, 18, 0] }
        }
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-20%] left-[20%] w-[50vw] h-[50vw] max-w-[640px] max-h-[640px] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(120,90,180,0.18) 0%, rgba(120,90,180,0) 70%)",
        }}
        animate={
          reduce
            ? undefined
            : { scale: [1, 1.06, 1], x: [0, 14, 0], y: [0, -18, 0] }
        }
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Faint grain overlay for that high-end editorial paper feel */}
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}

/**
 * Smooth-scroll helper. Honors prefers-reduced-motion (jumps instead of
 * smooth-scrolls so we don't fight the OS-level accessibility setting).
 */
function scrollToId(id: string, reduceMotion: boolean) {
  if (typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "start",
  });
}

export default function Landing() {
  const reduce = useReducedMotion();
  const [price, setPrice] = useState<ZenProPrice | null>(null);

  // Parallax — hero text drifts upward slightly as user scrolls. Subtle.
  const heroRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "-12%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 0.4]);

  useEffect(() => {
    fetchZenProPrice().then(setPrice);
  }, []);

  const priceLabel = useMemo(() => {
    if (!price) return "$9.99";
    return `$${(price.amount / 100).toFixed(2)}`;
  }, [price]);
  const intervalLabel = price?.interval ?? "month";

  const handlePrimaryCTA = () => scrollToId("invest", !!reduce);
  const handleSecondaryCTA = () => scrollToId("pivot", !!reduce);

  return (
    <div className="min-h-screen bg-[hsl(144,27%,6%)] text-[hsl(60,40%,98%)] selection:bg-[hsl(46,62%,52%)]/30 overflow-x-hidden">
      {/* ───────────── Top nav (minimal, editorial) ───────────── */}
      <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-[hsl(144,27%,6%)]/65 border-b border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="font-serif text-lg tracking-wide text-white/95 hover:text-[hsl(46,62%,62%)] transition-colors"
            aria-label="NeuroQuest Zen Pro home"
          >
            NeuroQuest <span className="text-[hsl(46,62%,62%)]">Zen Pro</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-white/65 font-light">
            <button
              onClick={() => scrollToId("pivot", !!reduce)}
              className="hover:text-white transition-colors"
            >
              Why Now
            </button>
            <button
              onClick={() => scrollToId("experience", !!reduce)}
              className="hover:text-white transition-colors"
            >
              The Ritual
            </button>
            <button
              onClick={() => scrollToId("voices", !!reduce)}
              className="hover:text-white transition-colors"
            >
              Voices
            </button>
            <button
              onClick={() => scrollToId("invest", !!reduce)}
              className="hover:text-white transition-colors"
            >
              Pricing
            </button>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="hidden sm:inline-block text-sm text-white/70 hover:text-white transition-colors px-3 py-2"
            >
              Sign in
            </Link>
            <button
              onClick={handlePrimaryCTA}
              className="text-sm font-medium text-[hsl(144,27%,8%)] bg-[hsl(46,62%,62%)] hover:bg-[hsl(46,62%,70%)] transition-colors px-4 py-2 rounded-full"
            >
              Claim Yours
            </button>
          </div>
        </div>
      </header>

      {/* ───────────── Section 1 · Hero ───────────── */}
      <section
        ref={heroRef}
        className="relative min-h-[100svh] flex items-center justify-center pt-24 pb-20 px-6"
      >
        <FluidHeroVisual />
        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 max-w-4xl mx-auto text-center"
        >
          <Reveal delay={0.1}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/[0.03] text-xs tracking-[0.25em] uppercase text-[hsl(46,62%,68%)] font-medium mb-8">
              <Sparkles className="w-3 h-3" aria-hidden />
              <span>Neural Conditioning · Est. 2025</span>
            </div>
          </Reveal>
          <Reveal delay={0.2}>
            <h1 className="font-serif text-[clamp(2.75rem,7vw,5.75rem)] leading-[1.04] tracking-tight text-white">
              Preserve Your Peak.
              <br />
              <span className="italic font-normal text-[hsl(46,62%,68%)]">
                Prevent The Fade.
              </span>
            </h1>
          </Reveal>
          <Reveal delay={0.35}>
            <p className="mt-7 text-lg md:text-xl text-white/65 font-light leading-relaxed max-w-2xl mx-auto">
              NeuroQuest Zen Pro is AI-personalized neural conditioning
              engineered for the modern high-performer. Catch the decline before
              it catches you.
            </p>
          </Reveal>
          <Reveal delay={0.5}>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={handlePrimaryCTA}
                className="group inline-flex items-center gap-2 bg-[hsl(46,62%,62%)] hover:bg-[hsl(46,62%,70%)] text-[hsl(144,27%,8%)] font-medium px-8 py-4 rounded-full transition-all duration-300 hover:shadow-[0_0_40px_-8px_rgba(212,175,55,0.5)]"
              >
                Claim Your Zen Pro
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button
                onClick={handleSecondaryCTA}
                className="inline-flex items-center gap-2 text-white/80 hover:text-white font-light px-6 py-4 transition-colors"
              >
                Why now
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </Reveal>
          <Reveal delay={0.7}>
            <p className="mt-12 text-xs tracking-[0.2em] uppercase text-white/35 font-light">
              Designed in California · Grounded in published HRV and sleep research
            </p>
          </Reveal>
        </motion.div>
      </section>

      {/* ───────────── Section 2 · The Pivot ───────────── */}
      <section
        id="pivot"
        className="relative py-32 md:py-44 px-6 border-t border-white/[0.04]"
      >
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <p className="text-xs tracking-[0.3em] uppercase text-[hsl(46,62%,62%)] font-medium mb-4 text-center">
              Why Now
            </p>
            <h2 className="font-serif text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.1] tracking-tight text-center max-w-3xl mx-auto">
              You don't slow down.{" "}
              <span className="italic text-white/70">But something is.</span>
            </h2>
          </Reveal>

          <div className="mt-20 md:mt-28 grid md:grid-cols-3 gap-12 md:gap-10">
            {[
              {
                eyebrow: "01",
                title: "The Cost of Ambition",
                body: "You don't stop. But your neural reserves do. Every late night, every back-to-back, every skipped recovery quietly drains a system you can't see — until you can.",
              },
              {
                eyebrow: "02",
                title: "Early Intervention",
                body: "Recovery is a measurable signal. Zen Pro tracks your HRV, sleep, and activity against your own established baseline and surfaces declines you might otherwise miss — so you can intervene early.",
              },
              {
                eyebrow: "03",
                title: "The Zen Pro Shield",
                body: "A daily luxury ritual designed to anchor focus and flush mental fatigue. Four minutes. Engineered cadence. Compounding return.",
              },
            ].map((col, i) => (
              <Reveal key={col.title} delay={i * 0.12}>
                <div className="group h-full">
                  <p className="font-serif italic text-[hsl(46,62%,62%)] text-2xl mb-8">
                    {col.eyebrow}
                  </p>
                  <div className="h-px w-full bg-gradient-to-r from-white/15 to-transparent mb-8 group-hover:from-[hsl(46,62%,62%)]/40 transition-all duration-700" />
                  <h3 className="font-serif text-2xl md:text-[1.75rem] leading-snug tracking-tight text-white mb-5">
                    {col.title}
                  </h3>
                  <p className="text-white/55 font-light leading-relaxed">
                    {col.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── Section 3 · Product Experience / Features ───────────── */}
      <section
        id="experience"
        className="relative py-32 md:py-44 px-6 border-t border-white/[0.04]"
      >
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <p className="text-xs tracking-[0.3em] uppercase text-[hsl(46,62%,62%)] font-medium mb-4 text-center">
              The Ritual
            </p>
            <h2 className="font-serif text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.1] tracking-tight text-center max-w-3xl mx-auto">
              Two motions.{" "}
              <span className="italic text-white/70">
                A fully recovered mind.
              </span>
            </h2>
          </Reveal>

          <div className="mt-20 md:mt-28 space-y-28 md:space-y-36">
            {/* Feature 1 — text left, visual right */}
            <Reveal>
              <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 mb-6 text-xs tracking-[0.25em] uppercase text-[hsl(46,62%,62%)]">
                    <Waves className="w-3.5 h-3.5" aria-hidden />
                    Feature 01
                  </div>
                  <h3 className="font-serif text-4xl md:text-5xl leading-tight tracking-tight text-white mb-6">
                    Decelerate on Demand.
                  </h3>
                  <p className="text-white/60 text-lg font-light leading-relaxed mb-6">
                    Real-time neuro-feedback that downshifts your nervous
                    system in under four minutes. Pull it open between meetings.
                    Walk back in clear.
                  </p>
                  <p className="text-white/40 text-sm font-light">
                    Powered by adaptive biometric coherence — no wearable
                    required.
                  </p>
                </div>
                <div className="relative aspect-square max-w-md mx-auto md:mx-0 md:ml-auto">
                  <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-[hsl(46,62%,62%)]/12 via-white/[0.02] to-[hsl(102,30%,30%)]/15 border border-white/[0.06] backdrop-blur-sm" />
                  <motion.div
                    className="absolute inset-8 rounded-full border border-[hsl(46,62%,62%)]/30"
                    animate={
                      reduce
                        ? undefined
                        : { scale: [1, 1.06, 1], opacity: [0.4, 0.8, 0.4] }
                    }
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <motion.div
                    className="absolute inset-16 rounded-full border border-[hsl(46,62%,62%)]/40"
                    animate={
                      reduce
                        ? undefined
                        : { scale: [1, 1.1, 1], opacity: [0.5, 0.9, 0.5] }
                    }
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 0.6,
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[hsl(46,62%,68%)] to-[hsl(46,62%,45%)] shadow-[0_0_60px_-10px_rgba(212,175,55,0.6)]" />
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Feature 2 — visual left, text right */}
            <Reveal>
              <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
                <div className="relative aspect-square max-w-md mx-auto md:mx-0 order-2 md:order-1">
                  <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-[hsl(258,40%,40%)]/15 via-white/[0.02] to-[hsl(46,62%,52%)]/10 border border-white/[0.06] backdrop-blur-sm" />
                  {/* Sleep-architecture wave visual */}
                  <svg
                    className="absolute inset-0 w-full h-full p-12"
                    viewBox="0 0 200 200"
                    preserveAspectRatio="none"
                    aria-hidden
                  >
                    {[0, 1, 2, 3].map((i) => (
                      <motion.path
                        key={i}
                        d={`M0 ${80 + i * 18} Q 50 ${60 + i * 18} 100 ${80 + i * 18} T 200 ${80 + i * 18}`}
                        stroke="hsl(46, 62%, 62%)"
                        strokeWidth="0.6"
                        fill="none"
                        opacity={0.15 + i * 0.12}
                        initial={reduce ? undefined : { pathLength: 0 }}
                        whileInView={reduce ? undefined : { pathLength: 1 }}
                        viewport={{ once: true }}
                        transition={{
                          duration: 2.4,
                          ease: "easeInOut",
                          delay: i * 0.15,
                        }}
                      />
                    ))}
                  </svg>
                </div>
                <div className="order-1 md:order-2">
                  <div className="inline-flex items-center gap-2 mb-6 text-xs tracking-[0.25em] uppercase text-[hsl(46,62%,62%)]">
                    <Moon className="w-3.5 h-3.5" aria-hidden />
                    Feature 02
                  </div>
                  <h3 className="font-serif text-4xl md:text-5xl leading-tight tracking-tight text-white mb-6">
                    Cognitive Sleep Architecture.
                  </h3>
                  <p className="text-white/60 text-lg font-light leading-relaxed mb-6">
                    Wake up with a fully recovered prefrontal cortex, ready to
                    execute. We don't just track your sleep — we structure it.
                  </p>
                  <p className="text-white/40 text-sm font-light">
                    Integrates seamlessly with Apple Health and Health Connect.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ───────────── Section 4 · Social Proof (Luxury) ───────────── */}
      <section
        id="voices"
        className="relative py-32 md:py-44 px-6 border-t border-white/[0.04]"
      >
        <div className="max-w-5xl mx-auto text-center">
          <Reveal>
            <p className="text-xs tracking-[0.3em] uppercase text-[hsl(46,62%,62%)] font-medium mb-4">
              Voices
            </p>
            <h2 className="font-serif text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.1] tracking-tight max-w-3xl mx-auto">
              The secret weapon of founders and creators who{" "}
              <span className="italic text-white/70">refuse to redline.</span>
            </h2>
          </Reveal>

          <div className="mt-20 grid md:grid-cols-3 gap-8 md:gap-6">
            {[
              {
                quote:
                  "I stopped grinding through my afternoon crash. Four minutes, and the day is mine again.",
                attr: "Founder · Series-B SaaS",
              },
              {
                quote:
                  "The first wellness product that respects the way I actually work. No fluff. Just edge.",
                attr: "Creative Director · Luxury Brand",
              },
              {
                quote:
                  "I sleep less than I should. Zen Pro made the sleep I do get count for more.",
                attr: "Partner · Venture Capital",
              },
            ].map((t, i) => (
              <Reveal key={i} delay={i * 0.12}>
                <figure className="h-full text-left p-8 rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-[hsl(46,62%,62%)]/20 transition-colors duration-500">
                  <span
                    className="font-serif text-5xl leading-none text-[hsl(46,62%,62%)]/50 block mb-2"
                    aria-hidden
                  >
                    "
                  </span>
                  <blockquote className="font-serif italic text-xl leading-snug text-white/85">
                    {t.quote}
                  </blockquote>
                  <figcaption className="mt-6 text-xs tracking-[0.2em] uppercase text-white/45 font-medium">
                    {t.attr}
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── Section 5 · Closing CTA / Pricing ───────────── */}
      <section
        id="invest"
        className="relative py-32 md:py-44 px-6 border-t border-white/[0.04] overflow-hidden"
      >
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] max-w-[900px] max-h-[900px] rounded-full blur-3xl opacity-60"
            style={{
              background:
                "radial-gradient(circle, rgba(212,175,55,0.10) 0%, rgba(212,175,55,0) 65%)",
            }}
          />
        </div>

        <div className="relative max-w-2xl mx-auto">
          <Reveal>
            <p className="text-xs tracking-[0.3em] uppercase text-[hsl(46,62%,62%)] font-medium mb-4 text-center">
              The Offer
            </p>
            <h2 className="font-serif text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.1] tracking-tight text-center">
              One ritual.{" "}
              <span className="italic text-white/70">Compounding edge.</span>
            </h2>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="mt-14 relative rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-sm p-10 md:p-12">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[hsl(46,62%,62%)] text-[hsl(144,27%,8%)] text-[10px] tracking-[0.25em] uppercase font-semibold">
                Zen Pro
              </div>

              <div className="text-center">
                <div className="flex items-baseline justify-center gap-1.5 mt-2">
                  <span className="font-serif text-6xl md:text-7xl text-white">
                    {priceLabel}
                  </span>
                  <span className="text-white/45 font-light text-lg">
                    / {intervalLabel}
                  </span>
                </div>
                <p className="mt-3 text-sm text-white/45 font-light">
                  Auto-renews monthly · Cancel any time · No contracts.
                </p>
              </div>

              <ul className="mt-10 space-y-4 max-w-md mx-auto">
                {[
                  "Decelerate on Demand · unlimited sessions",
                  "Cognitive Sleep Architecture · nightly",
                  "AI-personalized baseline · adapts daily",
                  "Apple Health + Health Connect background sync",
                  "Whoop strain integration · coming soon",
                  "Premium guided ritual library",
                ].map((line) => (
                  <li
                    key={line}
                    className="flex items-start gap-3 text-white/75 font-light"
                  >
                    <span
                      className="mt-2 w-1 h-1 rounded-full bg-[hsl(46,62%,62%)] flex-shrink-0"
                      aria-hidden
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-10 flex flex-col items-center gap-3">
                <Link
                  href="/subscribe"
                  className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[hsl(46,62%,62%)] hover:bg-[hsl(46,62%,70%)] text-[hsl(144,27%,8%)] font-medium px-10 py-4 rounded-full transition-all duration-300 hover:shadow-[0_0_50px_-10px_rgba(212,175,55,0.55)]"
                >
                  Invest in Your Edge
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/sign-in"
                  className="text-sm text-white/55 hover:text-white/85 font-light transition-colors"
                >
                  Already a member? Sign in
                </Link>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.3}>
            <p className="mt-10 text-center text-xs tracking-[0.2em] uppercase text-white/30 font-light">
              30-day satisfaction guarantee · Secure checkout via Stripe
            </p>
          </Reveal>
        </div>
      </section>

      {/* ───────────── Footer (minimal) ───────────── */}
      <footer className="border-t border-white/[0.04] py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="font-serif text-white/55 text-sm">
            NeuroQuest <span className="text-[hsl(46,62%,62%)]">Zen Pro</span>
          </p>
          <nav className="flex items-center gap-6 text-xs text-white/40 font-light">
            <Link href="/privacy" className="hover:text-white/70 transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white/70 transition-colors">
              Terms
            </Link>
            <Link href="/support" className="hover:text-white/70 transition-colors">
              Support
            </Link>

          </nav>
          <p className="text-xs text-white/30 font-light">
            © {new Date().getFullYear()} NeuroQuest, Inc.
          </p>
        </div>
      </footer>
    </div>
  );
}
