import React from "react"
import { useLocation, Link } from "wouter"
import { Home, Brain, Heart, Crown, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

const TABS = [
  { href: "/",           Icon: Home,     label: "Home"    },
  { href: "/brain-game", Icon: Brain,    label: "Brain"   },
  { href: "/wellness",   Icon: Heart,    label: "Wellness"},
  { href: "/blackjack",  Icon: Crown,    label: "Cards"   },
  { href: "/eq-game",    Icon: Sparkles, label: "EQ"      },
]

export function MobileNav() {
  const [location] = useLocation()

  const hidden = ["/onboarding"].includes(location)
  if (hidden) return null

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="bg-[rgba(15,31,20,0.97)] backdrop-blur-xl border-t border-white/8 flex">
        {TABS.map(({ href, Icon, label }) => {
          const active = location === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center py-3 gap-1 min-h-[56px] transition-colors duration-150 active:opacity-70",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5 transition-transform duration-150", active && "scale-110")} />
              <span className="text-[10px] font-semibold tracking-wide leading-none">{label}</span>
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
