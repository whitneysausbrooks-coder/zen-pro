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
            <h1 className="text-3xl font-serif font-bold text-gradient-gold">Intellectual Property</h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            All creative, conceptual, and technical works contained in NeuroQuest are protected by
            copyright and intellectual property law.
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
                ("Luxury Zen" aesthetic), and the Compassion Casino™ business model.
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
                  ["Compassion Casino™", "The branded game category combining neuroplasticity training with charitable impact"],
                  ["Compassion Jackpot™", "The proprietary mechanic linking slot machine wins to real-world micro-donations"],
                  ["Neural Stake™", "The branded memory challenge game concept"],
                  ["Global Abundance Mission™", "The impact-focused brand narrative and donation framework"],
                  ["Mind & Spirit™", "The platform sub-brand and wellness positioning"],
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
                  "The Compassion Jackpot™ mechanic (linking gambling-style wins to charitable micro-donations)",
                  "The dual-currency system (Neural Energy ⚡ + Compassion Points ♡)",
                  "The 'Luxury Zen' visual design system and glassmorphism aesthetic",
                  "All original marketing copy, taglines, and pitch narratives",
                  "The neuroplasticity-to-entertainment bridge concept",
                  "The Sponsored Jackpot B2B monetization model",
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
                Businesses interested in licensing the NeuroQuest platform, the Compassion Casino™ concept,
                or the Compassion Jackpot™ mechanic for commercial purposes must obtain a written commercial
                license from Whitney Shauntaye.
              </p>
              <p>
                Corporate Wellness subscriptions (Tier 2) grant organizational access to the platform under
                the terms set forth in the enterprise agreement. They do not grant rights to the underlying
                IP or the ability to replicate the concept independently.
              </p>
              <p>
                Sponsored Jackpot partnerships are commercial arrangements governed by separate sponsorship
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
                    The NeuroQuest concept, including the Compassion Casino™ and Compassion Jackpot™ mechanics,
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

        </div>
      </div>

      <CopyrightFooter />
    </div>
  )
}
