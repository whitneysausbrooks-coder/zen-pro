/**
 * Regression tests for the entitlement READ path.
 *
 * `GET /api/iap/entitlements` is how the backend — and any OTHER device a
 * member signs in on — learns a user's Pro status without an Apple round-trip.
 * It is gated by the device HMAC signature handshake (see lib/deviceAuth.ts).
 * A regression here could leak one user's entitlements to another device, hide
 * Pro from a paying member, or wrongly report `pro_active` for an expired row.
 * The webhook (write path) is covered in `iap.test.ts`; this pins the read
 * path with the same disposable-row discipline.
 *
 * Run with: pnpm --filter @workspace/api-server test
 *
 * Requires DATABASE_URL (the dev database is fine). Each test uses its own
 * disposable user_id and every row is deleted in the `after` hook, so the
 * suite never touches real user data.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHmac, createHash } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// The read path needs a server device key to verify signatures. deviceAuth
// reads SERVER_DEVICE_KEY at request time, but set it before importing the
// router anyway so the whole module tree sees a stable value.
const SERVER_DEVICE_KEY = `test-device-key-${randomUUID()}${randomUUID()}`;
const ACCESS_LEVEL = "premium";
process.env.SERVER_DEVICE_KEY = SERVER_DEVICE_KEY;
process.env.ADAPTY_ACCESS_LEVEL = ACCESS_LEVEL;

const { default: express } = await import("express");
const { default: iapRouter } = await import("./iap");
const { query, default: pool } = await import("../lib/db");

let server: Server;
let baseUrl: string;
const createdUserIds = new Set<string>();

function newUserId(): string {
  const id = `test-iap-read-${randomUUID()}`;
  createdUserIds.add(id);
  return id;
}

/**
 * Re-derive the device_secret the same way the server does, then sign a
 * canonical request string. Mirrors lib/deviceAuth.ts exactly so a correctly
 * built request verifies. Individual fields can be overridden to exercise the
 * tamper / cross-user cases.
 */
function signedHeaders(opts: {
  userId: string;
  deviceId?: string;
  issuedAt?: string;
  timestamp?: string;
  path?: string;
  // Sign on behalf of a DIFFERENT user than the X-User-Id header claims.
  signAsUserId?: string;
}): Record<string, string> {
  const deviceId = opts.deviceId ?? `device-${randomUUID()}`;
  const issuedAt = opts.issuedAt ?? new Date().toISOString();
  const timestamp = opts.timestamp ?? new Date().toISOString();
  const path = opts.path ?? "/api/iap/entitlements";
  const secretOwner = opts.signAsUserId ?? opts.userId;

  const deviceSecret = createHmac("sha256", SERVER_DEVICE_KEY)
    .update(`${secretOwner}:${deviceId}:${issuedAt}`)
    .digest("hex");

  // GET with no body -> the server hashes the empty string.
  const bodyHash = createHash("sha256").update("").digest("hex");
  const message = `GET\n${path}\n${timestamp}\n${bodyHash}`;
  const signature = createHmac("sha256", deviceSecret).update(message).digest("hex");

  return {
    "x-user-id": opts.userId,
    "x-device-id": deviceId,
    "x-issued-at": issuedAt,
    "x-timestamp": timestamp,
    "x-signature": signature,
  };
}

interface ReadResponse {
  status: number;
  body: any;
}

async function getEntitlements(headers: Record<string, string>): Promise<ReadResponse> {
  const res = await fetch(`${baseUrl}/api/iap/entitlements`, {
    method: "GET",
    headers,
  });
  return { status: res.status, body: await res.json() };
}

/** Insert a mirror row directly (bypassing the webhook) for read-path setup. */
async function insertRow(
  userId: string,
  opts: { productId?: string; kind?: string; status: string; expiresAt: string | null },
): Promise<void> {
  await query(
    `INSERT INTO iap_entitlements (user_id, product_id, kind, status, expires_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (user_id, product_id)
     DO UPDATE SET kind = EXCLUDED.kind, status = EXCLUDED.status,
                   expires_at = EXCLUDED.expires_at, updated_at = NOW()`,
    [userId, opts.productId ?? ACCESS_LEVEL, opts.kind ?? "subscription", opts.status, opts.expiresAt],
  );
}

before(async () => {
  // Self-contained: ensure the mirror table exists even on a fresh DB. Mirrors
  // the definition in lib/migrate.ts; IF NOT EXISTS makes it a no-op against an
  // already-migrated database.
  await query(`
    CREATE TABLE IF NOT EXISTS iap_entitlements (
      id serial PRIMARY KEY,
      user_id varchar(255) NOT NULL,
      product_id varchar(128) NOT NULL,
      kind varchar(32) NOT NULL,
      status varchar(32) NOT NULL,
      expires_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, product_id)
    )
  `);

  const app = express();
  app.use(express.json());
  app.use("/api", iapRouter);

  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (createdUserIds.size > 0) {
    await query(`DELETE FROM iap_entitlements WHERE user_id = ANY($1)`, [
      [...createdUserIds],
    ]);
  }
  await new Promise<void>((resolve, reject) => {
    if (!server) return resolve();
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await pool.end();
});

test("valid device-signed request returns the active row and pro_active: true", async () => {
  const userId = newUserId();
  const expiry = new Date(Date.now() + 30 * 86_400_000).toISOString();
  await insertRow(userId, { status: "active", expiresAt: expiry });

  const res = await getEntitlements(signedHeaders({ userId }));
  assert.equal(res.status, 200);
  assert.equal(res.body.pro_active, true);
  assert.equal(res.body.entitlements.length, 1);
  assert.equal(res.body.entitlements[0].product_id, ACCESS_LEVEL);
  assert.equal(res.body.entitlements[0].status, "active");
});

test("an active non-consumable (no expiry) is returned with pro_active: true", async () => {
  const userId = newUserId();
  await insertRow(userId, { kind: "non_consumable", status: "active", expiresAt: null });

  const res = await getEntitlements(signedHeaders({ userId }));
  assert.equal(res.status, 200);
  assert.equal(res.body.pro_active, true);
  assert.equal(res.body.entitlements.length, 1);
  assert.equal(res.body.entitlements[0].expires_at, null);
});

test("an expired row whose period is already past is excluded and pro_active is false", async () => {
  const userId = newUserId();
  const pastExpiry = new Date(Date.now() - 86_400_000).toISOString();
  await insertRow(userId, { status: "expired", expiresAt: pastExpiry });

  const res = await getEntitlements(signedHeaders({ userId }));
  assert.equal(res.status, 200);
  assert.equal(res.body.pro_active, false);
  assert.equal(res.body.entitlements.length, 0, "a fully-lapsed row must not be returned");
});

test("an expired row whose period is still in the future is returned but pro_active is false", async () => {
  const userId = newUserId();
  const futureExpiry = new Date(Date.now() + 5 * 86_400_000).toISOString();
  // status=expired but expires_at in the future: the row is surfaced (the
  // member still has paid-through time) yet pro_active must reflect status.
  await insertRow(userId, { status: "expired", expiresAt: futureExpiry });

  const res = await getEntitlements(signedHeaders({ userId }));
  assert.equal(res.status, 200);
  assert.equal(res.body.entitlements.length, 1, "future-dated row stays visible until it lapses");
  assert.equal(res.body.entitlements[0].status, "expired");
  assert.equal(res.body.pro_active, false, "expired status never reports pro_active");
});

test("a user with no rows reads an empty list and pro_active: false", async () => {
  const userId = newUserId();

  const res = await getEntitlements(signedHeaders({ userId }));
  assert.equal(res.status, 200);
  assert.equal(res.body.pro_active, false);
  assert.equal(res.body.entitlements.length, 0);
});

test("missing device signature headers -> 401", async () => {
  const userId = newUserId();
  await insertRow(userId, {
    status: "active",
    expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  });

  // Only the X-User-Id header, no signature material.
  const res = await getEntitlements({ "x-user-id": userId });
  assert.equal(res.status, 401);
});

test("no X-User-Id header at all -> 401", async () => {
  const res = await getEntitlements({});
  assert.equal(res.status, 401);
});

test("invalid signature (tampered) -> 401", async () => {
  const userId = newUserId();
  await insertRow(userId, {
    status: "active",
    expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  });

  const headers = signedHeaders({ userId });
  headers["x-signature"] = headers["x-signature"]!.replace(/.$/, (c) =>
    c === "0" ? "1" : "0",
  );

  const res = await getEntitlements(headers);
  assert.equal(res.status, 401);
});

test("stale signature outside the 5-minute window -> 401", async () => {
  const userId = newUserId();
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const res = await getEntitlements(signedHeaders({ userId, timestamp: tenMinutesAgo }));
  assert.equal(res.status, 401);
});

test("one user can never read another user's entitlements", async () => {
  const victim = newUserId();
  const attacker = newUserId();
  // The victim is a paying member.
  await insertRow(victim, {
    status: "active",
    expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  });

  // Attacker holds a VALID credential for their OWN id but points X-User-Id at
  // the victim. The signature is bound to the victim id while signed with the
  // attacker's secret -> derivation mismatch -> 401, no leak.
  const headers = signedHeaders({ userId: victim, signAsUserId: attacker });
  const res = await getEntitlements(headers);
  assert.equal(res.status, 401, "a signature minted for another user must not unlock the victim");
  assert.equal(res.body.entitlements, undefined, "no entitlement data may leak on failure");
});
