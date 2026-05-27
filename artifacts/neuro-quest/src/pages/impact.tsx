import { motion } from "framer-motion"
import { useLocation } from "wouter"
import { ArrowLeft, Heart, Utensils, Receipt, ExternalLink } from "lucide-react"
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"

type QuarterRow = {
  quarter: string
  netRevenue: number
  donationPct: number
  donated: number
  mealsEquivalent: number
  recipient: string
  receiptUrl?: string
  status: "wired" | "pending" | "accruing"
}

const LEDGER: QuarterRow[] = [
  {
    quarter: "Q2 2026 (Apr–Jun)",
    netRevenue: 0,
    donationPct: 1,
    donated: 0,
    mealsEquivalent: 0,
    recipient: "Feeding America",
    status: "accruing",
  },
]

const totalDonated = LEDGER.reduce((s, r) => s + r.donated, 0)
const totalMeals = LEDGER.reduce((s, r) => s + r.mealsEquivalent, 0)

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 })
}

export default function ImpactPage() {
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
            <Heart className="w-7 h-7 text-primary" />
            <h1 className="text-3xl font-serif font-bold text-gradient-gold">Impact Ledger</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            A public, line-by-line record of every dollar NeuroQuest has donated.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8"
        >
          <GlassCard>
            <GlassCardContent className="pt-6 text-center">
              <Utensils className="w-6 h-6 text-primary mx-auto mb-2" />
              <div className="text-3xl font-serif font-bold text-gradient-gold">{totalMeals.toLocaleString()}</div>
              <div className="text-xs text-white/60 mt-1">Meals equivalent donated</div>
            </GlassCardContent>
          </GlassCard>
          <GlassCard>
            <GlassCardContent className="pt-6 text-center">
              <Receipt className="w-6 h-6 text-primary mx-auto mb-2" />
              <div className="text-3xl font-serif font-bold text-gradient-gold">{fmt(totalDonated)}</div>
              <div className="text-xs text-white/60 mt-1">Total wired to Feeding America</div>
            </GlassCardContent>
          </GlassCard>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <GlassCard>
            <GlassCardHeader>
              <GlassCardTitle className="text-base text-primary">How the Compassion Loop works</GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent className="pt-0 text-sm text-white/60 leading-relaxed space-y-3">
              <p>
                <strong className="text-white/80">1% of net subscription and pilot revenue</strong> — after Apple, Stripe, and processor fees — is donated to{" "}
                <a
                  href="https://www.feedingamerica.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Feeding America <ExternalLink className="w-3 h-3" />
                </a>{" "}
                via PayPal Giving Fund. The cap is $2,000 per month while we are early.
              </p>
              <p>
                Donations are funded out of our gross margin, accrued monthly, and wired quarterly. Meal equivalents use Feeding America's published figure of <strong className="text-white/80">$0.10 = 1 meal</strong>.
              </p>
              <p>
                <strong className="text-white/80">Donations are NOT triggered by gameplay, streaks, Neural Energy, or any chance mechanic.</strong> They are funded by paid subscriptions and pilots only. This keeps the loop simple, sybil-resistant, and free of gambling-adjacent design.
              </p>
              <p>
                Receipts from PayPal Giving Fund are posted to this page each quarter. If a number on this page does not reconcile with a receipt, email{" "}
                <a href="mailto:admin@neuroquestllc.info" className="text-primary hover:underline">
                  admin@neuroquestllc.info
                </a>{" "}
                and we will publish a correction.
              </p>
            </GlassCardContent>
          </GlassCard>

          <GlassCard>
            <GlassCardHeader>
              <GlassCardTitle className="text-base text-primary">Quarterly ledger</GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent className="pt-0 text-sm text-white/70">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="text-white/50 border-b border-white/10">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Quarter</th>
                      <th className="py-2 pr-3 font-medium text-right">Net rev.</th>
                      <th className="py-2 pr-3 font-medium text-right">Donated (1%)</th>
                      <th className="py-2 pr-3 font-medium text-right">Meals</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {LEDGER.map((r) => (
                      <tr key={r.quarter}>
                        <td className="py-3 pr-3">{r.quarter}</td>
                        <td className="py-3 pr-3 text-right">{fmt(r.netRevenue)}</td>
                        <td className="py-3 pr-3 text-right">{fmt(r.donated)}</td>
                        <td className="py-3 pr-3 text-right">{r.mealsEquivalent.toLocaleString()}</td>
                        <td className="py-3">
                          {r.status === "wired" && r.receiptUrl ? (
                            <a
                              href={r.receiptUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline inline-flex items-center gap-1"
                            >
                              Receipt <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : r.status === "pending" ? (
                            <span className="text-amber-300/80">Pending wire</span>
                          ) : (
                            <span className="text-white/40">Accruing</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-xs text-white/40">
                Ledger updated manually each quarter. Next update: July 2026.
              </p>
            </GlassCardContent>
          </GlassCard>

          <GlassCard>
            <GlassCardHeader>
              <GlassCardTitle className="text-base text-primary">FAQ</GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent className="pt-0 text-sm text-white/60 leading-relaxed space-y-3">
              <p>
                <strong className="text-white/80">Why only 1%?</strong> Because we want this program to survive a bad quarter. A donation rate that bankrupts the company is not impact — it is a press release. 1% is sustainable, honest, and grows with us.
              </p>
              <p>
                <strong className="text-white/80">Why Feeding America?</strong> National 501(c)(3), audited, every dollar can be traced. We will not rotate recipients monthly — rotation makes the ledger unverifiable.
              </p>
              <p>
                <strong className="text-white/80">Can I direct my donation?</strong> Not yet. Single-recipient pooling keeps the ledger clean and the overhead near zero. If we add user-directed giving later, it will be opt-in and routed through PayPal Giving Fund so receipts are issued directly to you.
              </p>
              <p>
                <strong className="text-white/80">Where are the receipts?</strong> Posted to the ledger above as soon as each quarterly wire clears. If a row says "Accruing," money is being set aside but has not yet been wired.
              </p>
            </GlassCardContent>
          </GlassCard>
        </motion.div>

        <div className="mt-12 text-center text-xs text-white/30">
          <p>&copy; {new Date().getFullYear()} NeuroQuest. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}
