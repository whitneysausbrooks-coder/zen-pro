import React from "react"
import { motion } from "framer-motion"
import { useLocation } from "wouter"
import { ArrowLeft, Shield, Lock, AlertTriangle, Heart, FileText, Mail, Globe } from "lucide-react"
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { CopyrightFooter } from "@/components/copyright-footer"

const YEAR = new Date().getFullYear()

interface SectionProps {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  accent?: string
}

function Section({ icon, title, children, accent = "text-primary" }: SectionProps) {
  return (
    <GlassCard>
      <GlassCardHeader>
        <GlassCardTitle className={`flex items-center gap-2 text-base ${accent}`}>
          {icon}
          {title}
        </GlassCardTitle>
      </GlassCardHeader>
      <GlassCardContent className="pt-0 text-sm text-white/60 leading-relaxed space-y-3">
        {children}
      </GlassCardContent>
    </GlassCard>
  )
}

export default function CopyrightPage() {
  const [, navigate] = useLocation()

  return (
    <div className="min-h-screen relative overflow-hidden pb-4">
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
            <h1 className="text-3xl font-serif font-bold text-gradient-gold">Legal & IP</h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Intellectual property, Terms of Use, and Privacy Policy for NeuroQuest™ — Mind & Spirit™.
          </p>
        </motion.div>

        <div className="space-y-5">

          {/* Ownership */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Section icon={<Heart className="w-4 h-4 fill-rose-400/50" />} title="Ownership & Authorship" accent="text-rose-300">
              <p>
                <span className="text-white font-semibold">NeuroQuest™</span> is an original creative work conceived,
                designed, and developed by <span className="text-white font-semibold">Whitney Shauntaye</span>,
                © {YEAR}. All rights reserved worldwide.
              </p>
              <p>
                Whitney Shauntaye is the sole original author and intellectual property owner of the NeuroQuest
                concept, platform, all associated game mechanics, branding, marketing copy, visual design language
                ("Luxury Zen" aesthetic), and the Mind & Spirit™ wellness model.
              </p>
              <p>
                This work was independently created and has not been derived from any prior art.
                The original concept, architecture, and execution are documented with time-stamped
                development records.
              </p>
            </Section>
          </motion.div>

          {/* Trademarks */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Section icon={<Shield className="w-4 h-4" />} title="Trademark & Brand Protection">
              <p>The following are proprietary marks of Whitney Shauntaye and may not be used without written permission:</p>
              <ul className="space-y-2 mt-2">
                {[
                  ["NeuroQuest™", "The platform name and brand identity"],
                  ["Neural Energy™", "The proprietary virtual currency fueling brain-training progression"],
                  ["Compassion Casino™", "The original branded concept combining neuroplasticity training with charitable impact"],
                  ["Cognitive Stakes™", "The branded framework for brain-training challenges with meaningful outcomes"],
                  ["Mind & Spirit™", "The wellness positioning sub-brand for neuroplasticity and compassion"],
                  ["Compassion Impact™", "The proprietary mechanic linking wellness milestones to real-world micro-donations"],
                  ["Compassion Wheel™", "The wellness and mindfulness compassion game experience"],
                  ["Neural Challenge™", "The branded cognitive card challenge game concept"],
                  ["Global Abundance Mission™", "The impact-focused brand narrative and donation framework"],
                ].map(([mark, desc]) => (
                  <li key={mark} className="flex items-start gap-3 pl-2">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    <span><span className="text-white font-semibold">{mark}</span> — {desc}</span>
                  </li>
                ))}
              </ul>
            </Section>
          </motion.div>

          {/* Protected Elements */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Section icon={<Lock className="w-4 h-4" />} title="Protected Intellectual Property">
              <p>The following elements are protected by copyright and/or trade secret law:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                {[
                  "The Compassion Impact™ mechanic (linking wellness milestones to charitable micro-donations)",
                  "The Neural Energy™ dual-currency system (Neural Energy ⚡ + Compassion Points ♡)",
                  "The Cognitive Stakes™ challenge framework and reward architecture",
                  "The Compassion Casino™ original concept and business model",
                  "The 'Luxury Zen' visual design system and glassmorphism aesthetic",
                  "All original marketing copy, taglines, and pitch narratives",
                  "The neuroplasticity-to-entertainment bridge concept",
                  "The Sponsored Impact B2B monetization model",
                  "The Corporate Wellness gamification framework",
                  "All impact stories, game writing, and in-app copy",
                  "The streak-multiplier compassion reward architecture",
                  "The Morning Bloom gratitude ritual system",
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-white/3 border border-white/8">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    <span className="text-xs leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>
            </Section>
          </motion.div>

          {/* Rights granted */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Section icon={<Globe className="w-4 h-4" />} title="Rights Granted to Users">
              <p>
                Users of NeuroQuest are granted a <span className="text-white font-semibold">limited, non-exclusive,
                non-transferable, revocable license</span> to access and use the application for personal,
                non-commercial purposes.
              </p>
              <p>
                <span className="text-white font-semibold">Sharing is encouraged</span> — users may share links,
                screenshots of their personal scores, and generated impact badges (which include NeuroQuest
                branding and watermarks). Sharing does not transfer any intellectual property rights.
              </p>
              <p>
                Users may <span className="text-white font-semibold">not</span>: reproduce, clone, reverse-engineer,
                sublicense, sell, resell, or create derivative works based on any NeuroQuest intellectual property
                without express written consent from Whitney Shauntaye.
              </p>
            </Section>
          </motion.div>

          {/* Commercial Licensing */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Section icon={<FileText className="w-4 h-4" />} title="Commercial & Enterprise Licensing">
              <p>
                Businesses interested in licensing the NeuroQuest platform, the Mind & Spirit™ concept,
                or the Compassion Impact™ mechanic for commercial purposes must obtain a written commercial
                license from Whitney Shauntaye.
              </p>
              <p>
                Corporate Wellness subscriptions (Tier 2) grant organizational access to the platform under
                the terms set forth in the enterprise agreement. They do not grant rights to the underlying
                IP or the ability to replicate the concept independently.
              </p>
              <p>
                Sponsored Impact partnerships are commercial arrangements governed by separate sponsorship
                agreements and do not constitute ownership or co-authorship of any NeuroQuest IP.
              </p>
            </Section>
          </motion.div>

          {/* DMCA */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Section icon={<AlertTriangle className="w-4 h-4" />} title="DMCA & Infringement Notice" accent="text-amber-400">
              <p>
                If you believe your intellectual property rights have been infringed upon, or if you have
                discovered unauthorized use of NeuroQuest intellectual property, please submit a notice
                containing the following:
              </p>
              <ul className="space-y-1 mt-2 list-disc list-inside">
                <li>A description of the copyrighted work you believe has been infringed</li>
                <li>The URL or location of the infringing material</li>
                <li>Your contact information (name, address, email, phone)</li>
                <li>A statement of good faith belief that the use is not authorized</li>
                <li>A statement that the information is accurate, under penalty of perjury</li>
                <li>Your physical or electronic signature</li>
              </ul>
              <div className="flex items-center gap-2 mt-3 p-3 rounded-xl bg-amber-400/8 border border-amber-400/20">
                <Mail className="w-4 h-4 text-amber-400 shrink-0" />
                <p className="text-xs">
                  Send DMCA notices and IP inquiries via the{" "}
                  <a href="https://x.com/messages" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline hover:text-amber-200">
                    contact form on X (Twitter)
                  </a>{" "}
                  or DM <span className="text-amber-300 font-bold">@whitneyshauntaye</span>
                </p>
              </div>
            </Section>
          </motion.div>

          {/* Prior art / timestamp */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <div className="rounded-2xl border border-primary/20 bg-primary/5 px-6 py-5">
              <div className="flex items-start gap-4">
                <Shield className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-serif font-bold text-primary mb-1">Proof of Prior Art</p>
                  <p className="text-xs text-white/50 leading-relaxed">
                    The NeuroQuest concept, including the Mind & Spirit™ and Compassion Impact™ mechanics,
                    was conceived and first developed by Whitney Shauntaye in {YEAR - 1}. Development history,
                    version control timestamps, design documents, and architectural plans constitute
                    verifiable proof of original authorship and priority of invention.
                  </p>
                  <p className="text-xs text-white/35 mt-2">
                    NeuroQuest™ — First published {YEAR}. All development records retained.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Governing law */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <div className="rounded-2xl border border-white/8 bg-white/3 px-6 py-5">
              <p className="text-xs text-white/40 leading-relaxed">
                <span className="text-white/60 font-semibold">Governing Law.</span>{" "}
                These intellectual property rights are governed by the laws of the United States of America,
                including the Copyright Act (17 U.S.C. §§ 101 et seq.), the Lanham Act (15 U.S.C. §§ 1051 et seq.),
                and applicable international IP treaties including the Berne Convention. Any disputes
                arising from unauthorized use of NeuroQuest intellectual property shall be subject to
                federal jurisdiction in the United States.
              </p>
              <p className="text-xs text-white/30 mt-3">
                Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} ·
                © {YEAR} Whitney Shauntaye — NeuroQuest™. All Rights Reserved.
              </p>
            </div>
          </motion.div>

          {/* Disclosures */}
          <motion.div id="disclosures" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Section icon={<AlertTriangle className="w-4 h-4" />} title="Disclosures" accent="text-amber-300">
              <p>
                <span className="text-white font-semibold">Health &amp; Wellness Disclaimer.</span> NeuroQuest is a brain-training and
                wellness entertainment application. It is <span className="text-white font-semibold">not a medical device</span>, and does
                not diagnose, treat, cure, or prevent any disease or medical condition. The neuroplasticity-based games and exercises are
                designed for cognitive entertainment and general wellness only. Consult a qualified healthcare provider before beginning any
                new wellness programme, especially if you have a history of seizures, epilepsy, or other neurological conditions. If you
                experience discomfort during gameplay, stop immediately and seek medical advice.
              </p>
              <p>
                <span className="text-white font-semibold">No Gambling.</span> NeuroQuest is <span className="text-white font-semibold">not
                a gambling product</span>. Neural Energy™ (⚡) and Compassion Points (♡) are virtual, in-game currencies with{" "}
                <span className="text-white font-semibold">no real-world monetary value</span>. They cannot be redeemed, exchanged, transferred,
                or cashed out for money, cryptocurrency, prizes, goods, or any tangible consideration. No real money is wagered during gameplay.
                NeuroQuest does not facilitate, simulate, or promote gambling of any kind. NeuroQuest is{" "}
                <span className="text-white font-semibold">not a sweepstakes, contest, or lottery</span>. No purchase or payment of any kind is
                necessary to participate in any game or activity. Compassion Impact™ events are charitable donations — not prizes awarded to users.
              </p>
              <p>
                <span className="text-white font-semibold">Charitable Donation Transparency.</span> Compassion Impact™ events trigger real
                micro-donations to registered charitable organisations including the World Hunger Relief Fund. These donations are funded by
                our sponsoring brand partners — <span className="text-white font-semibold">not deducted from your account, balance, or
                payment</span>. Donation amounts, frequency, and recipient charities may change at any time. NeuroQuest makes no guarantee
                regarding the total amount donated or the specific allocation of funds. Charitable partners are independent organisations;
                NeuroQuest is not responsible for their operations.{" "}
                <span className="text-white font-semibold">Tax notice:</span> Compassion Impact™ donations are made by NeuroQuest's sponsoring
                partners, not by you. These donations are <span className="text-white font-semibold">not tax-deductible by users</span> and do
                not constitute personal charitable contributions for tax purposes.
              </p>
              <p>
                <span className="text-white font-semibold">In-App Purchases.</span> NeuroQuest offers optional subscription plans and one-time
                purchases. All prices are displayed before purchase. Subscriptions auto-renew until cancelled. Manage subscriptions through your
                account settings or through the App Store / Google Play. No purchase is required to use the core features of NeuroQuest.
              </p>
              <p>
                <span className="text-white font-semibold">Third-Party Services.</span> NeuroQuest uses third-party services for authentication
                (Replit Auth), payment processing (Stripe), and analytics. Each third-party service operates under its own privacy policy and terms
                of service, which may govern how your data is processed, stored, or used by that provider. By using NeuroQuest, you acknowledge and
                accept the applicable terms of these third-party services.
              </p>
              <p>
                <span className="text-white font-semibold">Accuracy of Content.</span> While we strive to provide accurate information, NeuroQuest
                makes no warranties regarding the accuracy, completeness, or reliability of any in-app content, including impact statistics,
                donation totals, and leaderboard data. Content is provided for informational and entertainment purposes only.
              </p>
            </Section>
          </motion.div>

          {/* Terms of Service */}
          <motion.div id="terms" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
            <Section icon={<FileText className="w-4 h-4" />} title="Terms of Use" accent="text-cyan-300">
              <p>
                By accessing or using NeuroQuest, you agree to be bound by these Terms of Use. If you do not agree,
                do not use the platform.
              </p>
              <p>
                <span className="text-white font-semibold">Wellness & Entertainment.</span> NeuroQuest is a brain-training and
                wellness application. It is <span className="text-white font-semibold">not a gambling product</span>.
                Neural Energy (⚡) and Compassion Points (♡) are virtual, in-game currencies with no real-world monetary
                value and cannot be redeemed for cash, prizes, or any tangible consideration.
              </p>
              <p>
                <span className="text-white font-semibold">Eligibility.</span> You must be at least 18 years of age to use
                NeuroQuest. By confirming your age and accessing the platform, you represent and warrant that you meet
                this requirement.
              </p>
              <p>
                <span className="text-white font-semibold">Subscriptions &amp; Billing.</span> Zen Pro ($9.99/month) and Daily Pass ($5.00/24 hours)
                subscriptions are billed automatically at the stated frequency. Zen Pro subscriptions <span className="text-white font-semibold">auto-renew monthly</span>{" "}
                until cancelled. You may cancel at any time from your account settings; cancellation takes effect at the end of the current billing period.
                No refunds are issued for partial billing periods. Extra Plays ($2.99 per 10 plays) are a one-time purchase and non-refundable once used.
              </p>
              <p>
                <span className="text-white font-semibold">Compassion Impact Donations.</span> When you trigger a Compassion Impact event, a charitable
                micro-donation is made in your name by our sponsoring brand partners. These are donations to third-party charities — not prizes, winnings, or
                cash payments to you. No purchase is necessary to trigger a Compassion Impact.
              </p>
              <p>
                <span className="text-white font-semibold">Prohibited Conduct.</span> You agree not to reverse-engineer, scrape, reproduce, exploit commercially,
                or attempt to circumvent any access or security measures of NeuroQuest. Accounts found violating these terms may be suspended or terminated without notice.
              </p>
              <p>
                <span className="text-white font-semibold">Disclaimer.</span> NeuroQuest is provided "as is" without warranty of any kind. We do not guarantee
                uninterrupted access, accuracy of content, or fitness for any particular purpose. To the maximum extent permitted by law, Whitney Shauntaye shall not
                be liable for any indirect, incidental, or consequential damages arising from your use of the platform.
              </p>
              <p>
                We reserve the right to modify these Terms at any time. Continued use after changes constitutes acceptance.
              </p>
            </Section>
          </motion.div>

          {/* Privacy Policy */}
          <motion.div id="privacy" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Section icon={<Lock className="w-4 h-4" />} title="Privacy Policy" accent="text-rose-300">
              <p>
                Your privacy is important to us. This policy explains what data NeuroQuest collects, how it is used, and your rights.
              </p>
              <p>
                <span className="text-white font-semibold">Data We Collect.</span> We collect:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Account information: your name and profile provided through Replit Auth (sign-in only — we do not store your password).</li>
                <li>Usage data: game scores, play history, Neural Energy™ balance, Compassion Points, and session activity.</li>
                <li>Payment data: subscription and payment transactions are processed by Stripe. NeuroQuest does not store full card numbers.</li>
                <li>Device data: browser type, operating system, and device identifiers for app functionality and analytics.</li>
                <li>Age verification: a local flag stored on your device confirming you have verified your age (18+). This is stored only on your device and not transmitted to our servers.</li>
              </ul>
              <p>
                <span className="text-white font-semibold">How We Use Your Data.</span> We use collected data to operate and improve the platform,
                process payments, personalise your experience, provide customer support, and comply with legal obligations.
                We do not sell your personal data to third parties.
              </p>
              <p>
                <span className="text-white font-semibold">Data Sharing.</span> We may share data with:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li><span className="text-white/70">Stripe</span> — for payment processing (governed by Stripe's Privacy Policy).</li>
                <li><span className="text-white/70">Replit Auth</span> — for authentication services.</li>
                <li><span className="text-white/70">Sponsoring brands</span> — aggregate, anonymised engagement statistics only (no personally identifiable information).</li>
              </ul>
              <p>
                <span className="text-white font-semibold">Data Retention.</span> We retain account data for as long as your account is active or as needed to provide services.
                Specifically: (a) account and profile data is retained until you delete your account; (b) gameplay and progress data is retained for the life
                of your account; (c) payment transaction records are retained for 7 years as required by financial regulations; (d) server logs containing
                device and usage data are retained for up to 90 days for security and debugging purposes. You may request deletion of your account and
                associated data at any time by contacting our Privacy Team at privacy@neuroquestapp.com.
              </p>
              <p>
                <span className="text-white font-semibold">Your Rights.</span> Depending on your jurisdiction, you may have the right to access, correct,
                delete, restrict processing of, or export your personal data. You may also have the right to object to certain processing activities.
                To exercise any of these rights, please contact our Privacy Team using the dedicated contact information below.
              </p>
              <p>
                <span className="text-white font-semibold">Privacy Contact &amp; Data Requests.</span> For all privacy-related inquiries, data access requests,
                deletion requests, or complaints, contact our Privacy Team at:{" "}
                <span className="text-white font-semibold">privacy@neuroquestapp.com</span>. We will verify your identity before processing any request and
                respond within 30 days (or sooner where required by applicable law). If you wish to designate an authorised agent to submit a request on your
                behalf, the agent must provide written authorisation signed by you along with proof of identity.
              </p>
              <p>
                <span className="text-white font-semibold">California Residents (CCPA/CPRA).</span> If you are a California resident, you have the right to:
                (1) know what personal information we collect, use, disclose, and sell; (2) request deletion of your personal information;
                (3) request correction of inaccurate personal information; (4) opt out of the sale or sharing of your personal information — NeuroQuest
                does <span className="text-white font-semibold">not sell or share personal information</span> for cross-context behavioural advertising;
                (5) limit the use and disclosure of sensitive personal information; (6) non-discrimination for exercising your privacy rights. You or your
                authorised agent may submit a verifiable consumer request by contacting our Privacy Team above. We will respond within 45 days.
              </p>
              <p>
                <span className="text-white font-semibold">EEA/UK Residents (GDPR).</span> The data controller is Whitney Shauntaye, contactable at{" "}
                <span className="text-white font-semibold">privacy@neuroquestapp.com</span>. The legal bases for processing your data are: (a) performance
                of a contract (to provide the services you requested); (b) legitimate interests (to improve and secure our platform); (c) consent (where
                applicable, which you may withdraw at any time). You have the right to access, rectify, erase, restrict processing, data portability, and
                object to processing of your personal data. You may also lodge a complaint with your local supervisory authority. Where your data is transferred
                outside the EEA/UK, we rely on Standard Contractual Clauses or equivalent safeguards to ensure adequate protection.
              </p>
              <p>
                <span className="text-white font-semibold">Children's Privacy.</span> NeuroQuest is not directed at children under 18. We do not knowingly collect data
                from anyone under 18 years of age. If you believe a minor has provided us data, please contact us immediately.
              </p>
              <p>
                <span className="text-white font-semibold">Data Security.</span> We implement industry-standard security measures to protect your
                personal data, including encryption in transit (TLS/SSL) and secure authentication. However, no method of electronic transmission
                or storage is 100% secure. We cannot guarantee absolute security of your data.
              </p>
              <p>
                <span className="text-white font-semibold">Cookies &amp; Local Storage.</span> We use browser local storage (not third-party tracking cookies) to store your
                session state, game progress, and age verification flag. No third-party advertising cookies are used.
              </p>
              <p>
                <span className="text-white font-semibold">Do Not Track.</span> NeuroQuest respects Do Not Track (DNT) browser signals. We do not
                use third-party advertising trackers, and when DNT is enabled, we endeavour to limit data collection to what is essential for
                platform functionality. Note that some third-party services integrated into NeuroQuest may not respond to DNT signals independently.
              </p>
              <p>
                This Privacy Policy was last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.
                We may update this policy periodically. Continued use after changes constitutes acceptance.
              </p>
            </Section>
          </motion.div>

        </div>
      </div>

      <CopyrightFooter />
    </div>
  )
}
