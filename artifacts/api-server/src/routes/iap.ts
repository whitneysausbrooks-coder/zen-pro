import { Router, type IRouter } from "express";
import { timingSafeEqual } from "crypto";
import { query } from "../lib/db";
import { verifyDeviceSignature } from "../lib/deviceAuth";
import { captureMessage } from "../lib/errorMonitoring";

const router: IRouter = Router();

/**
 * Adapty is the single source of truth for purchases + entitlements.
 *
 * The client purchases through the Adapty SDK and reads the live access level
 * from the Adapty profile on device. This server keeps a lightweight MIRROR of
 * entitlement state in `iap_entitlements` for backend grants / cross-device
 * consistency, updated exclusively by Adapty's server-to-server webhook. We no
 * longer validate Apple receipts ourselves (Adapty does that upstream).
 */

// Adapty access level that grants "Pro" (mirrors EXPO_PUBLIC_ADAPTY_ACCESS_LEVEL
// on the client). Stored as the `product_id` of the mirror row.
const ADAPTY_ACCESS_LEVEL = process.env.ADAPTY_ACCESS_LEVEL || "premium";

/**
 * Authenticate via device HMAC signature (mobile individual track).
 * The mobile client sends X-Device-Id, X-Issued-At, X-Timestamp, X-Signature
 * plus an X-User-Id header naming the app_users.id the signature is bound to.
 */
function requireUserOrDevice(req: any, res: any): string | null {
  const headerUserId = req.headers["x-user-id"];
  const deviceUserId = Array.isArray(headerUserId) ? headerUserId[0] : headerUserId;
  if (typeof deviceUserId === "string" && deviceUserId.length > 0) {
    const result = verifyDeviceSignature(req, deviceUserId);
    if (result.status === "ok") {
      return deviceUserId;
    }
    captureMessage(`iap_device_auth:${result.status}`, {
      route: `${req.method} ${req.path}`,
      extra: { reason: result.reason ?? null, user_id_provided: deviceUserId.slice(0, 8) },
    });
  }

  res.status(401).json({ error: "Unauthorized" });
  return null;
}

/**
 * GET /iap/entitlements
 *
 * Backend mirror of Adapty entitlement state for this user. The client treats
 * the on-device Adapty profile as authoritative; this endpoint exists so the
 * server (and other devices) can see Pro status without an Apple round-trip.
 */
router.get("/iap/entitlements", async (req, res) => {
  const userId = requireUserOrDevice(req, res);
  if (!userId) return;

  const ents = await query(
    `SELECT product_id, kind, status, expires_at FROM iap_entitlements
     WHERE user_id = $1 AND (status = 'active' OR expires_at > NOW())`,
    [userId],
  );

  return res.json({
    entitlements: ents.rows,
    pro_active: ents.rows.some((r: any) => r.status === "active"),
  });
});

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// Adapty subscription lifecycle event types that GRANT access. Note that a
// cancellation (auto-renew off) is NOT here — the subscription stays active
// until it actually expires.
const ACTIVATING_EVENTS = new Set([
  "subscription_started",
  "subscription_initial_purchase",
  "subscription_renewed",
  "subscription_recovered",
  "trial_started",
  "trial_converted",
  "non_subscription_purchase",
  "access_level_updated",
]);

// Event types that REVOKE access.
const DEACTIVATING_EVENTS = new Set([
  "subscription_expired",
  "subscription_refunded",
]);

function parseExpiry(props: Record<string, any>): string | null {
  const raw =
    props.subscription_expires_at ??
    props.expires_at ??
    props.subscription_expires_at_iso ??
    null;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * POST /iap/adapty-webhook
 *
 * Adapty server-to-server webhook. Adapty signs the request with a static
 * Authorization header you configure in the Adapty dashboard; we compare it
 * (constant-time) against ADAPTY_WEBHOOK_SECRET before mutating any state,
 * since the endpoint is public. We then upsert the user's Pro access-level
 * mirror row based on the event type.
 */
router.post("/iap/adapty-webhook", async (req, res) => {
  const secret = process.env.ADAPTY_WEBHOOK_SECRET;
  if (!secret) {
    captureMessage("adapty_webhook:not_configured", { route: "POST /iap/adapty-webhook" });
    return res.status(503).json({ error: "Webhook not configured" });
  }

  const provided = req.header("authorization") || "";
  if (!safeEqual(provided, secret)) {
    captureMessage("adapty_webhook:auth_failed", { route: "POST /iap/adapty-webhook" });
    return res.status(401).json({ error: "Unauthorized" });
  }

  const event = (req.body ?? {}) as Record<string, any>;
  const props = (event.event_properties ?? {}) as Record<string, any>;
  const profile = (event.profile ?? {}) as Record<string, any>;

  const eventType: string =
    event.event_type ?? props.event_type ?? "";
  const customerUserId: string | null =
    props.customer_user_id ??
    event.customer_user_id ??
    profile.customer_user_id ??
    null;

  // Anonymous Adapty profiles (no identify() call yet) can't be mirrored.
  if (!customerUserId) {
    return res.json({ ok: true, ignored: "no customer_user_id" });
  }

  const isNonSub = eventType === "non_subscription_purchase";
  const kind = isNonSub ? "non_consumable" : "subscription";

  if (ACTIVATING_EVENTS.has(eventType)) {
    const expiresAt = parseExpiry(props);
    await query(
      `INSERT INTO iap_entitlements (user_id, product_id, kind, status, expires_at, updated_at)
       VALUES ($1, $2, $3, 'active', $4, NOW())
       ON CONFLICT (user_id, product_id)
       DO UPDATE SET kind = EXCLUDED.kind, status = 'active',
                     expires_at = EXCLUDED.expires_at, updated_at = NOW()`,
      [customerUserId, ADAPTY_ACCESS_LEVEL, kind, expiresAt],
    );
    return res.json({ ok: true, eventType, status: "active" });
  }

  if (DEACTIVATING_EVENTS.has(eventType)) {
    await query(
      `UPDATE iap_entitlements SET status = 'expired', updated_at = NOW()
       WHERE user_id = $1 AND product_id = $2`,
      [customerUserId, ADAPTY_ACCESS_LEVEL],
    );
    return res.json({ ok: true, eventType, status: "expired" });
  }

  // Other events (renewal cancelled, billing issue, etc.) are acknowledged but
  // do not change access state.
  return res.json({ ok: true, eventType, ignored: true });
});

export default router;
