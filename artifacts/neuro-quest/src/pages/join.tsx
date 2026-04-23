import React, { useState } from "react"
import { useLocation } from "wouter"
import { motion, AnimatePresence } from "framer-motion"
import { Building2, CheckCircle2, Loader2, ArrowRight, Sparkles } from "lucide-react"
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card"
import { LuxuryButton } from "@/components/ui/luxury-button"
import { useToast } from "@/hooks/use-toast"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

type Step = "code" | "details" | "success"

interface CompanyInfo {
  company_id: string
  company_name: string
  pilot_status: string
  pilot_ends_at: string | null
  branding: { primary_color: string; logo_url: string | null }
}

export default function JoinPage() {
  const { toast } = useToast()
  const [, navigate] = useLocation()

  const [step, setStep] = useState<Step>("code")
  const [code, setCode] = useState("")
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [department, setDepartment] = useState("")
  const [company, setCompany] = useState<CompanyInfo | null>(null)
  const [busy, setBusy] = useState(false)

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = code.trim().toUpperCase()
    if (cleaned.length < 4) {
      toast({ title: "Enter your company code", variant: "destructive" })
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`${BASE}/api/enterprise/lookup-invite?code=${encodeURIComponent(cleaned)}`)
      const data = await res.json()
      if (!data.valid) {
        toast({ title: "Code not found", description: "Please check with your admin.", variant: "destructive" })
      } else {
        setCompany(data)
        setCode(cleaned)
        setStep("details")
      }
    } catch (err: any) {
      toast({ title: "Could not check code", description: "Please try again.", variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !name.trim()) {
      toast({ title: "Please fill in your name and email", variant: "destructive" })
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`${BASE}/api/enterprise/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invite_code: code,
          email: email.trim(),
          name: name.trim(),
          department: department.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Could not join")
      }
      try {
        localStorage.setItem("nq_enterprise_user_id", data.user_id)
        localStorage.setItem("nq_enterprise_company_id", data.company_id)
        localStorage.setItem("nq_enterprise_company_name", data.company_name)
      } catch {}
      setStep("success")
    } catch (err: any) {
      toast({ title: "Could not join", description: err.message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen px-4 py-12 flex items-center justify-center relative overflow-hidden">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[700px] h-[350px] rounded-full bg-violet-500/5 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[300px] rounded-full bg-primary/5 blur-[100px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <AnimatePresence mode="wait">
          {step === "code" && (
            <motion.div key="code" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <GlassCard>
                <GlassCardContent className="p-8 space-y-6">
                  <div className="text-center space-y-3">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-violet-400/10 border border-violet-400/30">
                      <Building2 className="w-6 h-6 text-violet-300" />
                    </div>
                    <h1 className="font-serif text-3xl text-foreground">Join Your Company</h1>
                    <p className="text-muted-foreground text-sm">
                      Enter the 8-character code your admin sent you to unlock your team's NeuroQuest experience.
                    </p>
                  </div>

                  <form onSubmit={handleLookup} className="space-y-4">
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="e.g. ABCD1234"
                      maxLength={12}
                      autoFocus
                      autoComplete="off"
                      autoCapitalize="characters"
                      className="w-full text-center text-2xl tracking-widest font-mono bg-white/5 border border-white/15 rounded-xl px-4 py-4 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 transition-colors"
                    />
                    <LuxuryButton type="submit" disabled={busy} className="w-full">
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4 ml-2" /></>}
                    </LuxuryButton>
                  </form>

                  <p className="text-xs text-muted-foreground text-center">
                    Don't have a code? <a href="/" className="text-primary hover:underline">Use NeuroQuest as an individual</a>
                  </p>
                </GlassCardContent>
              </GlassCard>
            </motion.div>
          )}

          {step === "details" && company && (
            <motion.div key="details" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <GlassCard>
                <GlassCardContent className="p-8 space-y-6">
                  <div className="text-center space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/30 text-emerald-300 text-xs font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Company found
                    </div>
                    <h1 className="font-serif text-2xl text-foreground">{company.company_name}</h1>
                    <p className="text-muted-foreground text-sm">Tell us a bit about you to finish joining.</p>
                  </div>

                  <form onSubmit={handleJoin} className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Jane Doe"
                        autoFocus
                        className="w-full mt-1 bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Work email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="jane@yourcompany.com"
                        className="w-full mt-1 bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Department <span className="opacity-50 normal-case">(optional)</span></label>
                      <input
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="Engineering, Sales, HR, ..."
                        className="w-full mt-1 bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60"
                      />
                    </div>
                    <LuxuryButton type="submit" disabled={busy} className="w-full mt-2">
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Join {company.company_name} <ArrowRight className="w-4 h-4 ml-2" /></>}
                    </LuxuryButton>
                    <button
                      type="button"
                      onClick={() => { setStep("code"); setCompany(null); }}
                      className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      ← Use a different code
                    </button>
                  </form>
                </GlassCardContent>
              </GlassCard>
            </motion.div>
          )}

          {step === "success" && company && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <GlassCard>
                <GlassCardContent className="p-8 space-y-6 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.1 }}
                    className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-400/15 border border-emerald-400/40"
                  >
                    <CheckCircle2 className="w-8 h-8 text-emerald-300" />
                  </motion.div>
                  <div className="space-y-2">
                    <h1 className="font-serif text-3xl text-foreground">You're in.</h1>
                    <p className="text-muted-foreground">
                      Welcome to <span className="text-foreground font-medium">{company.company_name}</span> on NeuroQuest.
                    </p>
                  </div>
                  <LuxuryButton onClick={() => navigate("/onboarding")} className="w-full">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Begin Your Journey
                  </LuxuryButton>
                </GlassCardContent>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
