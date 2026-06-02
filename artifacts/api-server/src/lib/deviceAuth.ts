/**
 * Per-request signed-token authentication for individual app-user endpoints.
 * (Whitney sprint follow-up #5 — auth-first hardening, soft-mode rollout.)
 *
 * Threat model: the existing endpoints accept any `:id` UUID without server
 * verification ("Keychain UUID is the bearer credential"). Anyone who learns
 * a user's UUID can read or poison their data — IDOR class risk. This module
 * adds an HMAC handshake without breaking the install-bound identity model.
 *
 * Handshake:
 *   1. On `/api/app-user/register`, the server returns
 *      `device_secret = HMAC_SHA256(SERVER_DEVICE_KEY, user_id || ':' || device_id || ':' || issued_at)`
 *      plus the `issued_at` it used. The mobile client stores both alongside
 *      the user_id in iOS Keychain.
 *   2. Every subsequent signed request sends:
 *        X-Device-Id           opaque device identifier (Constants.installationId)
 *        X-Issued-At           ISO timestamp the device_secret was minted at
 *        X-Timestamp           ISO timestamp of THIS request (5-min skew window)
 *        X-Signature           HMAC_SHA256(device_secret,
 *                              `${METHOD}\n${PATH}\n${X-Timestamp}\n${SHA256(body)}`)
 *      Server re-derives `device_secret` from the headers and verifies.
 *   3. Signed `:id` must equal `req.params.id` — closes the IDOR gap.
 *
 * Enforcement: hard mode is now the default — invalid / unsigned / spoofed
 * requests to per-:id endpoints are rejected with 401. The soft-mode rollout is
 * complete. Every non-ok verdict is still logged (`device_signature:<status>`)
 * for observability. As an emergency rollback ONLY, soft mode can be temporarily
 * re-enabled with `DEVICE_AUTH_SOFT_MODE=1` (checked + logged, never rejected).
 *
 * Replay protection: in addition to the 5-minute clock-skew window, every
 * accepted signed request records a one-time nonce server-side (a hash of its
 * signature, bound to the user, in `device_request_nonces`). The skew window
 * bounds HOW LONG a captured request could be replayed; the nonce table makes
 * it accept-ONCE — a reused signature inside the window is rejected. Nonces
 * older than the window can never be replayed (the timestamp check rejects
 * them first) and are pruned opportunistically.
 */
import crypto from "node:crypto";
import type { Request, RequestHandler } from "express";
import { captureMessage } from "./errorMonitoring";
import { query } from "./db";

/** Express headers can come in as string | string[] | undefined. Normalize. */
function singleHeader(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

// Hard mode (enforcement) is now the default: invalid / unsigned / spoofed
// requests to per-:id endpoints are rejected with 401. The soft-mode rollout is
// over. As an emergency rollback ONLY, soft mode can be re-enabled by setting
// `DEVICE_AUTH_SOFT_MODE=1` (every request is still checked + logged, but no
// request is rejected). `DEVICE_AUTH_HARD_MODE=1` is still honored as an
// explicit opt-in and takes precedence over the soft-mode escape hatch.
const SOFT_MODE_OVERRIDE =
  process.env["DEVICE_AUTH_SOFT_MODE"] === "1" &&
  process.env["DEVICE_AUTH_HARD_MODE"] !== "1";
const HARD_MODE = !SOFT_MODE_OVERRIDE;

// Sampling rate for SUCCESS (`device_signature:ok`) captures. Non-ok verdicts
// are always logged (they're rare and high-signal), but successful signed
// logins are the overwhelming majority of traffic, so logging every one would
// blow up log volume and cost. We instead emit a capture for a small, random
// fraction of successes; monitoring can then compute the true pass rate as:
//
//   pass_rate ≈ (ok_count / SUCCESS_SAMPLE_RATE)
//             / ((ok_count / SUCCESS_SAMPLE_RATE) + rejected_count)
//
// i.e. scale the sampled `device_signature:ok` count back up by
// 1 / SUCCESS_SAMPLE_RATE to recover true success volume, then divide by total
// (scaled successes + always-logged rejections). The sampled count is also
// emitted as `sample_rate` in each capture so the scale-up factor travels with
// the data and stays correct even if this constant changes later.
//
// Override with `DEVICE_AUTH_SUCCESS_SAMPLE_RATE` (a float in (0, 1]); set to
// `1` to log every success (e.g. during a short investigation). Out-of-range
// or unparseable values fall back to the 1% default.
const DEFAULT_SUCCESS_SAMPLE_RATE = 0.01;
function resolveSuccessSampleRate(): number {
  const raw = process.env["DEVICE_AUTH_SUCCESS_SAMPLE_RATE"];
  if (!raw) return DEFAULT_SUCCESS_SAMPLE_RATE;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) {
    return DEFAULT_SUCCESS_SAMPLE_RATE;
  }
  return parsed;
}
const SUCCESS_SAMPLE_RATE = resolveSuccessSampleRate();

const CLOCK_SKEW_MS = 5 * 60 * 1000;
const ISSUED_AT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // 1 year — re-mint on rotation.

function getServerKey(): string | null {
  const key = process.env["SERVER_DEVICE_KEY"];
  if (!key || key.length < 32) return null;
  return key;
}

/**
 * Derive the per-device shared secret. Same inputs always yield the same
 * secret, so the server can reproduce it on every request without storing
 * it (stateless verification). Output: 64-char lowercase hex.
 */
export function deriveDeviceSecret(args: {
  user_id: string;
  device_id: string;
  issued_at: string;
}): string | null {
  const serverKey = getServerKey();
  if (!serverKey) return null;
  const payload = `${args.user_id}:${args.device_id}:${args.issued_at}`;
  return crypto.createHmac("sha256", serverKey).update(payload).digest("hex");
}

function sha256Hex(input: Buffer | string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

export type SignatureCheck =
  | "ok"
  | "missing"
  | "invalid"
  | "expired"
  | "id_mismatch"
  | "no_server_key"
  | "issued_at_too_old"
  | "replayed";

export interface VerifyResult {
  status: SignatureCheck;
  reason?: string;
}

/**
 * Verify the signed-request headers against the URL's `:id` and the body
 * digest. Stateless — no DB lookup required.
 */
export function verifyDeviceSignature(req: Request, expectedUserId: string): VerifyResult {
  const serverKey = getServerKey();
  if (!serverKey) return { status: "no_server_key" };

  const deviceId = singleHeader(req.headers["x-device-id"]);
  const issuedAt = singleHeader(req.headers["x-issued-at"]);
  const timestamp = singleHeader(req.headers["x-timestamp"]);
  const signature = singleHeader(req.headers["x-signature"]);

  if (!deviceId || !issuedAt || !timestamp || !signature) {
    return { status: "missing", reason: "headers_missing" };
  }

  const tsMs = Date.parse(timestamp);
  if (!Number.isFinite(tsMs)) {
    return { status: "invalid", reason: "timestamp_unparseable" };
  }
  if (Math.abs(Date.now() - tsMs) > CLOCK_SKEW_MS) {
    return { status: "expired", reason: "outside_5min_window" };
  }

  const issuedMs = Date.parse(issuedAt);
  if (!Number.isFinite(issuedMs)) {
    return { status: "invalid", reason: "issued_at_unparseable" };
  }
  if (Date.now() - issuedMs > ISSUED_AT_MAX_AGE_MS) {
    return { status: "issued_at_too_old", reason: "rotation_required" };
  }

  const deviceSecret = deriveDeviceSecret({
    user_id: expectedUserId,
    device_id: deviceId,
    issued_at: issuedAt,
  });
  if (!deviceSecret) return { status: "no_server_key" };

  // Body digest. We use the raw body buffer when express captured one
  // (Stripe webhook style). For JSON bodies, we re-stringify req.body
  // deterministically — the mobile signer must use the same shape.
  const rawBody: Buffer | undefined = (req as any).rawBody;
  const bodyForHash =
    rawBody ??
    (req.body && Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : "");
  const bodyHash = sha256Hex(bodyForHash);

  // Canonicalize the request path to match what the mobile client signs
  // (the *full* pathname including any router mount prefix like `/api`).
  // `req.path` strips the mount prefix when used inside a Router; use
  // `req.originalUrl` instead and drop any query string.
  const fullPath = (req.originalUrl || req.url || "").split("?")[0] || "";
  const message = `${req.method}\n${fullPath}\n${timestamp}\n${bodyHash}`;
  const expected = crypto
    .createHmac("sha256", deviceSecret)
    .update(message)
    .digest("hex");

  if (!timingSafeEqualHex(expected, signature.toLowerCase())) {
    return { status: "invalid", reason: "hmac_mismatch" };
  }

  return { status: "ok" };
}

export type ReplayCheck = "fresh" | "replayed" | "skipped";

/**
 * Record the one-time nonce for an already-verified signed request and report
 * whether this signature has been seen before.
 *
 * The nonce is `SHA256(user_id || ':' || signature)`. A replayed request is,
 * by definition, the exact same bytes — so it carries the exact same
 * signature, which collides on the table's primary key. The very first insert
 * wins (`fresh`); any later insert of the same nonce is a no-op (`replayed`).
 *
 * MUST be called only AFTER `verifyDeviceSignature` returns `ok`, so an
 * attacker can't pre-seed the table with arbitrary nonces.
 *
 * Fails OPEN (`skipped`) when there is no signature header or the DB is
 * unreachable — a nonce-store outage must not lock every member out. The
 * clock-skew window still bounds the exposure in that degraded case.
 */
export async function consumeRequestNonce(
  req: Request,
  expectedUserId: string,
): Promise<ReplayCheck> {
  const signature = singleHeader(req.headers["x-signature"]);
  if (!signature) return "skipped";

  const nonce = sha256Hex(`${expectedUserId}:${signature.toLowerCase()}`);
  try {
    const result = await query(
      `INSERT INTO device_request_nonces (nonce, user_id)
       VALUES ($1, $2)
       ON CONFLICT (nonce) DO NOTHING`,
      [nonce, expectedUserId || null],
    );

    // Opportunistic cleanup (~1% of requests): drop nonces older than twice
    // the skew window. Anything that old is already rejected by the timestamp
    // check, so it can never be replayed and is safe to forget.
    if (Math.random() < 0.01) {
      void query(
        `DELETE FROM device_request_nonces WHERE seen_at < now() - interval '15 minutes'`,
      ).catch(() => {});
    }

    return (result.rowCount ?? 0) > 0 ? "fresh" : "replayed";
  } catch (err) {
    captureMessage("device_nonce:db_error", {
      user_id: expectedUserId,
      extra: { error: err instanceof Error ? err.message : String(err) },
    });
    return "skipped";
  }
}

/**
 * Express middleware that verifies the signature against `req.params.id`.
 * In hard mode (default) it 401s on anything other than `ok` (except when no
 * server key is configured, which is treated as misconfiguration and allowed
 * through rather than locking everyone out). In the emergency soft-mode
 * rollback it logs the verdict and always calls `next()`.
 *
 * Mount AFTER `express.json()` so `req.body` is available for hashing.
 */
export const requireDeviceSignature: RequestHandler = async (req, res, next) => {
  const rawId = req.params["id"];
  const userId = Array.isArray(rawId) ? (rawId[0] ?? "") : (rawId ?? "");
  let result = verifyDeviceSignature(req, userId);

  // A cryptographically valid signature still has to be a FIRST use. In hard
  // mode, a replayed (already-seen) signature is downgraded to `replayed` and
  // rejected below. In soft mode we leave the verdict as `ok` so nothing is
  // rejected, matching the rest of the soft-mode escape hatch.
  if (result.status === "ok" && HARD_MODE) {
    const replay = await consumeRequestNonce(req, userId);
    if (replay === "replayed") {
      result = { status: "replayed", reason: "nonce_reused" };
    }
  }

  // Attach for downstream handlers / observability.
  (req as any).signatureCheck = result;

  if (result.status === "ok") {
    // Record a SAMPLED success so monitoring can compute a true pass rate
    // (ok vs rejected), not just confirm the absence of failures. Scale the
    // sampled count back up by 1 / sample_rate to recover true volume.
    if (Math.random() < SUCCESS_SAMPLE_RATE) {
      captureMessage("device_signature:ok", {
        user_id: userId,
        route: `${req.method} ${req.path}`,
        extra: { hard_mode: HARD_MODE, sampled: true, sample_rate: SUCCESS_SAMPLE_RATE },
      });
    }
    return next();
  }

  // Surface every non-ok verdict in monitoring so we can spot regressions.
  captureMessage(`device_signature:${result.status}`, {
    user_id: userId,
    route: `${req.method} ${req.path}`,
    extra: { reason: result.reason ?? null, hard_mode: HARD_MODE },
  });

  if (HARD_MODE && result.status !== "no_server_key") {
    return res.status(401).json({
      error: "Authentication failed",
      details: { reason: result.status },
    });
  }
  return next();
};

/**
 * Helper used by `/register` to mint and return the device_secret + issued_at
 * pair the mobile client must store. Returns null when no server key is set
 * (mobile then proceeds with no signature, soft-mode tolerated).
 */
export function mintDeviceCredentials(args: {
  user_id: string;
  device_id: string;
}): { device_secret: string; issued_at: string } | null {
  const serverKey = getServerKey();
  if (!serverKey || !args.device_id) return null;
  const issued_at = new Date().toISOString();
  const device_secret = deriveDeviceSecret({
    user_id: args.user_id,
    device_id: args.device_id,
    issued_at,
  });
  if (!device_secret) return null;
  return { device_secret, issued_at };
}
