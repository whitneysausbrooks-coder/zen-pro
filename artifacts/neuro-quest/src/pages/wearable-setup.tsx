import { useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Activity, Heart, Moon, Footprints, Cpu, ArrowRight, Building2, CheckCircle2 } from "lucide-react";
import { LuxuryButton } from "@/components/ui/luxury-button";
import {
  getClaimedEnterprise,
  getClaimedUser,
  ENTERPRISE_PROFILE_KEY,
  type ClaimedEnterprise,
} from "@/components/bootstrap-gate";

const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");
const WEARABLE_KEY = "nq_wearable_done";
const WEARABLE_DATA_KEY = "nq_web_wearable";

interface NRSResult {
  neuro_resilience_score: number | null;
  classification: string | null;
}

async function computeScoreStateless(metrics: {
  hrv: number | null;
  sleep_duration: number | null;
  steps: number | null;
}): Promise<NRSResult> {
  try {
    const res = await fetch(`${apiBase}/api/enterprise/wearable/score`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metrics),
    });
    if (!res.ok) return { neuro_resilience_score: null, classification: null };
    const data = await res.json();
    return {
      neuro_resilience_score: data?.neuro_resilience_score ?? null,
      classification: data?.classification ?? null,
    };
  } catch {
    return { neuro_resilience_score: null, classification: null };
  }
}

async function syncEnterprise(
  email: string,
  inviteCode: string,
  metrics: { hrv: number | null; sleep_duration: number | null; steps: number | null },
): Promise<NRSResult & { error?: string }> {
  try {
    const res = await fetch(`${apiBase}/api/wearable/sync`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        invite_code: inviteCode,
        source: "manual",
        ...metrics,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        neuro_resilience_score: null,
        classification: null,
        error: data?.error || "Could not save to your team baseline.",
      };
    }
    return {
      neuro_resilience_score: data?.neuro_resilience_score ?? null,
      classification: data?.classification ?? null,
    };
  } catch (e: any) {
    return {
      neuro_resilience_score: null,
      classification: null,
      error: e?.message || "Network error.",
    };
  }
}

export default function WearableSetup() {
  const [, navigate] = useLocation();
  const [hrv, setHrv] = useState("");
  const [sleep, setSleep] = useState("");
  const [steps, setSteps] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NRSResult | null>(null);

  // Live enterprise state — starts from cached value but updates after a
  // successful invite-code join below so the user sees the connection badge
  // and so /api/wearable/sync gets called on the very next submit.
  const [enterprise, setEnterprise] = useState<ClaimedEnterprise | null>(
    getClaimedEnterprise(),
  );
  const [inviteCode, setInviteCode] = useState("");
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

  const onJoinCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    setJoinSuccess(null);
    const code = inviteCode.trim().toUpperCase();
    if (code.length < 4) {
      setJoinError("Enter the company code from your admin (4-12 characters).");
      return;
    }
    // Pull the verified email from the claim cache; if missing, ask /auth/user.
    let email = getClaimedUser()?.email ?? null;
    if (!email) {
      try {
        const meRes = await fetch(`${apiBase}/api/auth/user`, {
          credentials: "include",
        });
        const me = meRes.ok ? await meRes.json() : null;
        email = (me?.user?.email as string | null) ?? null;
      } catch {}
    }
    if (!email) {
      setJoinError("We couldn't read your account email. Please refresh and try again.");
      return;
    }
    const idpSubject = getClaimedUser()?.id ?? undefined;
    setJoinBusy(true);
    try {
      const res = await fetch(`${apiBase}/api/enterprise/join`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_code: code, email, idp_subject: idpSubject }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data?.error || "Could not connect to that company.");
        return;
      }
      // Refresh the BootstrapGate cache so the rest of the app sees the
      // enterprise membership immediately (this also unlocks premium
      // features via /api/quest/access-status on the next render).
      try {
        const claim = await fetch(`${apiBase}/api/auth/claim-profile`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (claim.ok) {
          const cdata = await claim.json();
          if (cdata?.enterprise) {
            try {
              localStorage.setItem(
                ENTERPRISE_PROFILE_KEY,
                JSON.stringify(cdata.enterprise),
              );
            } catch {}
            setEnterprise(cdata.enterprise as ClaimedEnterprise);
          }
        }
      } catch {}
      // Optimistic fallback if claim-profile didn't return enterprise yet.
      setEnterprise((prev) =>
        prev ?? {
          user_id: data.user_id,
          company_id: data.company_id,
          company_name: data.company_name ?? null,
          invite_code: code,
          role: data.role ?? "employee",
        },
      );
      setJoinSuccess(`Connected to ${data.company_name ?? "your company"}.`);
      setInviteCode("");
    } catch (err: any) {
      setJoinError(err?.message || "Network error. Please try again.");
    } finally {
      setJoinBusy(false);
    }
  };

  const onSubmit = async () => {
    setError(null);
    const hrvNum = hrv.trim() ? Number(hrv.trim()) : null;
    const sleepHrs = sleep.trim() ? Number(sleep.trim()) : null;
    const stepsNum = steps.trim() ? Number(steps.trim()) : null;

    if (
      (hrvNum != null && (!Number.isFinite(hrvNum) || hrvNum < 0 || hrvNum > 300)) ||
      (sleepHrs != null && (!Number.isFinite(sleepHrs) || sleepHrs < 0 || sleepHrs > 24)) ||
      (stepsNum != null && (!Number.isFinite(stepsNum) || stepsNum < 0 || stepsNum > 200000))
    ) {
      setError("Please check your numbers (HRV 0-300 ms, sleep 0-24 h, steps 0-200,000).");
      return;
    }
    if (hrvNum == null && sleepHrs == null && stepsNum == null) {
      setError("Enter at least one of HRV, sleep, or steps.");
      return;
    }

    const sleepMinutes = sleepHrs != null ? Math.round(sleepHrs * 60) : null;
    const metrics = {
      hrv: hrvNum,
      sleep_duration: sleepMinutes,
      steps: stepsNum != null ? Math.round(stepsNum) : null,
    };

    setBusy(true);
    try {
      let res: NRSResult & { error?: string };
      if (enterprise && enterprise.invite_code) {
        // Source of truth for the verified email is the claim-profile cache
        // (which falls back to Clerk REST when JWT claims omit it). Only
        // hit /api/auth/user if cache is empty.
        let email = getClaimedUser()?.email ?? null;
        if (!email) {
          try {
            const meRes = await fetch(`${apiBase}/api/auth/user`, {
              credentials: "include",
            });
            const me = meRes.ok ? await meRes.json() : null;
            email = (me?.user?.email as string | null) ?? null;
          } catch {}
        }
        if (!email) {
          // Fall back to stateless score if we cannot resolve identity.
          res = await computeScoreStateless(metrics);
        } else {
          res = await syncEnterprise(email, enterprise.invite_code, metrics);
          if (res.error && res.neuro_resilience_score == null) {
            // Enterprise sync failed; still compute a personal score so the
            // user sees their result, just don't push to the team baseline.
            const fallback = await computeScoreStateless(metrics);
            res = { ...fallback };
          }
        }
      } else {
        res = await computeScoreStateless(metrics);
      }

      try {
        localStorage.setItem(
          WEARABLE_DATA_KEY,
          JSON.stringify({
            ...metrics,
            sleep_hours: sleepHrs,
            recorded_at: new Date().toISOString(),
            ...res,
          }),
        );
      } catch {}
      setResult(res);
    } finally {
      setBusy(false);
    }
  };

  const onContinue = () => {
    try {
      localStorage.setItem(WEARABLE_KEY, "1");
    } catch {}
    navigate("/", { replace: true });
  };

  const onSkip = () => {
    try {
      localStorage.setItem(WEARABLE_KEY, "1");
    } catch {}
    navigate("/", { replace: true });
  };

  if (result) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-10 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-radial from-primary/8 via-transparent to-transparent pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md rounded-3xl border border-primary/30 bg-[#0D1A10]/90 backdrop-blur-2xl p-8 text-center"
        >
          {result.neuro_resilience_score != null ? (
            <>
              <p className="text-[10px] uppercase tracking-widest text-white/50 mb-3">
                Your Neuro-Resilience Score
              </p>
              <p className="font-serif text-7xl font-bold text-gradient-gold leading-none mb-2">
                {result.neuro_resilience_score}
              </p>
              {result.classification ? (
                <p className="text-sm uppercase tracking-widest text-white/60 mb-5">
                  {result.classification}
                </p>
              ) : null}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 mb-6">
                <Cpu className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">
                  AI baseline learning started
                </span>
              </div>
              <p className="text-sm text-white/60 leading-relaxed mb-6">
                Your personal AI baseline is now tracking. The more you sync,
                the more NeuroQuest tailors itself to you.
              </p>
            </>
          ) : (
            <>
              <Activity className="w-12 h-12 text-primary mx-auto mb-4" />
              <h2 className="font-serif text-2xl font-bold text-white mb-3">
                Saved on this device
              </h2>
              <p className="text-sm text-white/60 leading-relaxed mb-6">
                Your data is stored locally for now. Sign in with a pilot
                invite code to sync to your team baseline.
              </p>
            </>
          )}
          <LuxuryButton onClick={onContinue} className="w-full gap-2 py-4">
            Enter NeuroQuest
            <ArrowRight className="w-4 h-4" />
          </LuxuryButton>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-radial from-primary/8 via-transparent to-transparent pointer-events-none" />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md rounded-3xl border border-white/12 bg-[#0D1A10]/90 backdrop-blur-2xl p-8"
      >
        <div className="text-center mb-6">
          <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-400 font-semibold mb-2">
            Step 3 of 3
          </p>
          <h1 className="font-serif text-3xl font-bold text-white mb-3">
            Your Health Snapshot
          </h1>
          <p className="text-sm text-white/60 leading-relaxed">
            NeuroQuest learns your personal baseline from HRV, sleep, and steps.
            Add what you know — even one number is enough to get started.
          </p>
          {enterprise?.company_name ? (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary/80">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Connected to <span className="font-semibold">{enterprise.company_name}</span> pilot
            </p>
          ) : null}
        </div>

        {!enterprise ? (
          <div className="mb-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-primary" />
              <p className="text-xs uppercase tracking-wider text-primary font-semibold">
                Have a company code?
              </p>
            </div>
            <p className="text-xs text-white/60 mb-3">
              Enter your team's invite code to unlock premium features and sync to your company baseline.
            </p>
            <form onSubmit={onJoinCompany} className="flex gap-2">
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => {
                  setInviteCode(e.target.value.toUpperCase());
                  setJoinError(null);
                  setJoinSuccess(null);
                }}
                placeholder="ABCD1234"
                maxLength={12}
                disabled={joinBusy}
                className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-primary/20 text-white placeholder-white/30 font-mono tracking-wider uppercase text-sm focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={joinBusy || inviteCode.trim().length < 4}
                className="px-4 py-2 rounded-lg bg-primary/15 border border-primary/30 text-primary text-xs font-semibold uppercase tracking-wider hover:bg-primary/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {joinBusy ? "Connecting…" : "Connect"}
              </button>
            </form>
            {joinError ? (
              <p className="mt-2 text-xs text-rose-300">{joinError}</p>
            ) : null}
            {joinSuccess ? (
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-300">
                <CheckCircle2 className="w-3 h-3" /> {joinSuccess}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-4">
          <Field
            icon={<Heart className="w-4 h-4 text-rose-400" />}
            label="HRV (ms)"
            placeholder="e.g. 45"
            value={hrv}
            onChange={(v) => {
              setHrv(v);
              setError(null);
            }}
          />
          <Field
            icon={<Moon className="w-4 h-4 text-indigo-300" />}
            label="Sleep (hours)"
            placeholder="e.g. 7.5"
            value={sleep}
            onChange={(v) => {
              setSleep(v);
              setError(null);
            }}
          />
          <Field
            icon={<Footprints className="w-4 h-4 text-emerald-300" />}
            label="Steps today"
            placeholder="e.g. 8200"
            value={steps}
            onChange={(v) => {
              setSteps(v);
              setError(null);
            }}
            integer
          />
        </div>

        {error ? (
          <p className="mt-4 text-sm text-rose-300 text-center">{error}</p>
        ) : null}

        <LuxuryButton
          onClick={onSubmit}
          disabled={busy}
          className="w-full mt-6 gap-2 py-4 text-base"
        >
          {busy ? "Calculating…" : "See My Resilience Score"}
        </LuxuryButton>

        <button
          onClick={onSkip}
          disabled={busy}
          className="w-full mt-3 py-3 text-sm text-white/50 hover:text-white/70 transition-colors disabled:opacity-50"
        >
          Skip for now
        </button>
      </motion.div>
    </div>
  );
}

function Field({
  icon,
  label,
  placeholder,
  value,
  onChange,
  integer = false,
}: {
  icon: React.ReactNode;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  integer?: boolean;
}) {
  return (
    <div>
      <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/60 font-semibold mb-2">
        {icon}
        {label}
      </label>
      <input
        type="text"
        inputMode={integer ? "numeric" : "decimal"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-primary/20 text-white placeholder-white/30 focus:outline-none focus:border-primary/50 transition-colors"
      />
    </div>
  );
}
