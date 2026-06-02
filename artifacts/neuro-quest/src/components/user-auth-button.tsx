import React from "react"
import { motion } from "framer-motion"
import { Smartphone } from "lucide-react"

export function UserAuthButton() {
  return (
    <motion.a
      whileTap={{ scale: 0.97 }}
      href="https://apps.apple.com/app/neuroquest"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/20 transition-all"
    >
      <Smartphone className="w-4 h-4" />
      Get the App
    </motion.a>
  )
}
