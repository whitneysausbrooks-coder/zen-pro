import React from "react"
import { motion } from "framer-motion"

interface StatRingProps {
  value: number
  max?: number
  label: string
  icon: React.ReactNode
  colorClass?: string
}

export function StatRing({ value, max = 100, label, icon, colorClass = "text-primary" }: StatRingProps) {
  const radius = 60
  const circumference = 2 * Math.PI * radius
  // Calculate level progress (remainder after hundreds)
  const levelProgress = value % max
  const strokeDashoffset = circumference - (levelProgress / max) * circumference

  return (
    <div className="relative flex flex-col items-center justify-center p-4">
      <div className="relative w-40 h-40 flex items-center justify-center">
        {/* Background track */}
        <svg className="absolute inset-0 w-full h-full -rotate-90 transform">
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke="currentColor"
            strokeWidth="6"
            fill="transparent"
            className="text-muted opacity-30"
          />
          {/* Progress ring */}
          <motion.circle
            cx="80"
            cy="80"
            r={radius}
            stroke="currentColor"
            strokeWidth="6"
            fill="transparent"
            strokeLinecap="round"
            className={colorClass}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            style={{ strokeDasharray: circumference }}
          />
        </svg>
        
        {/* Inner Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={`mb-1 opacity-80 ${colorClass}`}>
            {icon}
          </div>
          <motion.span 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-3xl font-serif font-bold text-foreground"
          >
            {value}
          </motion.span>
        </div>
      </div>
      <span className="mt-4 text-sm font-medium tracking-wider text-muted-foreground uppercase">
        {label}
      </span>
    </div>
  )
}
