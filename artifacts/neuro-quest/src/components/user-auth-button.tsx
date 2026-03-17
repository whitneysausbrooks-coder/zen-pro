import React, { useState } from "react"
import { useAuth } from "@workspace/replit-auth-web"
import { motion, AnimatePresence } from "framer-motion"
import { LogIn, LogOut, User, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export function UserAuthButton() {
  const { user, isLoading, isAuthenticated, login, logout } = useAuth()
  const [open, setOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="h-9 w-24 rounded-full bg-white/5 border border-white/10 animate-pulse" />
    )
  }

  if (!isAuthenticated) {
    return (
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={login}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/20 transition-all"
      >
        <LogIn className="w-4 h-4" />
        Log In
      </motion.button>
    )
  }

  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}`
    : user?.email?.split("@")[0] ?? "You"

  const initials = (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? user?.firstName?.[1] ?? "")

  return (
    <div className="relative">
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
      >
        {user?.profileImageUrl ? (
          <img
            src={user.profileImageUrl}
            alt={displayName}
            className="w-7 h-7 rounded-full object-cover border border-primary/30"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary text-xs font-bold">
            {initials || <User className="w-3.5 h-3.5" />}
          </div>
        )}
        <span className="text-sm text-foreground font-medium max-w-[100px] truncate hidden sm:block">
          {displayName}
        </span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 z-50 w-52 rounded-2xl glass-panel border border-white/10 p-2 shadow-xl"
            >
              <div className="px-3 py-2 border-b border-white/8 mb-1">
                <p className="text-xs text-muted-foreground">Signed in as</p>
                <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                {user?.email && (
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                )}
              </div>
              <button
                onClick={() => { setOpen(false); logout() }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-400 hover:bg-red-400/10 transition-all"
              >
                <LogOut className="w-4 h-4" />
                Log Out
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
