import { useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Brain } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

const ONBOARDING_KEY = "nq_onboarding_done";
const WEARABLE_KEY = "nq_wearable_done";

function readOnboardingDone(): boolean {
  if (typeof window === "undefined") return false;
  const v = localStorage.getItem(ONBOARDING_KEY);
  return v === "1" || v === "true";
}

export function BootstrapGate({ children }: Props) {
  const [, navigate] = useLocation();

  const onboardingDone = readOnboardingDone();
  const wearableDone =
    typeof window !== "undefined" && localStorage.getItem(WEARABLE_KEY) === "1";

  useEffect(() => {
    if (!onboardingDone) {
      navigate("/onboarding", { replace: true });
    }
  }, [onboardingDone, navigate]);

  useEffect(() => {
    if (!onboardingDone) return;
    if (!wearableDone) {
      navigate("/wearable-setup", { replace: true });
    }
  }, [onboardingDone, wearableDone, navigate]);

  if (!onboardingDone || !wearableDone) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-radial from-primary/6 via-transparent to-transparent pointer-events-none" />
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/15 border border-primary/30"
          >
            <Brain className="w-8 h-8 text-primary" />
          </motion.div>
          <p className="text-sm text-muted-foreground font-medium">Preparing your journey…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
