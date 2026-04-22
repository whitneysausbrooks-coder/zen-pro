import { motion } from "framer-motion"
import { useLocation } from "wouter"
import { ArrowLeft, LifeBuoy, Mail, MessageCircle, HelpCircle, CreditCard, Shield } from "lucide-react"
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"

const SUPPORT_EMAIL = "admin@neuroquestllc.info"

const FAQ = [
  {
    q: "How do I cancel my Zen Pro subscription?",
    a: "Open the App Store on your iPhone, tap your profile in the top right, tap Subscriptions, then select NQ Zen Pro and tap Cancel Subscription. Your access will continue until the end of the current billing period.",
  },
  {
    q: "How do I restore purchases on a new device?",
    a: "Sign in with the same Apple ID you used for the original purchase, open NQ Zen Pro, go to the Shop tab, and tap Restore Purchases at the bottom of the screen.",
  },
  {
    q: "Where does the charity donation go?",
    a: "30% of every subscription, daily pass, and spin pack purchase is donated to one of our six verified charity partners. You can choose your preferred cause in the app under Settings → Charity.",
  },
  {
    q: "Is my biometric data shared?",
    a: "No. Heart-rate variability, sleep, and activity data stay on your device or in your private encrypted account. We never sell or share biometric data with third parties. See our Privacy Policy for details.",
  },
  {
    q: "How is my NeuroResilience Score calculated?",
    a: "Your score combines HRV (50%), sleep quality (35%), and daily activity (15%) into a single 0–100 number that represents your current resilience. The score updates daily.",
  },
  {
    q: "I was charged but didn't receive my purchase.",
    a: "Open the Shop tab and tap Restore Purchases. If the issue persists, email us at " + SUPPORT_EMAIL + " with your Apple ID and the date of purchase and we will resolve it within 24 hours.",
  },
]

const CONTACT_LINKS = [
  {
    icon: Mail,
    label: "Email support",
    detail: SUPPORT_EMAIL,
    href: `mailto:${SUPPORT_EMAIL}?subject=NeuroQuest%20Support%20Request`,
  },
  {
    icon: CreditCard,
    label: "Manage subscription",
    detail: "Apple ID → Subscriptions",
    href: "https://apps.apple.com/account/subscriptions",
  },
  {
    icon: Shield,
    label: "Privacy policy",
    detail: "How we handle your data",
    href: "/privacy",
  },
]

export default function SupportPage() {
  const [, navigate] = useLocation()

  return (
    <div className="min-h-screen relative overflow-hidden pb-16">
      <div
        className="absolute inset-0 z-0 opacity-40 mix-blend-overlay pointer-events-none bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/zen-bg.png)` }}
      />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pt-10">
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to Dashboard</span>
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-3 mb-3">
            <LifeBuoy className="w-7 h-7 text-primary" />
            <h1 className="text-3xl font-serif font-bold text-gradient-gold">Support Center</h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            We are here to help. Email replies within 24 hours, Monday through Friday.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid sm:grid-cols-3 gap-3 mb-8"
        >
          {CONTACT_LINKS.map(({ icon: Icon, label, detail, href }) => (
            <a
              key={label}
              href={href}
              className="block"
              {...(href.startsWith("/") ? {} : { target: "_blank", rel: "noopener noreferrer" })}
            >
              <GlassCard className="hover:border-primary/40 transition-colors h-full">
                <GlassCardContent className="flex flex-col items-start gap-2 py-5">
                  <Icon className="w-5 h-5 text-primary" />
                  <div className="text-sm font-medium text-white">{label}</div>
                  <div className="text-xs text-muted-foreground break-all">{detail}</div>
                </GlassCardContent>
              </GlassCard>
            </a>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <HelpCircle className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-white">Frequently Asked Questions</h2>
          </div>

          {FAQ.map((item, i) => (
            <GlassCard key={i}>
              <GlassCardHeader>
                <GlassCardTitle className="text-base text-primary">{item.q}</GlassCardTitle>
              </GlassCardHeader>
              <GlassCardContent className="pt-0 text-sm text-white/60 leading-relaxed">
                {item.a}
              </GlassCardContent>
            </GlassCard>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-10"
        >
          <GlassCard>
            <GlassCardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-6">
              <MessageCircle className="w-6 h-6 text-primary shrink-0" />
              <div className="flex-1">
                <div className="text-base font-semibold text-white mb-1">Still need help?</div>
                <div className="text-sm text-muted-foreground">
                  Email us at{" "}
                  <a
                    href={`mailto:${SUPPORT_EMAIL}?subject=NeuroQuest%20Support%20Request`}
                    className="text-primary hover:underline"
                  >
                    {SUPPORT_EMAIL}
                  </a>{" "}
                  and include your Apple ID, the device you are using, and a brief description of the issue.
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>
        </motion.div>

        <p className="text-center text-xs text-muted-foreground mt-10">
          NeuroQuest LLC · © 2026 · All rights reserved
        </p>
      </div>
    </div>
  )
}
