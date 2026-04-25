import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth, useUser } from "@clerk/react";
import { motion } from "framer-motion";
import { Brain } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

const ONBOARDING_KEY = "nq_onboarding_done";
const WEARABLE_KEY = "nq_wearable_done";
export const ENTERPRISE_PROFILE_KEY = "nq_enterprise_profile";
export const CLAIMED_USER_KEY = "nq_claimed_user";

export interface ClaimedEnterprise {
  user_id: string;
  company_id: string;
  company_name: string | null;
  invite_code: string | null;
  role: string | null;
}

export interface ClaimedUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

export function getClaimedEnterprise(): ClaimedEnterprise | null {
  try {
    const raw = localStorage.getItem(ENTERPRISE_PROFILE_KEY);
    return raw ? (JSON.parse(raw) as ClaimedEnterprise) : null;
  } catch {
    return null;
  }
}

export function getClaimedUser(): ClaimedUser | null {
  try {
    const raw = localStorage.getItem(CLAIMED_USER_KEY);
    return raw ? (JSON.parse(raw) as ClaimedUser) : null;
  } catch {
    return null;
  }
}

/** Onboarding flag accepts both legacy "true" and canonical "1" values. */
function readOnboardingDone(): boolean {
  if (typeof window === "undefined") return false;
  const v = localStorage.getItem(ONBOARDING_KEY);
  return v === "1" || v === "true";
}

const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");

// Module-level dedupe so React StrictMode's mount→unmount→remount cycle
// (which re-creates component refs) cannot fire two concurrent claim
// requests for the same Clerk user. Stores the in-flight Promise so the
// second invocation awaits the first instead of re-issuing.
const claimInFlight = new Map<string, Promise<void>>();
// Module-level "already claimed" set so a successful claim isn't re-run
// on remount either.
const claimedUserIds = new Set<string>();

/**
 * Enforces the canonical web entry order:
 *   1) onboarding (focus test)
 *   2) Clerk sign-in
 *   3) wearable connect (manual entry on web)
 *   4) dashboard / protected app
 *
 * Also persists the user server-side immediately after sign-in by hitting
 * the claim-profile endpoint, which links Clerk to any matching enterprise
 * pilot membership for tracking and personalization.
 */
export function BootstrapGate({ children }: Props) {
  const [, navigate] = useLocation();
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [claiming, setClaiming] = useState(false);

  // Read flags fresh on every render — they may be set by other tabs/pages.
  const onboardingDone = readOnboardingDone();
  const wearableDone =
    typeof window !== "undefined" && localStorage.getItem(WEARABLE_KEY) === "1";

  // Step 1: onboarding gate
  useEffect(() => {
    if (!onboardingDone) {
      navigate("/onboarding", { replace: true });
    }
  }, [onboardingDone, navigate]);

  // Step 2: sign-in gate (only after Clerk has finished loading so we don't
  // bounce a momentarily-unauthenticated user)
  useEffect(() => {
    if (!onboardingDone) return;
    if (!isLoaded) return;
    if (!isSignedIn) {
      navigate("/sign-in", { replace: true });
    }
  }, [onboardingDone, isLoaded, isSignedIn, navigate]);

  // Step 2b: clear any stale identity caches when the user signs out.
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      try {
        localStorage.removeItem(ENTERPRISE_PROFILE_KEY);
        localStorage.removeItem(CLAIMED_USER_KEY);
      } catch {}
      // Module-level state must also reset so the next sign-in re-claims.
      claimedUserIds.clear();
      claimInFlight.clear();
    }
  }, [isLoaded, isSignedIn]);

  // Step 2c: persist the Clerk identity server-side (and link enterprise
  // membership if it exists) — re-fires whenever the active Clerk user id
  // changes (handles account-switching inside the same SPA session).
  // Only marks the user "claimed" on a successful response so a transient
  // network hiccup doesn't permanently skip the claim for the session.
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id) return;
    const userId = user.id;
    if (claimedUserIds.has(userId)) return;
    let cancelled = false;
    setClaiming(true);
    // Reuse an existing in-flight promise across StrictMode remounts so
    // we never issue a second concurrent POST for the same user.
    let promise = claimInFlight.get(userId);
    if (!promise) {
      promise = (async () => {
        const MAX_ATTEMPTS = 3;
        try {
          for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
              const res = await fetch(`${apiBase}/api/auth/claim-profile`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
              });
              if (res.ok) {
                const data = await res.json();
                try {
                  if (data?.user) {
                    localStorage.setItem(CLAIMED_USER_KEY, JSON.stringify(data.user));
                  }
                  if (data?.enterprise) {
                    localStorage.setItem(
                      ENTERPRISE_PROFILE_KEY,
                      JSON.stringify(data.enterprise),
                    );
                  } else {
                    // Explicitly clear stale enterprise cache when not linked.
                    localStorage.removeItem(ENTERPRISE_PROFILE_KEY);
                  }
                } catch {}
                claimedUserIds.add(userId);
                return;
              }
              // Non-2xx — backoff and retry.
            } catch {
              // Network error — backoff and retry.
            }
            if (attempt < MAX_ATTEMPTS) {
              await new Promise((r) => setTimeout(r, 200 * attempt * attempt));
            }
          }
        } finally {
          // Remove the in-flight slot; if it succeeded, claimedUserIds will
          // prevent a re-attempt. If it failed, a future render re-tries.
          claimInFlight.delete(userId);
        }
      })();
      claimInFlight.set(userId, promise);
    }
    promise.finally(() => {
      if (!cancelled) setClaiming(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, user?.id]);

  // Step 3: wearable gate (only after sign-in)
  useEffect(() => {
    if (!onboardingDone) return;
    if (!isLoaded || !isSignedIn) return;
    if (!wearableDone) {
      navigate("/wearable-setup", { replace: true });
    }
  }, [onboardingDone, isLoaded, isSignedIn, wearableDone, navigate]);

  // While Clerk is initializing or we're about to redirect, show a calm
  // brand-consistent loader instead of a flash of dashboard content.
  if (!isLoaded || !onboardingDone || (isLoaded && !isSignedIn) || !wearableDone) {
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
          <p className="text-sm text-muted-foreground font-medium">
            {claiming ? "Linking your account…" : "Preparing your journey…"}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
