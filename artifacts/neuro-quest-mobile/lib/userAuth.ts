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
// Per-device shared secret returned by /api/app-user/register. Stored in
// SecureStore (iOS Keychain / Android Keystore) alongside the user_id.
const SECURE_DEVICE_SECRET_KEY = "nq_app_device_secret";
const SECURE_DEVICE_ISSUED_AT_KEY = "nq_app_device_issued_at";
const SECURE_DEVICE_ID_KEY = "nq_app_device_id";

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

// ---------- Per-device signing credentials (auth-first follow-up #5) ----------

interface DeviceCredentials {
  device_id: string;
  device_secret: string;
  issued_at: string;
}

async function getOrMintDeviceId(): Promise<string> {
  const existing = await secureGet(SECURE_DEVICE_ID_KEY);
  if (existing) return existing;
  const id =
    (Constants.installationId as string | undefined) ??
    (Constants.sessionId as string | undefined) ??
    Crypto.randomUUID();
  await secureSet(SECURE_DEVICE_ID_KEY, id);
  return id;
}

export async function getDeviceCredentials(): Promise<DeviceCredentials | null> {
  const [device_id, device_secret, issued_at] = await Promise.all([
    secureGet(SECURE_DEVICE_ID_KEY),
    secureGet(SECURE_DEVICE_SECRET_KEY),
    secureGet(SECURE_DEVICE_ISSUED_AT_KEY),
  ]);
  if (!device_id || !device_secret || !issued_at) return null;
  return { device_id, device_secret, issued_at };
}

async function setDeviceCredentials(creds: DeviceCredentials): Promise<void> {
  await secureSet(SECURE_DEVICE_ID_KEY, creds.device_id);
  await secureSet(SECURE_DEVICE_SECRET_KEY, creds.device_secret);
  await secureSet(SECURE_DEVICE_ISSUED_AT_KEY, creds.issued_at);
}

async function clearDeviceCredentials(): Promise<void> {
  await secureDelete(SECURE_DEVICE_SECRET_KEY);
  await secureDelete(SECURE_DEVICE_ISSUED_AT_KEY);
  // Keep SECURE_DEVICE_ID_KEY so the same install keeps a stable device_id
  // across re-registrations. It's not sensitive on its own.
}

// ---------- HMAC-SHA256 (expo-crypto byte-level digest, no new deps) ----------

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

async function sha256Bytes(bytes: Uint8Array): Promise<Uint8Array> {
  // expo-crypto >=11 supports Uint8Array input via Crypto.digest. Result is an
  // ArrayBuffer of the raw 32-byte digest.
  const result = await (Crypto as any).digest(
    Crypto.CryptoDigestAlgorithm.SHA256,
    bytes,
  );
  return new Uint8Array(result);
}

/**
 * HMAC-SHA256 per RFC 2104. Key is hex-encoded (the device_secret is 64 hex
 * chars = 32 bytes). Message is treated as UTF-8 bytes. Returns hex digest.
 */
async function hmacSha256(keyHex: string, message: string): Promise<string> {
  const blockSize = 64;
  let key = hexToBytes(keyHex);
  if (key.length > blockSize) {
    key = await sha256Bytes(key);
  }
  if (key.length < blockSize) {
    const padded = new Uint8Array(blockSize);
    padded.set(key);
    key = padded;
  }
  const ipad = new Uint8Array(blockSize);
  const opad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    ipad[i] = key[i]! ^ 0x36;
    opad[i] = key[i]! ^ 0x5c;
  }
  const msgBytes = new TextEncoder().encode(message);
  const inner = new Uint8Array(blockSize + msgBytes.length);
  inner.set(ipad);
  inner.set(msgBytes, blockSize);
  const innerHash = await sha256Bytes(inner);
  const outer = new Uint8Array(blockSize + innerHash.length);
  outer.set(opad);
  outer.set(innerHash, blockSize);
  const outerHash = await sha256Bytes(outer);
  return bytesToHex(outerHash);
}

async function sha256HexOfString(s: string): Promise<string> {
  const bytes = new TextEncoder().encode(s);
  const hash = await sha256Bytes(bytes);
  return bytesToHex(hash);
}

/**
 * fetch() wrapper that adds the per-device signature headers. Falls back to
 * a plain fetch when no device credentials have been minted yet (server side
 * runs in soft mode so the request still succeeds — the gap will close in the
 * next sprint when hard mode flips on).
 */
export async function signedFetch(
  url: string,
  init: RequestInit & { jsonBody?: unknown } = {},
): Promise<Response> {
  const creds = await getDeviceCredentials();
  const method = (init.method ?? "GET").toUpperCase();
  const bodyForSend =
    init.jsonBody !== undefined ? JSON.stringify(init.jsonBody) : (init.body as any) ?? "";
  const path = (() => {
    try {
      return new URL(url, "https://placeholder.local").pathname;
    } catch {
      return url;
    }
  })();
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (init.jsonBody !== undefined) headers["Content-Type"] = "application/json";

  if (creds) {
    try {
      const ts = new Date().toISOString();
      const bodyHash = await sha256HexOfString(bodyForSend === "" ? "" : String(bodyForSend));
      const message = `${method}\n${path}\n${ts}\n${bodyHash}`;
      const signature = await hmacSha256(creds.device_secret, message);
      headers["X-Device-Id"] = creds.device_id;
      headers["X-Issued-At"] = creds.issued_at;
      headers["X-Timestamp"] = ts;
      headers["X-Signature"] = signature;
    } catch {
      // Signing failure is never fatal in soft mode — surface as missing.
    }
  }

  return fetch(url, {
    ...init,
    method,
    headers,
    body: init.jsonBody !== undefined ? bodyForSend : init.body,
  });
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
  // We always send `device_id` so the server can mint per-device signing
  // credentials (returned in the response); on offline we proceed without
  // them and the next online register call will populate the keychain.
  let device_id: string;
  try {
    device_id = await getOrMintDeviceId();
  } catch {
    device_id = "";
  }
  try {
    const res = await fetch(`${getApiBase()}/api/app-user/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id,
        name,
        email,
        account_type: "individual",
        device_id: device_id || undefined,
      }),
    });
    if (res.ok) {
      try {
        const json = await res.json();
        if (
          json &&
          typeof json.device_secret === "string" &&
          typeof json.issued_at === "string" &&
          device_id
        ) {
          await setDeviceCredentials({
            device_id,
            device_secret: json.device_secret,
            issued_at: json.issued_at,
          });
        }
      } catch {
        // Older server responses without device creds → soft mode tolerated.
      }
    }
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

export interface ServerEntitlement {
  product_id: string;
  kind: string;
  status: string;
  expires_at: string | null;
}

export interface ServerEntitlements {
  proActive: boolean;
  entitlements: ServerEntitlement[];
}

/**
 * Cross-device fallback for Pro status. The on-device Adapty profile is the
 * authoritative source for the purchasing device, but a second device of the
 * same user (or a fresh reinstall before Adapty re-syncs) reads Pro state from
 * the server mirror via GET /iap/entitlements. The route authenticates with the
 * per-device HMAC signature (signedFetch) plus the X-User-Id header naming the
 * app_users.id the signature is bound to. Returns null on any failure so the
 * caller can fall back to the Adapty profile alone.
 */
export async function getServerEntitlements(): Promise<ServerEntitlements | null> {
  const id = await getStoredUserId();
  if (!id) return null;
  try {
    const res = await signedFetch(`${getApiBase()}/api/iap/entitlements`, {
      method: "GET",
      headers: { "X-User-Id": id },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      pro_active?: boolean;
      entitlements?: ServerEntitlement[];
    };
    return {
      proActive: !!json.pro_active,
      entitlements: Array.isArray(json.entitlements) ? json.entitlements : [],
    };
  } catch {
    return null;
  }
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
    await signedFetch(`${getApiBase()}/api/app-user/${id}/auth-event`, {
      method: "POST",
      jsonBody: {
        event_type: eventType,
        device_id: meta.device_id,
        device_platform: meta.device_platform,
        app_version: meta.app_version,
      },
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
  // Two-pass fetch: signed first (preferred), unsigned fallback if signed
  // fails. The server runs the signature middleware in soft mode, so an
  // unsigned request is accepted just as well — this prevents devices with
  // a stale or corrupted device_secret from getting permanently wedged on
  // the consent gate.
  const url = `${getApiBase()}/api/app-user/${id}/tos-status`;
  const tryParse = async (res: Response): Promise<TosStatus | null> => {
    if (!res.ok) return null;
    try {
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
    } catch {
      return null;
    }
  };
  try {
    const signed = await tryParse(await signedFetch(url));
    if (signed) return signed;
  } catch {}
  try {
    const unsigned = await tryParse(await fetch(url));
    if (unsigned) return unsigned;
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
  // Audit-rule (Whitney G7): every write goes to DB. We MUST receive a
  // server 2xx before declaring acceptance successful — otherwise the user
  // could enter the app without a row in `app_user_tos_acceptances` and
  // legal would have no audit trail of consent.
  //
  // Two-pass write: signed first, unsigned fallback. The server runs the
  // signature middleware in soft mode and still records the acceptance,
  // so we don't want a stale device_secret to permanently block consent.
  // Both code paths go through the same /tos-accept route so the audit
  // row is written either way.
  const url = `${getApiBase()}/api/app-user/${id}/tos-accept`;
  const body = JSON.stringify({
    tos_version: CURRENT_TOS_VERSION,
    privacy_version: CURRENT_PRIVACY_VERSION,
  });
  let serverOk = false;
  try {
    const res = await signedFetch(url, {
      method: "POST",
      jsonBody: {
        tos_version: CURRENT_TOS_VERSION,
        privacy_version: CURRENT_PRIVACY_VERSION,
      },
    });
    if (res.ok) serverOk = true;
  } catch {}
  if (!serverOk) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (res.ok) serverOk = true;
    } catch {}
  }
  if (!serverOk) {
    // Both paths failed — roll back the optimistic local flag so the
    // modal re-appears on next launch and we get another chance to
    // persist the consent server-side.
    try {
      await AsyncStorage.removeItem(TOS_LOCAL_KEY);
    } catch {}
    return { success: false };
  }
  return { success: true };
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
    await signedFetch(`${getApiBase()}/api/app-user/${id}/sync-error`, {
      method: "POST",
      jsonBody: {
        device_source: args.device_source.slice(0, 40),
        error_code: args.error_code?.slice(0, 80) ?? null,
        error_message: args.error_message.slice(0, 500),
        payload_excerpt: args.payload_excerpt?.slice(0, 500) ?? null,
      },
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
    await signedFetch(`${getApiBase()}/api/app-user/${id}/outcome`, {
      method: "POST",
      jsonBody: {
        personalization_id: args.personalization_id ?? null,
        action_taken: args.action_taken.slice(0, 80),
        pre_score: args.pre_score ?? null,
        post_score: args.post_score ?? null,
        observed_window_hours: args.observed_window_hours ?? null,
        model_version: args.model_version ?? null,
      },
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
  await clearDeviceCredentials();
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
