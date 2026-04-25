import { Platform, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface WearableMetrics {
  hrv: number | null;
  sleep_duration_minutes: number | null;
  steps: number | null;
  recorded_at: string;
}

export interface SyncResult {
  success: boolean;
  neuro_resilience_score?: number;
  classification?: string;
  message?: string;
}

const EMAIL_KEY = "nq_enterprise_email";
const INVITE_KEY = "nq_enterprise_invite_code";
const LAST_SYNC_KEY = "nq_health_last_sync";
const LOGIN_DONE_KEY = "nq_login_done";
const HEALTH_CHOICE_KEY = "nq_health_choice";

export type LoginMode = "enterprise" | "individual";
export type HealthChoice = "apple_health" | "manual" | "skipped";

export async function getLoginMode(): Promise<LoginMode | null> {
  try {
    const v = await AsyncStorage.getItem(LOGIN_DONE_KEY);
    return v === "enterprise" || v === "individual" ? v : null;
  } catch {
    return null;
  }
}

export async function setLoginMode(mode: LoginMode): Promise<void> {
  try {
    await AsyncStorage.setItem(LOGIN_DONE_KEY, mode);
  } catch {}
}

export async function getHealthChoice(): Promise<HealthChoice | null> {
  try {
    const v = await AsyncStorage.getItem(HEALTH_CHOICE_KEY);
    return v === "apple_health" || v === "manual" || v === "skipped" ? v : null;
  } catch {
    return null;
  }
}

export async function setHealthChoice(choice: HealthChoice): Promise<void> {
  try {
    await AsyncStorage.setItem(HEALTH_CHOICE_KEY, choice);
  } catch {}
}

/**
 * Sync user-entered health metrics. Used when the user opted for manual
 * entry instead of (or in addition to) Apple Health.
 *  - hrv: milliseconds (e.g. 45)
 *  - sleep_hours: hours (e.g. 7.5) — converted to minutes server-side schema
 *  - steps: integer
 * Any field can be null; at least one must be provided.
 * For individual (non-enterprise) users without an invite code, the
 * function persists locally only and reports success without server sync.
 */
export async function syncManualMetrics(
  email: string,
  inviteCode: string | null,
  data: { hrv: number | null; sleep_hours: number | null; steps: number | null },
): Promise<SyncResult> {
  const { hrv, sleep_hours, steps } = data;
  if (hrv == null && sleep_hours == null && steps == null) {
    return { success: false, message: "Enter at least one of HRV, sleep, or steps." };
  }

  // Defense-in-depth: refuse server sync unless the user is in enterprise
  // login mode. Prevents stale enterprise credentials from leaking under a
  // new individual user on the same device.
  const mode = await getLoginMode();
  if (mode !== "enterprise") {
    await setLastSyncAt();
    return {
      success: true,
      message:
        "Saved on this device. Sign in as a pilot member to sync to your team baseline.",
    };
  }

  if (!email.trim() || !inviteCode || !inviteCode.trim()) {
    await setLastSyncAt();
    return {
      success: true,
      message:
        "Saved on this device. Sign in with your work email + invite code to sync to your team baseline.",
    };
  }

  const sleep_duration =
    sleep_hours != null ? Math.max(0, Math.min(1440, Math.round(sleep_hours * 60))) : null;

  try {
    const res = await fetch(`${getApiBase()}/api/wearable/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        invite_code: inviteCode.trim().toUpperCase(),
        source: "manual",
        hrv,
        sleep_duration,
        steps,
        recorded_at: new Date().toISOString(),
      }),
    });
    const resData = await res.json().catch(() => ({}));
    if (!res.ok || !resData.success) {
      return { success: false, message: resData.error || `Server returned ${res.status}` };
    }
    await setLastSyncAt();
    return {
      success: true,
      neuro_resilience_score: resData.neuro_resilience_score,
      classification: resData.classification,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Network error" };
  }
}

export const isHealthKitAvailable = Platform.OS === "ios";

/**
 * Open the iOS Settings page for this app, where the user can grant or
 * revoke HealthKit permissions. iOS HealthKit's authorization API is
 * intentionally opaque — we cannot detect denial directly, so we offer
 * this one-tap path to Settings whenever a sync returns no data.
 */
export async function openAppSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    try {
      await Linking.openURL("app-settings:");
    } catch {}
  }
}

function getApiBase(): string {
  return Platform.OS === "web"
    ? ""
    : `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
}

export async function getStoredEmail(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(EMAIL_KEY);
  } catch {
    return null;
  }
}

export async function setStoredEmail(email: string): Promise<void> {
  try {
    await AsyncStorage.setItem(EMAIL_KEY, email.trim().toLowerCase());
  } catch {}
}

export async function getStoredInviteCode(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(INVITE_KEY);
  } catch {
    return null;
  }
}

export async function setStoredInviteCode(code: string): Promise<void> {
  try {
    await AsyncStorage.setItem(INVITE_KEY, code.trim().toUpperCase());
  } catch {}
}

export async function clearStoredCredentials(): Promise<void> {
  try {
    await AsyncStorage.removeItem(EMAIL_KEY);
    await AsyncStorage.removeItem(INVITE_KEY);
  } catch {}
}

// Subscribers that want to be notified when the device is signed out
// (so they can reset in-memory onboarding state without an app restart).
const signOutListeners = new Set<() => void>();

/**
 * Subscribe to sign-out events. Returns an unsubscribe function.
 * Used by the root layout to re-render the onboarding state machine.
 */
export function onSignOut(cb: () => void): () => void {
  signOutListeners.add(cb);
  return () => {
    signOutListeners.delete(cb);
  };
}

/**
 * Atomically clear credentials, login mode, and health choice so the
 * onboarding state machine restarts at sign-in. Used by the Profile
 * "Switch Account" action and after account deletion. This is the ONLY
 * supported way to hand a device off to a different user.
 */
export async function signOutAndReset(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      EMAIL_KEY,
      INVITE_KEY,
      LOGIN_DONE_KEY,
      HEALTH_CHOICE_KEY,
    ]);
  } catch {}
  signOutListeners.forEach((cb) => {
    try {
      cb();
    } catch {}
  });
}

export interface DeleteAccountResult {
  serverDeleted: boolean;
  recordsRemoved?: Record<string, number>;
  message?: string;
  error?: string;
}

export async function deleteAccount(): Promise<DeleteAccountResult> {
  const email = await getStoredEmail();
  const inviteCode = await getStoredInviteCode();
  if (!email || !inviteCode) {
    return { serverDeleted: false, message: "No enterprise account on file. Local data cleared." };
  }
  try {
    const res = await fetch(`${getApiBase()}/api/account/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, invite_code: inviteCode }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { serverDeleted: false, error: data?.error || `Delete failed (HTTP ${res.status})` };
    }
    return { serverDeleted: true, recordsRemoved: data?.records_removed, message: data?.message };
  } catch (e: any) {
    return { serverDeleted: false, error: e?.message || "Network error during account deletion." };
  }
}

export async function getLastSyncAt(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

async function setLastSyncAt(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch {}
}

const HRV_TYPE = "HKQuantityTypeIdentifierHeartRateVariabilitySDNN";
const STEPS_TYPE = "HKQuantityTypeIdentifierStepCount";
const SLEEP_TYPE = "HKCategoryTypeIdentifierSleepAnalysis";

/**
 * Request HealthKit read permissions for HRV, sleep, and steps.
 * Tries the @kingstinct/react-native-healthkit v14 object signature first,
 * falling back to the legacy positional-array signature if needed.
 */
export async function requestHealthPermissions(): Promise<boolean> {
  if (!isHealthKitAvailable) return false;
  try {
    const HealthKit: any = require("@kingstinct/react-native-healthkit");
    const reads = [HRV_TYPE, STEPS_TYPE, SLEEP_TYPE];
    const requestAuth = HealthKit.requestAuthorization ?? HealthKit.default?.requestAuthorization;
    if (!requestAuth) throw new Error("requestAuthorization not exported");
    try {
      await requestAuth({ toShare: [], toRead: reads });
    } catch {
      await requestAuth(reads, []);
    }
    return true;
  } catch (e) {
    console.warn("HealthKit permission error:", e);
    return false;
  }
}

/**
 * Run a HealthKit sample query supporting both the v14 filter-shape
 * and the older positional date-range shape.
 */
async function runQuery(
  HealthKit: any,
  fnName: "queryQuantitySamples" | "queryCategorySamples",
  identifier: string,
  startDate: Date,
  endDate: Date,
  limit?: number,
): Promise<any[]> {
  const fn = HealthKit[fnName] ?? HealthKit.default?.[fnName];
  if (!fn) return [];
  try {
    const opts: any = { filter: { date: { startDate, endDate } } };
    if (limit) opts.limit = limit;
    const r = await fn(identifier, opts);
    if (Array.isArray(r)) return r;
    if (Array.isArray(r?.samples)) return r.samples;
  } catch {}
  try {
    const r = await fn(identifier, { from: startDate, to: endDate, limit });
    if (Array.isArray(r)) return r;
    if (Array.isArray(r?.samples)) return r.samples;
  } catch {}
  return [];
}

/** HealthKit sleep enum: 1=asleepUnspecified, 3=asleepCore, 4=asleepDeep, 5=asleepREM. */
const ASLEEP_NUMERIC = new Set([1, 3, 4, 5]);
function isAsleepSample(s: any): boolean {
  const raw = s?.value;
  if (typeof raw === "number") return ASLEEP_NUMERIC.has(raw);
  const str = String(raw ?? "").toLowerCase();
  return str.includes("asleep");
}

/**
 * Read the most recent 24h of HRV, sleep, and step data from HealthKit.
 * Sleep intervals are merged (de-overlapped) to avoid double-counting
 * staged sleep data (Apple Watch reports core/deep/REM as overlapping samples).
 */
export async function readLatestMetrics(): Promise<WearableMetrics> {
  const now = new Date();

  if (!isHealthKitAvailable) {
    return {
      hrv: null,
      sleep_duration_minutes: null,
      steps: null,
      recorded_at: now.toISOString(),
    };
  }

  const HealthKit: any = require("@kingstinct/react-native-healthkit");
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  let hrv: number | null = null;
  let sleepMinutes: number | null = null;
  let steps: number | null = null;

  try {
    const samples = await runQuery(HealthKit, "queryQuantitySamples", HRV_TYPE, yesterday, now, 50);
    const values = samples
      .map((s: any) => Number(s?.quantity ?? s?.value))
      .filter((n: number) => Number.isFinite(n) && n > 0);
    if (values.length) {
      hrv = values.reduce((a: number, b: number) => a + b, 0) / values.length;
    }
  } catch (e) {
    console.warn("HRV read error:", e);
  }

  try {
    const samples = await runQuery(HealthKit, "queryQuantitySamples", STEPS_TYPE, yesterday, now);
    if (samples.length) {
      steps = samples.reduce(
        (sum: number, s: any) => sum + Number(s?.quantity ?? s?.value ?? 0),
        0,
      );
    }
  } catch (e) {
    console.warn("Step read error:", e);
  }

  try {
    const samples = await runQuery(HealthKit, "queryCategorySamples", SLEEP_TYPE, yesterday, now);
    const intervals = samples
      .filter(isAsleepSample)
      .map((s: any) => {
        const start = new Date(s.startDate).getTime();
        const end = new Date(s.endDate).getTime();
        return [start, end] as [number, number];
      })
      .filter(([s, e]) => Number.isFinite(s) && Number.isFinite(e) && e > s)
      .sort((a, b) => a[0] - b[0]);

    let totalMs = 0;
    let cursorStart = 0;
    let cursorEnd = 0;
    for (const [s, e] of intervals) {
      if (s > cursorEnd) {
        totalMs += cursorEnd - cursorStart;
        cursorStart = s;
        cursorEnd = e;
      } else if (e > cursorEnd) {
        cursorEnd = e;
      }
    }
    totalMs += cursorEnd - cursorStart;
    if (totalMs > 0) sleepMinutes = Math.round(totalMs / 60000);
  } catch (e) {
    console.warn("Sleep read error:", e);
  }

  return {
    hrv: hrv != null ? Math.round(hrv * 100) / 100 : null,
    sleep_duration_minutes: sleepMinutes,
    steps: steps != null ? Math.round(steps) : null,
    recorded_at: now.toISOString(),
  };
}

/**
 * Send the latest HealthKit metrics to the NeuroQuest server.
 * Identity is verified by BOTH the user's work email AND their company
 * invite code, which only legitimate pilot members possess.
 */
export async function syncToServer(
  email: string,
  inviteCode: string,
  metrics: WearableMetrics,
): Promise<SyncResult> {
  if (!email.trim()) return { success: false, message: "Work email is required" };
  if (!inviteCode.trim()) return { success: false, message: "Company invite code is required" };
  // Defense-in-depth: only enterprise-mode users may sync to the server.
  // Stale credentials left on a shared device must not silently submit data
  // under a previous user's identity.
  const mode = await getLoginMode();
  if (mode !== "enterprise") {
    return {
      success: false,
      message: "Sign in as a pilot member to sync to your team baseline.",
    };
  }
  if (
    metrics.hrv == null &&
    metrics.sleep_duration_minutes == null &&
    metrics.steps == null
  ) {
    return {
      success: false,
      message:
        "We couldn't read any health data. This usually means Apple Health permissions weren't fully granted, or your device hasn't recorded HRV, sleep, or steps recently. Open Settings to grant access, or wear your Apple Watch overnight and try again.",
    };
  }

  try {
    const res = await fetch(`${getApiBase()}/api/wearable/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        invite_code: inviteCode.trim().toUpperCase(),
        source: "apple_health",
        hrv: metrics.hrv,
        sleep_duration: metrics.sleep_duration_minutes,
        steps: metrics.steps,
        recorded_at: metrics.recorded_at,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, message: data.error || `Server returned ${res.status}` };
    }
    await setLastSyncAt();
    return {
      success: true,
      neuro_resilience_score: data.neuro_resilience_score,
      classification: data.classification,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Network error" };
  }
}
