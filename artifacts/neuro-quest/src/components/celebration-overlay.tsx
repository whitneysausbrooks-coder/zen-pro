import React, { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Heart, Zap, TrendingUp, Flame, Star } from "lucide-react"

export type CelebrationType =
  | "energy"
  | "compassion"
  | "level-up"
  | "streak-milestone"
  | "compassion-milestone"

interface CelebrationData {
  type: CelebrationType
  amount?: number
  title: string
  subtitle: string
  impactLine?: string
}

interface CelebrationOverlayProps {
  celebration: CelebrationData | null
  onDone: () => void
}

const TYPE_CONFIG: Record<CelebrationType, { icon: React.ElementType; color: string; bgColor: string; borderColor: string }> = {
  energy: { icon: Zap, color: "text-amber-400", bgColor: "bg-amber-400/15", borderColor: "border-amber-400/40" },
  compassion: { icon: Heart, color: "text-rose-400", bgColor: "bg-rose-400/15", borderColor: "border-rose-400/40" },
  "level-up": { icon: TrendingUp, color: "text-emerald-400", bgColor: "bg-emerald-400/15", borderColor: "border-emerald-400/40" },
  "streak-milestone": { icon: Flame, color: "text-orange-400", bgColor: "bg-orange-400/15", borderColor: "border-orange-400/40" },
  "compassion-milestone": { icon: Star, color: "text-rose-300", bgColor: "bg-rose-300/15", borderColor: "border-rose-300/40" },
}

function Particle({ delay, x, y, color }: { delay: number; x: number; y: number; color: string }) {
  return (
    <motion.div
      className={`absolute w-1.5 h-1.5 rounded-full ${color}`}
      initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
      animate={{
        opacity: [0, 1, 1, 0],
        scale: [0, 1.2, 1, 0.5],
        x: [0, x * 0.5, x],
        y: [0, y * 0.5, y],
      }}
      transition={{ duration: 1.2, delay, ease: "easeOut" }}
      style={{ left: "50%", top: "50%" }}
    />
  )
}

export function CelebrationOverlay({ celebration, onDone }: CelebrationOverlayProps) {
  const [particles] = useState(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      delay: Math.random() * 0.3,
      x: (Math.random() - 0.5) * 200,
      y: (Math.random() - 0.5) * 200,
    }))
  )

  useEffect(() => {
    if (!celebration) return
    const timer = setTimeout(onDone, 2400)
    return () => clearTimeout(timer)
  }, [celebration, onDone])

  return (
    <AnimatePresence>
      {celebration && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
        >
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="relative z-10 text-center px-6"
          >
            {(() => {
              const config = TYPE_CONFIG[celebration.type]
              const Icon = config.icon
              const particleColor = celebration.type === "compassion" || celebration.type === "compassion-milestone"
                ? "bg-rose-400" : celebration.type === "level-up"
                ? "bg-emerald-400" : celebration.type === "streak-milestone"
                ? "bg-orange-400" : "bg-amber-400"

              return (
                <>
                  <div className="relative inline-block mb-4">
                    {particles.map(p => (
                      <Particle key={p.id} delay={p.delay} x={p.x} y={p.y} color={particleColor} />
                    ))}

                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.3, 1] }}
                      transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.1 }}
                      className={`w-20 h-20 rounded-3xl ${config.bgColor} border-2 ${config.borderColor} flex items-center justify-center mx-auto`}
                    >
                      <Icon className={`w-10 h-10 ${config.color}`} />
                    </motion.div>
                  </div>

                  {celebration.amount !== undefined && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className={`font-serif font-bold text-4xl ${config.color} mb-2`}
                    >
                      +{celebration.amount}
                    </motion.div>
                  )}

                  <motion.h3
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="font-serif font-bold text-xl text-foreground mb-1"
                  >
                    {celebration.title}
                  </motion.h3>

                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-sm text-muted-foreground max-w-xs mx-auto"
                  >
                    {celebration.subtitle}
                  </motion.p>

                  {celebration.impactLine && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 }}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/25"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs font-medium text-emerald-300">{celebration.impactLine}</span>
                    </motion.div>
                  )}
                </>
              )
            })()}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
