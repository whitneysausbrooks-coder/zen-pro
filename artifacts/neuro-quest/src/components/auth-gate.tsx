import React, { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Brain, Shield, LogIn, AlertTriangle } from "lucide-react"
import { useAuth } from "@workspace/replit-auth-web"
import { LuxuryButton } from "@/components/ui/luxury-button"

interface AuthGateProps {
  children: React.ReactNode
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  session_expired: "Your sign-in session expired. Please try again.",
  token_exchange_failed: "Sign-in could not be completed. Please try again.",
  no_claims: "We couldn't verify your identity. Please try again.",
  account_error: "There was a problem setting up your account. Please try again.",
  provider_unavailable: "The sign-in service is temporarily unavailable. Please try again shortly.",
  too_many_attempts: "Too many sign-in attempts. Please wait a moment and try again.",
  login_failed: "Sign-in failed. Please try again.",
}

export function AuthGate({ children }: AuthGateProps) {
  const { isLoading, isAuthenticated, login } = useAuth()
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const error = params.get("auth_error")
    if (error) {
      setAuthError(AUTH_ERROR_MESSAGES[error] || "Sign-in failed. Please try again.")
      const url = new URL(window.location.href)
      url.searchParams.delete("auth_error")
      window.history.replaceState({}, "", url.pathname + url.search)
    }
  }, [])

  if (isLoading) {
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
          <p className="text-sm text-muted-foreground font-medium">Loading your session…</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
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
              {authError && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-4"
                >
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300/80 leading-relaxed">{authError}</p>
                </motion.div>
              )}

              <div className="space-y-2.5 mb-6">
                {[
                  { icon: "🧠", text: "Neuroplasticity games that rewire your brain" },
                  { icon: "♡", text: "Compassion Impact™ — milestones fund real hunger relief" },
                  { icon: "⚡", text: "Build Neural Energy & unlock higher levels" },
                  { icon: "🌍", text: "Every session creates global impact" },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.07 }}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/3 border border-white/6"
                  >
                    <span className="text-base shrink-0">{item.icon}</span>
                    <span className="text-xs text-white/60 leading-relaxed">{item.text}</span>
                  </motion.div>
                ))}
              </div>

              <LuxuryButton onClick={() => { setAuthError(null); login(); }} className="w-full gap-3 py-4 text-base">
                <LogIn className="w-5 h-5" />
                {authError ? "Try Again" : "Sign In to Play Free"}
              </LuxuryButton>

              <div className="flex items-center gap-2 mt-4 justify-center">
                <Shield className="w-3.5 h-3.5 text-white/25" />
                <p className="text-[11px] text-white/30 text-center">
                  Secure sign-in powered by Replit. No password needed.
                </p>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-white/6 bg-black/20">
              <p className="text-[10px] text-white/20 text-center">
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
