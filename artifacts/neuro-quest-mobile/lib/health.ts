import { Platform, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getStoredUserId } from "./userAuth";

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
export type HealthChoice = "apple_health" | "health_connect" | "manual" | "skipped";

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
    return v === "apple_health" || v === "health_connect" || v === "manual" || v === "skipped"
      ? v
      : null;
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

  const mode = await getLoginMode();

  // Individual mode: sync to the personal AI baseline endpoint, which records
  // the session against this device's UUID and returns the freshly computed
  // Neuro-Resilience Score + EMA-7 trend. No enterprise credentials needed.
  if (mode === "individual") {
    const userId = await getStoredUserId();
    if (!userId) {
      await setLastSyncAt();
      return {
        success: true,
        message: "Saved on this device. We'll sync once your account finishes setup.",
      };
    }
    try {
      const res = await fetch(`${getApiBase()}/api/app-user/biometrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          hrv,
          sleep_hours,
          steps,
          data_source: "manual",
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

  // Defense-in-depth: refuse the enterprise sync path unless the user is in
  // enterprise login mode. Prevents stale enterprise credentials from leaking
  // under a new individual user on the same device.
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
export const isHealthConnectAvailable = Platform.OS === "android";
/**
 * True on iOS (HealthKit) and Android (Health Connect). False on web.
 * Use this for UI gating instead of `isHealthKitAvailable` so Samsung,
 * Pixel, and other Android wearables (Galaxy Watch, Wear OS, Fitbit-on-
 * Android, etc.) can connect via Health Connect.
 */
export const isHealthAvailable = isHealthKitAvailable || isHealthConnectAvailable;
/**
 * Human-readable name of the native health provider for the current OS.
 * iOS → "Apple Health"; Android → "Health Connect"; web → "Apple Health"
 * (web only ever shows the iPhone-required note, so the iOS label is fine).
 */
export const healthProviderLabel: "Apple Health" | "Health Connect" =
  isHealthConnectAvailable ? "Health Connect" : "Apple Health";

/**
 * Open the iOS Settings page for this app, where the user can grant or
 * revoke HealthKit permissions. iOS HealthKit's authorization API is
 * intentionally opaque — we cannot detect denial directly, so we offer
 * this one-tap path to Settings whenever a sync returns no data.
 *
 * On Android, opens the OS Settings (the user can find Health Connect
 * under Settings → Apps → Health Connect → Permissions).
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
async function requestHealthKitPermissions(): Promise<boolean> {
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
 * Request Android Health Connect read permissions for HRV, sleep, and steps.
 * Health Connect is the unified Android health data store — Samsung Health,
 * Fitbit-on-Android, Google Fit, Whoop-on-Android, and Pixel Watch all
 * write into Health Connect, so a single grant covers Galaxy Watch,
 * Wear OS, and most Android wearables.
 */
async function requestHealthConnectPermissions(): Promise<boolean> {
  if (!isHealthConnectAvailable) return false;
  try {
    const HC: any = require("react-native-health-connect");
    const initialized = await HC.initialize();
    if (!initialized) {
      console.warn("Health Connect: initialize() returned false");
      return false;
    }
    if (typeof HC.getSdkStatus === "function") {
      const status = await HC.getSdkStatus();
      const SDK_AVAILABLE = HC.SdkAvailabilityStatus?.SDK_AVAILABLE ?? 3;
      if (status !== SDK_AVAILABLE) {
        console.warn("Health Connect SDK not available; status:", status);
        return false;
      }
    }
    const requested = [
      { accessType: "read" as const, recordType: "HeartRateVariabilityRmssd" as const },
      { accessType: "read" as const, recordType: "SleepSession" as const },
      { accessType: "read" as const, recordType: "Steps" as const },
    ];
    const granted = await HC.requestPermission(requested);
    if (!Array.isArray(granted) || granted.length === 0) return false;
    // Health Connect returns the subset of permissions the user actually
    // granted. Treat the request as successful only when ALL three reads
    // are granted — partial grants should still surface as "not connected"
    // so the no-data error message can guide the user back to Settings.
    const grantedTypes = new Set(
      granted
        .map((g: any) => String(g?.recordType ?? ""))
        .filter((t: string) => t.length > 0),
    );
    return requested.every((r) => grantedTypes.has(r.recordType));
  } catch (e) {
    console.warn("Health Connect permission error:", e);
    return false;
  }
}

/**
 * Public entry point: request native health permissions on whichever
 * platform we're running on. Returns false on web (no native health).
 */
export async function requestHealthPermissions(): Promise<boolean> {
  if (isHealthKitAvailable) return requestHealthKitPermissions();
  if (isHealthConnectAvailable) return requestHealthConnectPermissions();
  return false;
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
 * Merge a list of [start,end] millisecond intervals, returning total
 * non-overlapping duration in ms. Used by both HealthKit and Health
 * Connect sleep readers to avoid double-counting overlapping stage
 * samples (e.g. Apple Watch reports core/deep/REM concurrently).
 */
function totalNonOverlappingMs(intervals: [number, number][]): number {
  intervals.sort((a, b) => a[0] - b[0]);
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
  return totalMs;
}

/**
 * Read the most recent 24h of HRV, sleep, and step data from HealthKit.
 * Sleep intervals are merged (de-overlapped) to avoid double-counting
 * staged sleep data (Apple Watch reports core/deep/REM as overlapping samples).
 */
async function readLatestMetricsFromHealthKit(): Promise<WearableMetrics> {
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
      .filter(([s, e]) => Number.isFinite(s) && Number.isFinite(e) && e > s);
    const totalMs = totalNonOverlappingMs(intervals);
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
 * Health Connect SleepSession stage codes. We treat all "asleep" stages
 * (light/deep/REM/asleep-unspecified) as sleep time. Awake (1) and
 * out-of-bed/unknown stages are excluded.
 *   1 = AWAKE, 2 = SLEEPING, 3 = OUT_OF_BED, 4 = LIGHT,
 *   5 = DEEP, 6 = REM, 0 = UNKNOWN, 7 = AWAKE_IN_BED
 */
const HC_ASLEEP_STAGES = new Set([2, 4, 5, 6]);

/**
 * Read the most recent 24h of HRV, sleep, and step data from Android
 * Health Connect. Mirrors the HealthKit reader: HRV is averaged across
 * RMSSD samples, steps are summed, sleep stages are merged across all
 * sessions to avoid double-counting overlapping stage records.
 */
async function readLatestMetricsFromHealthConnect(): Promise<WearableMetrics> {
  const now = new Date();
  if (!isHealthConnectAvailable) {
    return {
      hrv: null,
      sleep_duration_minutes: null,
      steps: null,
      recorded_at: now.toISOString(),
    };
  }

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  let hrv: number | null = null;
  let sleepMinutes: number | null = null;
  let steps: number | null = null;

  try {
    const HC: any = require("react-native-health-connect");
    await HC.initialize();
    const timeRangeFilter = {
      operator: "between",
      startTime: yesterday.toISOString(),
      endTime: now.toISOString(),
    };

    try {
      const result = await HC.readRecords("HeartRateVariabilityRmssd", { timeRangeFilter });
      const records: any[] = result?.records ?? [];
      const values = records
        .map((r) => Number(r?.heartRateVariabilityMillis ?? r?.value))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (values.length) {
        hrv = values.reduce((a, b) => a + b, 0) / values.length;
      }
    } catch (e) {
      console.warn("Health Connect HRV read error:", e);
    }

    try {
      const result = await HC.readRecords("Steps", { timeRangeFilter });
      const records: any[] = result?.records ?? [];
      if (records.length) {
        steps = records.reduce((sum: number, r: any) => sum + Number(r?.count ?? 0), 0);
      }
    } catch (e) {
      console.warn("Health Connect Steps read error:", e);
    }

    try {
      const result = await HC.readRecords("SleepSession", { timeRangeFilter });
      const records: any[] = result?.records ?? [];
      const intervals: [number, number][] = [];
      for (const session of records) {
        const stages: any[] = Array.isArray(session?.stages) ? session.stages : [];
        if (stages.length) {
          for (const st of stages) {
            const stageType = Number(st?.stage ?? 0);
            if (HC_ASLEEP_STAGES.has(stageType)) {
              const start = new Date(st?.startTime).getTime();
              const end = new Date(st?.endTime).getTime();
              if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
                intervals.push([start, end]);
              }
            }
          }
        } else {
          // No staging info — count entire session as sleep.
          const start = new Date(session?.startTime).getTime();
          const end = new Date(session?.endTime).getTime();
          if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
            intervals.push([start, end]);
          }
        }
      }
      const totalMs = totalNonOverlappingMs(intervals);
      if (totalMs > 0) sleepMinutes = Math.round(totalMs / 60000);
    } catch (e) {
      console.warn("Health Connect Sleep read error:", e);
    }
  } catch (e) {
    console.warn("Health Connect read error:", e);
  }

  return {
    hrv: hrv != null ? Math.round(hrv * 100) / 100 : null,
    sleep_duration_minutes: sleepMinutes,
    steps: steps != null ? Math.round(steps) : null,
    recorded_at: now.toISOString(),
  };
}

/**
 * Public entry point: read the most recent 24h of HRV, sleep, and step
 * data from whichever native health provider is available on this OS.
 * iOS → HealthKit (Apple Watch + iPhone). Android → Health Connect
 * (Galaxy Watch via Samsung Health, Pixel Watch, Wear OS, Fitbit-on-
 * Android, etc.). Web → all-null sentinel.
 */
export async function readLatestMetrics(): Promise<WearableMetrics> {
  if (isHealthKitAvailable) return readLatestMetricsFromHealthKit();
  if (isHealthConnectAvailable) return readLatestMetricsFromHealthConnect();
  return {
    hrv: null,
    sleep_duration_minutes: null,
    steps: null,
    recorded_at: new Date().toISOString(),
  };
}

/**
 * Send the latest native-health metrics to the NeuroQuest server.
 * Identity is verified by BOTH the user's work email AND their company
 * invite code, which only legitimate pilot members possess. The data
 * source ("apple_health" or "health_connect") is auto-derived from the
 * current platform so server-side audit logs reflect the true origin.
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
    const noDataMsg = isHealthConnectAvailable
      ? "We couldn't read any health data. This usually means Health Connect permissions weren't fully granted, or your watch hasn't synced HRV, sleep, or steps to Health Connect recently. Open Settings → Apps → Health Connect to grant access, or wear your watch overnight and try again."
      : "We couldn't read any health data. This usually means Apple Health permissions weren't fully granted, or your device hasn't recorded HRV, sleep, or steps recently. Open Settings to grant access, or wear your Apple Watch overnight and try again.";
    return {
      success: false,
      message: noDataMsg,
    };
  }

  // Auto-derive the data source from the platform so server-side audit
  // logs reflect the true origin (Apple Health vs Android Health Connect).
  const dataSource = isHealthConnectAvailable ? "health_connect" : "apple_health";
  try {
    const res = await fetch(`${getApiBase()}/api/wearable/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        invite_code: inviteCode.trim().toUpperCase(),
        source: dataSource,
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
