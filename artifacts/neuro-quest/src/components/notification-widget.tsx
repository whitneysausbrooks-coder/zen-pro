import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Bell, BellOff, BellRing, X, Check } from "lucide-react"
import { useNotifications } from "@/hooks/use-notifications"
import { cn } from "@/lib/utils"

export function NotificationWidget() {
  const { permission, subscribed, loading, subscribe, unsubscribe, supported } = useNotifications()
  const [dismissed, setDismissed] = React.useState(() =>
    localStorage.getItem("nq_notif_dismissed") === "true"
  )
  const [justSubscribed, setJustSubscribed] = React.useState(false)

  if (!supported || dismissed || subscribed || permission === "denied") return null

  const handleSubscribe = async () => {
    const ok = await subscribe()
    if (ok) {
      setJustSubscribed(true)
      setTimeout(() => setDismissed(true), 2500)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem("nq_notif_dismissed", "true")
    setDismissed(true)
  }

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 220, damping: 22 }}
          className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/8 via-transparent to-primary/5 px-5 py-4"
        >
          <AnimatePresence mode="wait">
            {justSubscribed ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-3"
              >
                <div className="p-2 bg-emerald-400/15 rounded-xl border border-emerald-400/30">
                  <Check className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Mindful reminders enabled</p>
                  <p className="text-xs text-muted-foreground">We'll nudge you with personalized progress messages.</p>
                </div>
              </motion.div>
            ) : (
              <motion.div key="prompt" initial={{ opacity: 1 }} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ rotate: [0, -10, 10, -8, 8, 0] }}
                    transition={{ duration: 0.8, delay: 1.2 }}
                    className="p-2 bg-primary/15 rounded-xl border border-primary/25 shrink-0"
                  >
                    <Bell className="w-4 h-4 text-primary" />
                  </motion.div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Enable mindful reminders?</p>
                    <p className="text-xs text-muted-foreground">
                      Smart nudges when your Brain Health Level is about to break a record.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleSubscribe}
                    disabled={loading}
                    className={cn(
                      "text-xs font-bold px-4 py-2 rounded-xl border transition-all duration-200",
                      "bg-primary/15 border-primary/35 text-primary hover:bg-primary/25",
                      loading && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {loading ? "…" : "Enable"}
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
