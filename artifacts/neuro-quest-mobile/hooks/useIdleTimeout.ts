import { useCallback, useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { recordAuthEvent } from "@/lib/userAuth";

/**
 * Idle-timeout hook (Whitney sprint G2 / 1.5).
 *
 * Returns a `bumpActivity` function that the caller wires into a top-level
 * touch listener — every screen tap / scroll / press resets the timer.
 *
 * On expiry:
 *   1. Records a `session_timeout` auth event (best-effort, fire-and-forget)
 *      so the audit trail captures the cause of the sign-out.
 *   2. Calls `onTimeout()` — the caller is expected to wipe credentials and
 *      reset the navigation state machine to sign-in.
 *
 * App backgrounding does NOT bump activity — if the user backgrounds the app
 * for longer than the timeout window, they'll be signed out on the next
 * foreground. AppState transitions to "active" trigger a single check rather
 * than a reset.
 */
export function useIdleTimeout(args: {
  enabled: boolean;
  timeoutMs?: number;
  onTimeout: () => void;
}) {
  const { enabled, timeoutMs = 10 * 60 * 1000, onTimeout } = args;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const onTimeoutRef = useRef(onTimeout);
  // One-shot guard: the timer and the AppState foreground-check can both
  // race to call `fireTimeout`. Without this, a single idle window would
  // emit two `session_timeout` audit rows AND call the sign-out callback
  // twice, briefly returning the user to the previous screen.
  const firedRef = useRef(false);

  // Keep the latest callback in a ref so we don't have to re-arm the timer
  // every time the parent re-renders (which would defeat the timeout).
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  const fireTimeout = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // Best-effort audit record. Never blocks the sign-out.
    void recordAuthEvent("session_timeout");
    try {
      onTimeoutRef.current();
    } catch {
      // Caller errors must not crash the app — surfaced via ErrorBoundary.
    }
  }, []);

  const bumpActivity = useCallback(() => {
    if (!enabled) return;
    if (firedRef.current) return; // already timed out, don't re-arm
    lastActivityRef.current = Date.now();
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(fireTimeout, timeoutMs);
  }, [enabled, timeoutMs, fireTimeout]);

  // Arm / disarm the timer when `enabled` flips. Also re-arms whenever the
  // timeout window changes (e.g. config-driven in the future).
  useEffect(() => {
    if (!enabled) {
      // Re-arm on next sign-in: clear the one-shot latch and any pending
      // timer so a fresh authenticated session starts with a clean slate.
      firedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      return;
    }
    bumpActivity();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [enabled, bumpActivity]);

  // On app foregrounding, check whether the cumulative idle window has
  // already exceeded the timeout (background time counts) and fire if so.
  useEffect(() => {
    if (!enabled) return;
    const handleStateChange = (state: AppStateStatus) => {
      if (state === "active") {
        const idleFor = Date.now() - lastActivityRef.current;
        if (idleFor >= timeoutMs) {
          fireTimeout();
        } else {
          bumpActivity();
        }
      }
    };
    const sub = AppState.addEventListener("change", handleStateChange);
    return () => sub.remove();
  }, [enabled, timeoutMs, fireTimeout, bumpActivity]);

  return { bumpActivity };
}
