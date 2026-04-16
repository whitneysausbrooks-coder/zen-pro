import React from "react"
import { useAuth } from "@clerk/react"
import { motion } from "framer-motion"
import { Brain, LogIn } from "lucide-react"
import { LuxuryButton } from "@/components/ui/luxury-button"
import { useLocation } from "wouter"

interface AuthGateProps {
  children: React.ReactNode
}

export function AuthGate({ children }: AuthGateProps) {
  const { isLoaded, isSignedIn } = useAuth()
  const [, setLocation] = useLocation()

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-radial from-primary/6 via-transparent to-transparent pointer-events-none" />
        <div className="flex flex-col items-center gap-5">
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/15 border border-primary/30"
          >
            <Brain className="w-8 h-8 text-primary" />
          </motion.div>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary"
          />
          <p className="text-sm text-muted-foreground font-medium">Checking access…</p>
        </div>
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-radial from-primary/8 via-transparent to-transparent pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm"
        >
          <div className="rounded-3xl border border-white/12 bg-[#0D1A10]/90 backdrop-blur-2xl shadow-2xl overflow-hidden">
            <div className="relative px-8 pt-10 pb-6 text-center">
              <div className="absolute inset-0 bg-gradient-to-b from-primary/6 to-transparent pointer-events-none" />
              <motion.div
                animate={{ scale: [1, 1.07, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/15 border border-primary/30 mb-4"
              >
                <Brain className="w-8 h-8 text-primary" />
              </motion.div>
              <h1 className="font-serif text-2xl font-bold text-gradient-gold mb-2">
                NeuroQuest™
              </h1>
              <p className="text-sm text-white/50 leading-relaxed">
                Sign in to train your mind, reach Compassion Milestones, and change lives worldwide.
              </p>
            </div>
            <div className="px-6 pb-5">
              <LuxuryButton onClick={() => setLocation("/sign-in")} className="w-full gap-3 py-4 text-base">
                <LogIn className="w-5 h-5" />
                Sign In to Play Free
              </LuxuryButton>
              <p className="text-[10px] text-white/20 text-center mt-4">
                © {new Date().getFullYear()} NeuroQuest™ by Whitney Shauntaye — All Rights Reserved
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  return <>{children}</>
}
