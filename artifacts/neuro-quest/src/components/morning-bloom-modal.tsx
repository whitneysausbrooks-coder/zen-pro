import React, { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Leaf, Sun, Lock, Unlock } from "lucide-react"
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card"
import { LuxuryButton } from "@/components/ui/luxury-button"
import { cn } from "@/lib/utils"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

const DAILY_BONUS = 20

interface MorningBloomModalProps {
  onComplete: () => void
}

export function MorningBloomModal({ onComplete }: MorningBloomModalProps) {
  const [text, setText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 600)
  }, [])

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length
  const unlocked = wordCount >= 3

  async function handleSubmit() {
    if (!unlocked || submitting) return
    setSubmitting(true)
    try {
      await fetch(`${BASE}/api/quest/gratitude`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      })
    } catch (_) {}
    setSubmitting(false)
    setDone(true)
    setTimeout(onComplete, 1600)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-lg p-4"
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: -20 }}
        transition={{ type: "spring", stiffness: 240, damping: 22 }}
        className="relative w-full max-w-md"
      >
        <GlassCard glow className="overflow-hidden">
          <GlassCardContent className="p-0">
            {/* Header gradient strip */}
            <div className="relative h-32 flex items-center justify-center overflow-hidden"
              style={{ background: "linear-gradient(135deg, rgba(27,48,34,0.9) 0%, rgba(212,175,55,0.12) 50%, rgba(27,48,34,0.9) 100%)" }}>
              <div className="absolute inset-0 flex items-center justify-center gap-6 opacity-20">
                {[Leaf, Sun, Sparkles].map((Icon, i) => (
                  <motion.div key={i}
                    animate={{ y: [0, -6, 0], rotate: [0, i % 2 === 0 ? 8 : -8, 0] }}
                    transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: "easeInOut" }}>
                    <Icon className="w-10 h-10 text-primary" />
                  </motion.div>
                ))}
              </div>
              <div className="relative text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 260 }}
                  className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/20 border border-primary/40 mb-2"
                >
                  <Sparkles className="w-7 h-7 text-primary" />
                </motion.div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Morning Bloom</p>
              </div>
            </div>

            <div className="p-8 space-y-6">
              <AnimatePresence mode="wait">
                {!done ? (
                  <motion.div key="form" initial={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                    <div className="text-center space-y-1.5">
                      <h2 className="font-serif text-2xl font-bold text-foreground">
                        What are you grateful for today?
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Share 3+ words to unlock your daily{" "}
                        <span className="text-primary font-semibold">+{DAILY_BONUS} Neural Energy</span> bonus.
                      </p>
                    </div>

                    <div className="relative">
                      <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={e => setText(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && e.metaKey) handleSubmit() }}
                        placeholder="e.g. my morning coffee, the sunrise, a good friend…"
                        rows={3}
                        className="w-full px-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground/40 text-sm transition-all duration-200 resize-none"
                      />
                      {/* Word counter pill */}
                      <div className={cn(
                        "absolute bottom-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full transition-all duration-300",
                        unlocked
                          ? "bg-emerald-400/20 border border-emerald-400/40 text-emerald-400"
                          : "bg-white/5 border border-white/10 text-muted-foreground"
                      )}>
                        {wordCount} / 3 words
                      </div>
                    </div>

                    {/* Unlock status */}
                    <motion.div
                      animate={{ opacity: 1 }}
                      className={cn(
                        "flex items-center gap-2.5 px-4 py-3 rounded-xl border transition-all duration-500",
                        unlocked
                          ? "bg-emerald-400/10 border-emerald-400/30"
                          : "bg-white/3 border-white/8"
                      )}
                    >
                      {unlocked
                        ? <Unlock className="w-4 h-4 text-emerald-400 shrink-0" />
                        : <Lock className="w-4 h-4 text-muted-foreground/40 shrink-0" />}
                      <span className={cn(
                        "text-sm font-medium transition-colors duration-300",
                        unlocked ? "text-emerald-300" : "text-muted-foreground/50"
                      )}>
                        {unlocked
                          ? `Daily bonus unlocked — +${DAILY_BONUS} Neural Energy ready`
                          : `${Math.max(0, 3 - wordCount)} more word${3 - wordCount === 1 ? "" : "s"} to unlock your daily bonus`}
                      </span>
                    </motion.div>

                    <LuxuryButton
                      className="w-full text-base py-4 gap-2"
                      disabled={!unlocked || submitting}
                      onClick={handleSubmit}
                    >
                      <Sparkles className="w-4 h-4" />
                      {submitting ? "Planting your intention…" : "Begin My Day"}
                    </LuxuryButton>
                    <p className="text-[11px] text-center text-muted-foreground/40">
                      Your gratitude is private and stored only on this device session.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="py-4 text-center space-y-4"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.2, 1] }}
                      transition={{ type: "spring", stiffness: 280, damping: 16 }}
                      className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 border border-primary/50 mx-auto"
                    >
                      <Sparkles className="w-8 h-8 text-primary" />
                    </motion.div>
                    <div className="space-y-1">
                      <h3 className="font-serif text-xl font-bold text-foreground">Intention planted.</h3>
                      <p className="text-sm text-muted-foreground">
                        <span className="text-primary font-semibold">+{DAILY_BONUS} Neural Energy</span> added to your resonance.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </GlassCardContent>
        </GlassCard>
      </motion.div>
    </motion.div>
  )
}
