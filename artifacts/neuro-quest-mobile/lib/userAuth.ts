import { Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

/**
 * Identity layer for individual (non-enterprise) users.
 *
 * Storage strategy:
 *  - Sensitive identity (user_id) → SecureStore (iOS Keychain / Android Keystore)
 *    on native, AsyncStorage fallback on web (SecureStore is unavailable on web).
 *  - Profile metadata (name, email, account_type, timestamps) → AsyncStorage.
 *
 * The user_id is generated client-side as a UUID v4 on first individual sign-up
 * and is stable for the lifetime of the install. It is the primary identifier
 * the AI personalization engine attaches biometric history to.
 */

const SECURE_USER_ID_KEY = "nq_app_user_id";
const PROFILE_KEY = "nq_app_user_profile";

export type AccountType = "individual";

export interface UserProfile {
  user_id: string;
  name: string;
  email: string;
  account_type: AccountType;
  created_at: string;
  last_login: string;
  onboarding_complete: boolean;
}

function isWeb(): boolean {
  return Platform.OS === "web";
}

function getApiBase(): string {
  return isWeb() ? "" : `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
}

async function secureGet(key: string): Promise<string | null> {
  if (isWeb()) {
    try { return await AsyncStorage.getItem(key); } catch { return null; }
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

/**
 * Throws on failure. Callers must handle / surface the error so we never
 * silently end up with a half-persisted identity.
 */
async function secureSet(key: string, value: string): Promise<void> {
  if (isWeb()) {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function secureDelete(key: string): Promise<void> {
  if (isWeb()) {
    try { await AsyncStorage.removeItem(key); } catch {}
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {}
}

export async function getStoredUserId(): Promise<string | null> {
  return secureGet(SECURE_USER_ID_KEY);
}

export async function getStoredProfile(): Promise<UserProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    if (!parsed.user_id || !parsed.email || !parsed.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Throws on failure so callers can roll the identity back if persistence fails.
 */
async function setStoredProfile(p: UserProfile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

// Module-scoped lock to prevent two concurrent ensureUserId() calls from
// racing and minting two different UUIDs (e.g. dashboard + heartbeat firing
// in parallel on cold boot).
let inflightEnsure: Promise<string> | null = null;

/**
 * Generate a stable UUID v4 once per install, store in SecureStore, and return
 * it. Subsequent calls return the same id. Concurrent callers share one
 * in-flight promise so we never mint two ids.
 */
export async function ensureUserId(): Promise<string> {
  if (inflightEnsure) return inflightEnsure;
  inflightEnsure = (async () => {
    const existing = await getStoredUserId();
    if (existing) return existing;
    const id = Crypto.randomUUID();
    await secureSet(SECURE_USER_ID_KEY, id);
    return id;
  })().finally(() => {
    inflightEnsure = null;
  });
  return inflightEnsure;
}

/**
 * Reconcile the local identity on cold start. Two states can drift apart
 * across reinstalls because iOS Keychain (SecureStore) survives uninstall
 * while AsyncStorage does not:
 *   - UUID exists but no profile → wipe the orphan UUID so the next sign-up
 *     mints a fresh identity. Prevents the new user from inheriting an old
 *     stranger's backend baseline.
 *   - Profile exists but no UUID → recreate the UUID from the profile (if
 *     the profile already has one — defensive, shouldn't happen).
 */
export async function reconcileLocalIdentity(): Promise<void> {
  try {
    const id = await getStoredUserId();
    const profileRaw = await AsyncStorage.getItem(PROFILE_KEY);
    if (id && !profileRaw) {
      await secureDelete(SECURE_USER_ID_KEY);
      return;
    }
    if (profileRaw && !id) {
      try {
        const p = JSON.parse(profileRaw) as Partial<UserProfile>;
        if (p.user_id) await secureSet(SECURE_USER_ID_KEY, p.user_id);
      } catch {
        await AsyncStorage.removeItem(PROFILE_KEY);
      }
    }
  } catch {
    // Best-effort reconciliation only — never block app boot.
  }
}

export interface RegisterResult {
  success: boolean;
  profile?: UserProfile;
  message?: string;
}

/**
 * Register an individual user. Generates user_id on first call (idempotent).
 * Persists the profile locally even if the network sync fails so the user is
 * never trapped without an identity. Returns success: true if the local
 * record was saved, regardless of backend reachability — backend will be
 * reconciled on next heartbeat / biometrics post.
 */
export async function registerIndividual(input: {
  name: string;
  email: string;
}): Promise<RegisterResult> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { success: false, message: "Name is required." };
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { success: false, message: "Please enter a valid email." };
  }

  // Atomic write with rollback: if either persistence step throws, we wipe
  // any partial state so the user retries cleanly instead of being stranded
  // with a half-persisted identity (UUID without profile, etc.).
  let user_id: string;
  try {
    user_id = await ensureUserId();
  } catch (e: any) {
    return { success: false, message: "Couldn't secure your account on this device. Please try again." };
  }
  const now = new Date().toISOString();
  const profile: UserProfile = {
    user_id,
    name,
    email,
    account_type: "individual",
    created_at: now,
    last_login: now,
    onboarding_complete: false,
  };
  try {
    await setStoredProfile(profile);
  } catch {
    // Roll back the UUID so the next attempt starts clean instead of
    // attaching the new sign-up to an orphan UUID.
    await secureDelete(SECURE_USER_ID_KEY);
    return { success: false, message: "Couldn't save your profile. Please try again." };
  }

  // Verify both writes are readable before reporting success. Catches the
  // edge case where a write returned but the keychain item was actually
  // rejected (e.g. simulator quirks, locked device).
  const verifyId = await getStoredUserId();
  const verifyProfile = await getStoredProfile();
  if (!verifyId || !verifyProfile) {
    await secureDelete(SECURE_USER_ID_KEY);
    try { await AsyncStorage.removeItem(PROFILE_KEY); } catch {}
    return { success: false, message: "Couldn't verify your account. Please try again." };
  }

  // Best-effort backend sync. If it fails (offline / cold backend), the local
  // profile still exists and `syncProfileToBackend` can retry later.
  try {
    await fetch(`${getApiBase()}/api/app-user/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id,
        name,
        email,
        account_type: "individual",
      }),
    });
  } catch {
    // intentional — local-first; offline is acceptable.
  }

  // Record the login auth event (1.7 / G6). Fire-and-forget.
  void recordAuthEvent("login", user_id);

  return { success: true, profile };
}

/**
 * Re-sync the local profile to the backend. Used on app cold-start to flush
 * any prior offline registration and to refresh last_login.
 */
export async function syncProfileToBackend(): Promise<void> {
  const profile = await getStoredProfile();
  if (!profile) return;
  try {
    await fetch(`${getApiBase()}/api/app-user/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: profile.user_id,
        name: profile.name,
        email: profile.email,
        account_type: profile.account_type,
      }),
    });
  } catch {}
}

export async function heartbeat(): Promise<void> {
  const id = await getStoredUserId();
  if (!id) return;
  try {
    await fetch(`${getApiBase()}/api/app-user/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: id }),
    });
    // Record the session-resume event (1.7 / G6). Best-effort, never throws.
    void recordAuthEvent("session_resume", id);
  } catch {}
}

// ---------- ZenPro Sprint Checklist helpers (April 2026) ----------

const CURRENT_TOS_VERSION = "2026.04.29";
const CURRENT_PRIVACY_VERSION = "2026.04.29";
const TOS_LOCAL_KEY = "nq_tos_acceptance";

export type AuthEventType =
  | "login"
  | "logout"
  | "session_resume"
  | "session_refresh"
  | "session_timeout"
  | "identity_reconciled";

interface DeviceMeta {
  device_id: string | null;
  device_platform: string;
  app_version: string | null;
}

function getDeviceMeta(): DeviceMeta {
  const installId =
    (Constants.installationId as string | undefined) ??
    (Constants.sessionId as string | undefined) ??
    null;
  return {
    device_id: installId,
    device_platform: Platform.OS,
    app_version:
      (Constants.expoConfig?.version as string | undefined) ??
      (Constants.expoConfig?.runtimeVersion as string | undefined) ??
      null,
  };
}

/**
 * Record an auth lifecycle event (login / logout / session resume).
 * Always best-effort — never blocks the user flow.
 */
export async function recordAuthEvent(
  eventType: AuthEventType,
  explicitUserId?: string | null,
): Promise<void> {
  const id = explicitUserId ?? (await getStoredUserId());
  if (!id) return;
  const meta = getDeviceMeta();
  try {
    await fetch(`${getApiBase()}/api/app-user/${id}/auth-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: eventType,
        device_id: meta.device_id,
        device_platform: meta.device_platform,
        app_version: meta.app_version,
      }),
    });
  } catch {}
}

export interface TosStatus {
  current_tos_version: string;
  current_privacy_version: string;
  accepted: boolean;
}

/**
 * Has the current user accepted the latest ToS + Privacy?
 * Checks local cache first (instant boot), reconciles with backend in
 * the background.
 */
export async function getTosStatus(): Promise<TosStatus> {
  const id = await getStoredUserId();
  // Local cache first so the app boot path is instant.
  let local: TosStatus | null = null;
  try {
    const raw = await AsyncStorage.getItem(TOS_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as TosStatus;
      if (
        parsed.current_tos_version === CURRENT_TOS_VERSION &&
        parsed.current_privacy_version === CURRENT_PRIVACY_VERSION
      ) {
        local = parsed;
      }
    }
  } catch {}
  if (!id) {
    return (
      local ?? {
        current_tos_version: CURRENT_TOS_VERSION,
        current_privacy_version: CURRENT_PRIVACY_VERSION,
        accepted: false,
      }
    );
  }
  try {
    const res = await fetch(`${getApiBase()}/api/app-user/${id}/tos-status`);
    if (res.ok) {
      const json = (await res.json()) as TosStatus & { success?: boolean };
      const status: TosStatus = {
        current_tos_version: json.current_tos_version,
        current_privacy_version: json.current_privacy_version,
        accepted: !!json.accepted,
      };
      try {
        await AsyncStorage.setItem(TOS_LOCAL_KEY, JSON.stringify(status));
      } catch {}
      return status;
    }
  } catch {}
  return (
    local ?? {
      current_tos_version: CURRENT_TOS_VERSION,
      current_privacy_version: CURRENT_PRIVACY_VERSION,
      accepted: false,
    }
  );
}

/**
 * Record acceptance of the current ToS + Privacy versions for this user.
 * Persists locally even if backend is unreachable so the user is never
 * re-prompted on a flaky network.
 */
export async function acceptCurrentTos(): Promise<{ success: boolean }> {
  const id = await getStoredUserId();
  if (!id) return { success: false };
  const status: TosStatus = {
    current_tos_version: CURRENT_TOS_VERSION,
    current_privacy_version: CURRENT_PRIVACY_VERSION,
    accepted: true,
  };
  try {
    await AsyncStorage.setItem(TOS_LOCAL_KEY, JSON.stringify(status));
  } catch {}
  try {
    const res = await fetch(`${getApiBase()}/api/app-user/${id}/tos-accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tos_version: CURRENT_TOS_VERSION,
        privacy_version: CURRENT_PRIVACY_VERSION,
      }),
    });
    return { success: res.ok };
  } catch {
    // Local acceptance is enough for a returning offline user; backend
    // will catch up on next online launch.
    return { success: true };
  }
}

/**
 * Record a wearable / health-data sync failure (G12). Bounded payload
 * sizes; never throws. Used by the HealthKit / Health Connect adapters.
 */
export async function recordWearableSyncError(args: {
  device_source: string;
  error_code?: string | null;
  error_message: string;
  payload_excerpt?: string | null;
}): Promise<void> {
  const id = await getStoredUserId();
  if (!id) return;
  try {
    await fetch(`${getApiBase()}/api/app-user/${id}/sync-error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_source: args.device_source.slice(0, 40),
        error_code: args.error_code?.slice(0, 80) ?? null,
        error_message: args.error_message.slice(0, 500),
        payload_excerpt: args.payload_excerpt?.slice(0, 500) ?? null,
      }),
    });
  } catch {}
}

/**
 * Record the downstream outcome of an AI recommendation: what the user
 * did + the pre/post resilience scores. Drives 4.3 (outcome feedback).
 */
export async function recordAiOutcome(args: {
  personalization_id?: number | null;
  action_taken: string;
  pre_score?: number | null;
  post_score?: number | null;
  observed_window_hours?: number | null;
  model_version?: string | null;
}): Promise<void> {
  const id = await getStoredUserId();
  if (!id) return;
  try {
    await fetch(`${getApiBase()}/api/app-user/${id}/outcome`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personalization_id: args.personalization_id ?? null,
        action_taken: args.action_taken.slice(0, 80),
        pre_score: args.pre_score ?? null,
        post_score: args.post_score ?? null,
        observed_window_hours: args.observed_window_hours ?? null,
        model_version: args.model_version ?? null,
      }),
    });
  } catch {}
}

export async function setOnboardingComplete(value: boolean): Promise<void> {
  const profile = await getStoredProfile();
  if (!profile) return;
  await setStoredProfile({ ...profile, onboarding_complete: value });
}

/**
 * Clear all individual-account data. Used by the back-navigation flow when a
 * user retreats from the Health screen back to the Sign In screen, and by the
 * Profile sign-out flow. Records a logout auth event before clearing so the
 * audit trail captures who signed out.
 */
export async function clearIndividualAccount(): Promise<void> {
  // Capture the user_id BEFORE we wipe so the auth event has an attribution.
  const id = await getStoredUserId();
  if (id) {
    // Best-effort, fire-and-forget — must not block sign-out on network.
    void recordAuthEvent("logout", id);
  }
  await secureDelete(SECURE_USER_ID_KEY);
  try { await AsyncStorage.removeItem(PROFILE_KEY); } catch {}
  try { await AsyncStorage.removeItem("nq_tos_acceptance"); } catch {}
}

export interface BaselineResponse {
  success: boolean;
  user?: { id: string; name: string; email: string; account_type: string };
  latest?: {
    neuro_resilience_score: number | null;
    ema_7day: number | null;
    recorded_at: string;
  } | null;
  trend?: "rising" | "falling" | "steady" | "insufficient_data";
  ema_7day?: number | null;
  session_count?: number;
  suggestion?: {
    type: "recovery" | "growth" | "burnout_alert" | "baseline_building";
    message: string;
  };
}

export async function fetchBaseline(): Promise<BaselineResponse | null> {
  const id = await getStoredUserId();
  if (!id) return null;
  try {
    const res = await fetch(`${getApiBase()}/api/app-user/${id}/baseline`);
    if (!res.ok) return null;
    return (await res.json()) as BaselineResponse;
  } catch {
    return null;
  }
}
