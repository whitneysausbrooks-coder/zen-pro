import React from "react"
import { Heart, Shield, ExternalLink } from "lucide-react"
import { useLocation } from "wouter"
import { cn } from "@/lib/utils"

interface CopyrightFooterProps {
  className?: string
}

export function CopyrightFooter({ className }: CopyrightFooterProps) {
  const [, navigate] = useLocation()
  const year = new Date().getFullYear()

  return (
    <footer className={cn("relative z-10 border-t border-white/8 mt-16 py-8 px-4", className)}>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-white/30">
            <Heart className="w-3 h-3 text-rose-400/50 fill-rose-400/50 shrink-0" />
            <span>
              © {year} <span className="text-white/50 font-semibold">NeuroQuest™</span> by{" "}
              <span className="text-white/50 font-semibold">Whitney Shauntaye</span>. All Rights Reserved.
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/copyright")}
              className="flex items-center gap-1.5 text-[11px] text-white/25 hover:text-white/50 transition-colors"
            >
              <Shield className="w-3 h-3" />
              Legal & Privacy
            </button>
            <span className="text-white/10">·</span>
            <span className="text-[11px] text-white/20">
              NeuroQuest™ · Compassion Casino™ · Compassion Jackpot™
            </span>
          </div>
        </div>

        <p className="mt-3 text-[10px] text-white/15 text-center leading-relaxed max-w-2xl mx-auto">
          For entertainment only · No real-money gambling · Neural Energy has no cash value · 18+ only ·
          The NeuroQuest concept, Compassion Jackpot™, and Compassion Casino™ are exclusive property of Whitney Shauntaye.
        </p>
      </div>
    </footer>
  )
}
