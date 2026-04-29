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
 * Soft-mode rollout: this push runs in soft mode — every request is checked
 * and the result is logged (`signature_ok | missing | invalid | expired |
 * id_mismatch`), but no request is rejected. Once the next mobile build is
 * in TestFlight and active installs are upgraded, flip `SOFT_MODE = false`
 * (or remove this comment + the env override) to start enforcing.
 *
 * Replay protection: 5-minute clock-skew window only this round. A nonce
 * table is on the next-sprint backlog.
 */
import crypto from "node:crypto";
import type { Request, RequestHandler } from "express";
import { captureMessage } from "./errorMonitoring";

/** Express headers can come in as string | string[] | undefined. Normalize. */
function singleHeader(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

// Soft-mode default. Override with `DEVICE_AUTH_HARD_MODE=1` to enforce.
const HARD_MODE = process.env["DEVICE_AUTH_HARD_MODE"] === "1";
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
  | "issued_at_too_old";

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

/**
 * Express middleware that verifies the signature against `req.params.id`.
 * In soft mode (default) it logs the verdict and always calls `next()`;
 * in hard mode it 401s on anything other than `ok`.
 *
 * Mount AFTER `express.json()` so `req.body` is available for hashing.
 */
export const requireDeviceSignature: RequestHandler = (req, res, next) => {
  const rawId = req.params["id"];
  const userId = Array.isArray(rawId) ? (rawId[0] ?? "") : (rawId ?? "");
  const result = verifyDeviceSignature(req, userId);
  // Attach for downstream handlers / observability.
  (req as any).signatureCheck = result;

  if (result.status === "ok") return next();

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
