import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  GlassCardTitle,
} from "@/components/ui/glass-card";

type Resp = 0 | 25 | 50 | 75 | 100;

const QUESTIONS: string[] = [
  "How often do you feel tired?",
  "How often are you physically exhausted?",
  "How often are you emotionally exhausted?",
  "How often do you think: 'I can't take it anymore'?",
  "How often do you feel worn out?",
  "How often do you feel weak and susceptible to illness?",
];

const OPTIONS: { label: string; value: Resp }[] = [
  { label: "Always", value: 100 },
  { label: "Often", value: 75 },
  { label: "Sometimes", value: 50 },
  { label: "Seldom", value: 25 },
  { label: "Never", value: 0 },
];

type SubmitResult = {
  total_score: number;
  severity: "low" | "mild" | "moderate" | "severe";
  algorithm_risk_at_time: number | null;
  interpretation: string;
};

function getApiBase(): string {
  const base = import.meta.env.BASE_URL || "/";
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function getUserIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("user_id");
  return id && id.trim().length > 0 ? id : null;
}

export default function CbiPage() {
  const [, navigate] = useLocation();
  const [answers, setAnswers] = useState<(Resp | null)[]>(Array(6).fill(null));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    setUserId(getUserIdFromUrl());
  }, []);

  const allAnswered = useMemo(() => answers.every((a) => a !== null), [answers]);
  const previewScore = useMemo(() => {
    const valid = answers.filter((a): a is Resp => a !== null);
    if (valid.length === 0) return 0;
    return Math.round((valid.reduce((s, v) => s + v, 0) / valid.length) * 10) / 10;
  }, [answers]);

  async function submit() {
    if (!userId) {
      setError(
        "Missing user_id in URL. Open this page from the link in your wellness check email or in the app.",
      );
      return;
    }
    if (!allAnswered) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBase()}/api/cbi/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          q1: answers[0],
          q2: answers[1],
          q3: answers[2],
          q4: answers[3],
          q5: answers[4],
          q6: answers[5],
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Submission failed (${res.status})`);
      }
      const data = (await res.json()) as SubmitResult;
      setResult(data);
    } catch (e: any) {
      setError(e.message || "Could not submit your responses. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden pb-16">
      <div
        className="absolute inset-0 z-0 opacity-40 mix-blend-overlay pointer-events-none bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/zen-bg.png)` }}
      />

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 pt-10">
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-white/70 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft size={18} /> Back
        </motion.button>

        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl sm:text-4xl font-bold text-white mb-2"
        >
          5-Minute Wellness Check
        </motion.h1>
        <p className="text-white/70 mb-6">
          Copenhagen Burnout Inventory — Personal Burnout subscale (Kristensen et al.,
          2005). Six questions. Helps us validate that the Neuro Resilience Score is
          tracking what you actually feel.
        </p>

        {result ? (
          <ResultPanel result={result} onDone={() => navigate("/")} />
        ) : (
          <>
            {QUESTIONS.map((q, i) => (
              <GlassCard key={i} className="mb-4">
                <GlassCardHeader>
                  <GlassCardTitle className="text-white text-base">
                    {i + 1}. {q}
                  </GlassCardTitle>
                </GlassCardHeader>
                <GlassCardContent>
                  <div className="flex flex-wrap gap-2">
                    {OPTIONS.map((opt) => {
                      const selected = answers[i] === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            const next = [...answers];
                            next[i] = opt.value;
                            setAnswers(next);
                          }}
                          className={`px-4 py-2 rounded-full text-sm transition-all border ${
                            selected
                              ? "bg-emerald-500/80 text-white border-emerald-300"
                              : "bg-white/10 text-white/80 border-white/20 hover:bg-white/20"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </GlassCardContent>
              </GlassCard>
            ))}

            {!userId && (
              <p className="text-amber-300 text-sm mb-3">
                Tip: open this page using the personal link in your wellness check email so
                your responses can be linked to your account.
              </p>
            )}
            {error && <p className="text-red-300 text-sm mb-3">{error}</p>}

            <div className="flex items-center justify-between gap-4 mt-6">
              <div className="text-white/60 text-sm">
                {allAnswered
                  ? `Preview score: ${previewScore} / 100`
                  : `${answers.filter((a) => a !== null).length} of 6 answered`}
              </div>
              <button
                type="button"
                disabled={!allAnswered || submitting || !userId}
                onClick={submit}
                className={`px-6 py-3 rounded-full font-semibold transition-all ${
                  allAnswered && !submitting && userId
                    ? "bg-emerald-500 hover:bg-emerald-400 text-white"
                    : "bg-white/10 text-white/40 cursor-not-allowed"
                }`}
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </div>

            <p className="text-white/40 text-xs mt-8 leading-relaxed">
              CBI is a Creative Commons clinical screening tool, not a diagnosis. Results
              are stored against your account to validate the Neuro Resilience Score over
              time. Severe scores warrant a conversation with a healthcare provider.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function ResultPanel({ result, onDone }: { result: SubmitResult; onDone: () => void }) {
  const sevColor =
    result.severity === "severe"
      ? "text-red-300"
      : result.severity === "moderate"
        ? "text-amber-300"
        : result.severity === "mild"
          ? "text-yellow-200"
          : "text-emerald-300";

  return (
    <GlassCard>
      <GlassCardHeader>
        <GlassCardTitle className="text-white flex items-center gap-2">
          <CheckCircle2 size={20} className="text-emerald-300" />
          Recorded
        </GlassCardTitle>
      </GlassCardHeader>
      <GlassCardContent>
        <div className="text-white text-2xl font-bold mb-1">
          {result.total_score} / 100
        </div>
        <div className={`uppercase tracking-wide text-sm font-semibold mb-4 ${sevColor}`}>
          {result.severity} burnout symptoms
        </div>
        <p className="text-white/80 mb-4">{result.interpretation}</p>

        {result.algorithm_risk_at_time != null && (
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-4">
            <div className="text-white/60 text-xs uppercase tracking-wide mb-1">
              Algorithm reading at time of check
            </div>
            <div className="text-white text-lg">
              Burnout risk: {result.algorithm_risk_at_time.toFixed(1)} / 100
            </div>
            <div className="text-white/50 text-xs mt-1">
              Logged so we can validate whether the algorithm tracks how you actually
              feel. The more checks you complete, the more useful the comparison.
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onDone}
          className="mt-2 px-6 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold"
        >
          Done
        </button>
      </GlassCardContent>
    </GlassCard>
  );
}
