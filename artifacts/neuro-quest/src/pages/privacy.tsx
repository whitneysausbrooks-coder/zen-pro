import { motion } from "framer-motion"
import { useLocation } from "wouter"
import { ArrowLeft, Shield } from "lucide-react"
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

export default function PrivacyPage() {
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
            <Shield className="w-7 h-7 text-primary" />
            <h1 className="text-3xl font-serif font-bold text-gradient-gold">Privacy Policy</h1>
          </div>
          <p className="text-sm text-muted-foreground">Last Updated: April 2026</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="space-y-4"
        >
          <Section title="Introduction">
            <p>NeuroQuest ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and related services (collectively, the "App").</p>
          </Section>

          <Section title="Information We Collect">
            <p>We collect information you provide directly to us, such as when you create an account, participate in brain training exercises, make purchases, or contact us for support. This may include your name, email address, and usage data related to your training activities.</p>
          </Section>

          <Section title="Apple HealthKit Data">
            <p><strong>What we read.</strong> If you grant permission, NeuroQuest reads three specific data types from Apple Health: Heart Rate Variability (HRV), Sleep Analysis, and Step Count. We do not read any other HealthKit data type — no workouts, no heart rate, no body measurements, no medical records, no clinical data.</p>
            <p><strong>What we do with it.</strong> Your HealthKit readings are used only to compute your personal Neuro Resilience Score, which is shown only to you in the app. Readings are transmitted to our servers over HTTPS, encrypted in transit and at rest, and used solely for your individual score and for fully-anonymized employer aggregates (see below).</p>
            <p><strong>What we never do.</strong> We never write data back to Apple Health. We never use HealthKit data for advertising, marketing, or sharing with data brokers. We never derive your identity or location from HealthKit data. We do not share individual HealthKit data with your employer under any circumstances.</p>
            <p><strong>Employer aggregates.</strong> If your employer is sponsoring your NeuroQuest pilot, they see anonymized, aggregated team trends only — and only when 5 or more teammates participate (k-anonymity threshold of 5). Your name and individual readings are never visible to your employer.</p>
            <p><strong>Revoking access.</strong> You can revoke HealthKit access at any time in iOS Settings → Privacy &amp; Security → Health → NeuroQuest. You can also delete your account in-app under Profile → Delete Account, which permanently removes all HealthKit-derived data from our servers.</p>
            <p><strong>HealthKit policy compliance.</strong> NeuroQuest's use of HealthKit data complies with Apple's HealthKit usage requirements. We do not use HealthKit data for purposes other than providing health and fitness services within the App.</p>
          </Section>

          <Section title="Local Data Storage">
            <p>NeuroQuest stores your training progress, Neural Energy balance, streak data, gratitude entries, and preferences locally on your device using secure on-device storage. This data remains on your device and is not transmitted to external servers unless you explicitly choose to sync or share it.</p>
          </Section>

          <Section title="How We Use Your Information">
            <p>We use information we collect to: provide and maintain the App and its features; process transactions and send related information; track your brain training progress and wellness metrics; improve and personalize your experience; send you technical notices, updates, and support messages; and comply with legal obligations.</p>
          </Section>

          <Section title="Charitable Donations">
            <p>When donations are triggered through your activities, we track aggregate donation amounts to verified charity partners. Individual donation records are stored locally on your device. We share aggregate, anonymized impact data with charity partners for reporting purposes only.</p>
          </Section>

          <Section title="In-App Purchases">
            <p>All purchases within the App are processed through Apple's App Store or Google Play Store payment systems. We do not directly collect, store, or process your payment card information. Please refer to Apple's or Google's privacy policies for information about how they handle payment data.</p>
          </Section>

          <Section title="Data Sharing">
            <p>We do not sell, trade, or rent your personal information to third parties. We may share anonymized, aggregated data for research purposes or to demonstrate the collective impact of our user community. We may disclose your information if required by law or in response to valid legal processes.</p>
          </Section>

          <Section title="Data Retention">
            <p>Local data is retained on your device until you choose to delete it through the app settings. You can reset all your data at any time from the Profile screen. Account-related data stored on our servers, if any, is retained for as long as your account is active or as needed to provide services.</p>
          </Section>

          <Section title="Children's Privacy">
            <p>NeuroQuest is intended for users aged 13 and older. We do not knowingly collect personal information from children under 13. If we learn that we have collected personal information from a child under 13, we will take steps to delete that information promptly.</p>
          </Section>

          <Section title="Your Rights">
            <p>You have the right to: access, correct, or delete your personal data; opt out of data collection for analytics; request a copy of your data; and withdraw consent at any time.</p>
            <p>For users in the European Economic Area (EEA), you have additional rights under GDPR including the right to data portability and the right to lodge a complaint with a supervisory authority.</p>
            <p>For California residents, you have rights under the CCPA including the right to know what personal information is collected and the right to request deletion.</p>
          </Section>

          <Section title="Security">
            <p>We implement industry-standard security measures to protect your information. However, no method of electronic storage or transmission is 100% secure, and we cannot guarantee absolute security.</p>
          </Section>

          <Section title="Changes to This Policy">
            <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy within the App and updating the "Last Updated" date. Your continued use of the App after changes constitutes acceptance of the updated policy.</p>
          </Section>

          <Section title="Contact Us">
            <p>If you have questions about this Privacy Policy, please contact us at <a href="mailto:admin@neuroquestllc.info" className="text-primary hover:underline">admin@neuroquestllc.info</a>.</p>
          </Section>
        </motion.div>

        <div className="mt-12 text-center text-xs text-white/30">
          <p>&copy; {new Date().getFullYear()} NeuroQuest. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}
