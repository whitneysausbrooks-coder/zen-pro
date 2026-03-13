import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Share, PlusSquare, Download } from "lucide-react"
import { cn } from "@/lib/utils"

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
function isAndroid() {
  return /android/i.test(navigator.userAgent)
}
function isStandalone() {
  return (
    (window.navigator as any).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  )
}

type Platform = "ios" | "android" | null

export function InstallPrompt() {
  const [platform, setPlatform] = useState<Platform>(null)
  const [dismissed, setDismissed] = useState(true)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    if (isStandalone()) return
    if (localStorage.getItem("nq_install_dismissed")) return

    // Android: capture the beforeinstallprompt event
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      if (isAndroid()) {
        setPlatform("android")
        setDismissed(false)
      }
    }
    window.addEventListener("beforeinstallprompt", handler)

    // iOS: show instructions if on Safari without standalone mode
    if (isIOS()) {
      // Small delay so it doesn't flash on page load
      setTimeout(() => {
        setPlatform("ios")
        setDismissed(false)
      }, 4000)
    }

    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const dismiss = () => {
    setDismissed(true)
    localStorage.setItem("nq_install_dismissed", "true")
  }

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") dismiss()
    setDeferredPrompt(null)
  }

  if (dismissed || !platform) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className="fixed bottom-0 left-0 right-0 z-50 sm:bottom-4 sm:left-4 sm:right-4 sm:max-w-sm sm:mx-auto"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 4px)" }}
      >
        <div className="bg-[rgba(20,40,26,0.98)] backdrop-blur-2xl border border-primary/25 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl">
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/8 transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <img src="/icons/icon-192.png" alt="NeuroQuest" className="w-12 h-12 rounded-2xl shadow-lg" />
            <div>
              <p className="font-serif font-bold text-foreground">Add to Home Screen</p>
              <p className="text-xs text-muted-foreground">Install NeuroQuest as an app</p>
            </div>
          </div>

          {platform === "ios" && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-white/4 border border-white/8 px-4 py-3 space-y-2.5">
                {[
                  { Icon: Share,     text: 'Tap the Share button in Safari', sub: 'Bottom center of your screen' },
                  { Icon: PlusSquare, text: 'Tap "Add to Home Screen"',        sub: 'Scroll down in the share menu' },
                ].map(({ Icon, text, sub }, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="p-1.5 bg-primary/15 rounded-lg shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{text}</p>
                      <p className="text-xs text-muted-foreground">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={dismiss}
                className="w-full py-2.5 rounded-xl border border-white/10 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Maybe later
              </button>
            </div>
          )}

          {platform === "android" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Get the full app experience with offline support and home screen access.
              </p>
              <button
                onClick={handleAndroidInstall}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity active:scale-98"
              >
                <Download className="w-4 h-4" />
                Install App
              </button>
              <button
                onClick={dismiss}
                className="w-full py-2 rounded-xl text-sm text-muted-foreground"
              >
                Not now
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
