import { motion } from "framer-motion"
import { useLocation } from "wouter"
import { ArrowLeft, FileText } from "lucide-react"
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GlassCard>
      <GlassCardHeader>
        <GlassCardTitle className="text-base text-primary">{title}</GlassCardTitle>
      </GlassCardHeader>
      <GlassCardContent className="pt-0 text-sm text-white/60 leading-relaxed space-y-3">
        {children}
      </GlassCardContent>
    </GlassCard>
  )
}

export default function TermsPage() {
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

        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-3">
            <FileText className="w-7 h-7 text-primary" />
            <h1 className="text-3xl font-serif font-bold text-gradient-gold">Terms of Use</h1>
          </div>
          <p className="text-sm text-muted-foreground">Last Updated: April 2026</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="space-y-4"
        >
          <Section title="Acceptance of Terms">
            <p>By downloading, installing, or using NeuroQuest ("the App"), you agree to be bound by these Terms of Use. If you do not agree to these terms, do not use the App.</p>
          </Section>

          <Section title="Description of Service">
            <p>NeuroQuest is a wellness and brain-training application that combines neuroscience-backed cognitive exercises with charitable giving. The App provides brain training games, mindfulness exercises, progress tracking, and a mechanism for triggering micro-donations to verified charity partners.</p>
          </Section>

          <Section title="User Accounts">
            <p>You may use certain features of the App without creating an account. Your training data and progress are stored locally on your device. You are responsible for maintaining the confidentiality of your device and any account credentials. You agree to accept responsibility for all activities that occur under your account or on your device.</p>
          </Section>

          <Section title="Neural Energy and Virtual Currency">
            <p>Neural Energy is a virtual metric within the App used to track your engagement and progress. Neural Energy has no monetary value, cannot be exchanged for real currency, and cannot be transferred between users. Neural Energy balances may be adjusted or reset at our discretion.</p>
          </Section>

          <Section title="Charitable Donations">
            <p>NeuroQuest facilitates micro-donations to verified charity partners. Donation amounts are determined by your in-app activities and subscription tier. We commit to donating 30% of net revenue to verified charity partners. Donation records displayed in the App are for informational purposes. Actual donation processing occurs on a periodic basis through our partner organizations.</p>
          </Section>

          <Section title="In-App Purchases and Subscriptions">
            <p>The App offers optional in-app purchases and subscriptions processed through Apple's App Store or Google Play Store. All purchases are subject to the respective store's terms and conditions. Subscription prices are displayed before purchase. Subscriptions automatically renew unless cancelled at least 24 hours before the end of the current period. You can manage or cancel subscriptions through your device's store settings.</p>
          </Section>

          <Section title="Intellectual Property">
            <p>All content in the App, including text, graphics, logos, icons, images, audio clips, and software, is the property of NeuroQuest or its content suppliers and is protected by copyright, trademark, and other intellectual property laws. "NeuroQuest," "Neural Energy," "Heart-Brain Hybrid Score," and "Empathy Index" are trademarks of NeuroQuest. You may not use these marks without our prior written permission.</p>
          </Section>

          <Section title="Prohibited Conduct">
            <p>You agree not to: use the App for any unlawful purpose; attempt to reverse engineer, decompile, or disassemble the App; interfere with or disrupt the App or its servers; create multiple accounts to manipulate metrics or leaderboards; use automated systems or bots to interact with the App; or misrepresent your identity or affiliation.</p>
          </Section>

          <Section title="Health Disclaimer">
            <p>NeuroQuest is designed for general wellness and cognitive training purposes only. The App is not a medical device and is not intended to diagnose, treat, cure, or prevent any disease or health condition. The brain training exercises are based on published neuroscience research but individual results may vary. Consult a healthcare professional before beginning any new wellness program, especially if you have a pre-existing medical condition.</p>
          </Section>

          <Section title="Limitation of Liability">
            <p>To the maximum extent permitted by law, NeuroQuest shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the App. Our total liability shall not exceed the amount you paid for the App in the twelve months preceding the claim.</p>
          </Section>

          <Section title="Termination">
            <p>We may terminate or suspend your access to the App at any time, without prior notice or liability, for any reason, including if you breach these Terms. Upon termination, your right to use the App will immediately cease.</p>
          </Section>

          <Section title="Governing Law">
            <p>These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to conflict of law provisions.</p>
          </Section>

          <Section title="Changes to Terms">
            <p>We reserve the right to modify these Terms at any time. We will provide notice of significant changes through the App. Your continued use of the App after changes constitutes acceptance of the modified Terms.</p>
          </Section>

          <Section title="Contact">
            <p>For questions about these Terms, contact us at <a href="mailto:admin@neuroquestllc.info" className="text-primary hover:underline">admin@neuroquestllc.info</a>.</p>
          </Section>
        </motion.div>

        <div className="mt-12 text-center text-xs text-white/30">
          <p>&copy; {new Date().getFullYear()} NeuroQuest. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}
