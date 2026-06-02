import { useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Activity, Heart, Moon, Footprints, Cpu, ArrowRight } from "lucide-react";
import { LuxuryButton } from "@/components/ui/luxury-button";

const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");
const WEARABLE_KEY = "nq_wearable_done";
const WEARABLE_DATA_KEY = "nq_web_wearable";

interface NRSResult {
  neuro_resilience_score: number | null;
  classification: string | null;
}

async function computeScore(metrics: {
  hrv: number | null;
  sleep_hours: number | null;
  steps: number | null;
}): Promise<NRSResult> {
  try {
    const res = await fetch(`${apiBase}/api/quest/access-status`, {
      credentials: "include",
    });
    if (!res.ok) return { neuro_resilience_score: null, classification: null };
    return { neuro_resilience_score: null, classification: null };
  } catch {
    return { neuro_resilience_score: null, classification: null };
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

    setBusy(true);
    try {
      const res = await computeScore({ hrv: hrvNum, sleep_hours: sleepHrs, steps: stepsNum });
      try {
        localStorage.setItem(
          WEARABLE_DATA_KEY,
          JSON.stringify({
            hrv: hrvNum,
            sleep_hours: sleepHrs,
            steps: stepsNum,
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
                Your personal AI baseline is now tracking. The more you sync via the mobile app,
                the more NeuroQuest tailors itself to you.
              </p>
            </>
          ) : (
            <>
              <Activity className="w-12 h-12 text-primary mx-auto mb-4" />
              <h2 className="font-serif text-2xl font-bold text-white mb-3">
                Saved!
              </h2>
              <p className="text-sm text-white/60 leading-relaxed mb-6">
                Download the NeuroQuest mobile app to sync your wearable and track your
                Neuro-Resilience Score over time.
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
        </div>

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
          {busy ? "Saving…" : "Continue"}
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
