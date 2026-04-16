import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Shield, AlertTriangle } from "lucide-react"

const AGE_KEY = "nq_age_verified"
const LEGAL_PATHS = ["/privacy", "/terms", "/copyright"]
const ENTERPRISE_PATHS = ["/admin-dashboard", "/admin", "/enterprise"]

export function AgeGate({ children }: { children: React.ReactNode }) {
  const [verified, setVerified] = useState<boolean | null>(null)
  const [declined, setDeclined] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(AGE_KEY)
    setVerified(stored === "1")
  }, [])

  const pathname = typeof window !== "undefined" ? window.location.pathname : ""
  const basePath = import.meta.env.BASE_URL?.replace(/\/$/, "") || ""
  const relativePath = basePath ? pathname.replace(basePath, "") : pathname

  const isLegalPage = LEGAL_PATHS.some(p => relativePath.endsWith(p))
  if (isLegalPage) return <>{children}</>

  const isEnterprisePage = ENTERPRISE_PATHS.some(p => relativePath.startsWith(p))
  if (isEnterprisePage) return <>{children}</>

  if (verified === null) return null

  if (verified) return <>{children}</>

  if (declined) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center gap-6">
        <AlertTriangle className="w-12 h-12 text-amber-400" />
        <h1 className="font-serif text-2xl font-bold text-gradient-gold">Age Restriction</h1>
        <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">
          NeuroQuest is intended for users who are 18 years of age or older. You must meet this requirement to access the platform.
        </p>
        <p className="text-xs text-white/25">
          NeuroQuest is a brain-training and wellness app for entertainment and personal growth purposes only.
        </p>
      </div>
    )
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#060f09]/95 backdrop-blur-xl px-5">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm rounded-3xl border border-primary/25 bg-[#0D1A10]/98 shadow-2xl overflow-hidden"
          style={{ boxShadow: "0 0 60px rgba(212,175,55,0.12)" }}
        >
          {/* Gold top accent */}
          <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #7a5a00, #D4AF37, #f0c842, #D4AF37, #7a5a00)" }} />

          <div className="px-7 pt-8 pb-8 text-center space-y-5">
            {/* Icon */}
            <div className="flex justify-center">
              <motion.div
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="w-16 h-16 rounded-2xl bg-primary/12 border border-primary/30 flex items-center justify-center"
              >
                <Shield className="w-8 h-8 text-primary" />
              </motion.div>
            </div>

            {/* Heading */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary/60">Age Verification</p>
              <h2 className="font-serif text-2xl font-bold text-gradient-gold">Are you 18 or older?</h2>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <p className="text-sm text-white/55 leading-relaxed">
                NeuroQuest is a brain-training and wellness platform. Access is restricted to adults aged 18 and over.
              </p>
              <div className="rounded-xl bg-white/4 border border-white/8 px-4 py-3">
                <p className="text-[11px] text-white/35 leading-relaxed">
                  <strong className="text-white/50">For Wellness & Entertainment.</strong> NeuroQuest is a brain-training app. Neural Energy is a virtual, non-redeemable in-game currency used to track your wellness journey.
                </p>
              </div>
            </div>

            {/* Buttons */}
            <div className="space-y-2 pt-1">
              <button
                onClick={() => { localStorage.setItem(AGE_KEY, "1"); setVerified(true) }}
                className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-97"
                style={{ background: "linear-gradient(135deg, #D4AF37, #f0c842, #b8941f)", color: "#1B3022", boxShadow: "0 4px 20px rgba(212,175,55,0.35)" }}
              >
                Yes, I am 18 or older — Enter
              </button>
              <button
                onClick={() => setDeclined(true)}
                className="w-full py-3 rounded-2xl font-medium text-sm text-white/30 hover:text-white/50 transition-colors"
              >
                No, I am under 18
              </button>
            </div>

            {/* Legal footnote */}
            <p className="text-[10px] text-white/20 leading-relaxed">
              By entering you confirm you meet the age requirement and agree to the{" "}
              <a href="/copyright" className="underline text-white/30 hover:text-white/50">Terms of Use</a>
              {" "}and{" "}
              <a href="/copyright#privacy" className="underline text-white/30 hover:text-white/50">Privacy Policy</a>.
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
