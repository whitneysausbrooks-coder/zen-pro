import React from "react"
import { format } from "date-fns"
import { motion } from "framer-motion"
import { Brain, Heart, Sparkles } from "lucide-react"
interface Activity {
  id: number | string;
  type: string;
  activity: string;
  amount: number;
  created_at: string;
}

interface ActivityFeedProps {
  activities: Activity[]
  isLoading: boolean
}

export function ActivityFeed({ activities, isLoading }: ActivityFeedProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-10 opacity-60">
        <Sparkles className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
        <p className="font-serif italic text-lg text-muted-foreground">Your journey begins here...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
      {activities.map((activity, index) => {
        const isEnergy = activity.type === "neural_energy"
        const Icon = isEnergy ? Brain : Heart
        const colorClass = isEnergy ? "text-primary" : "text-rose-400"
        const bgClass = isEnergy ? "bg-primary/10" : "bg-rose-400/10"

        return (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
          >
            <div className={`p-3 rounded-full ${bgClass} ${colorClass}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {activity.activity}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(activity.created_at), "MMM d, h:mm a")}
              </p>
            </div>
            <div className={`font-serif font-bold text-lg ${colorClass}`}>
              +{activity.amount}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
