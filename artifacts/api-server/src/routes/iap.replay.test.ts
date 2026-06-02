/**
 * Replay-protection tests for the device HMAC signature handshake.
 *
 * The 5-minute clock-skew window alone lets a captured signed request be
 * replayed any number of times inside that window. lib/deviceAuth.ts now also
 * records a one-time nonce per accepted signature (device_request_nonces) so a
 * request is accept-ONCE: the same captured headers, replayed inside the
 * window, are rejected. These tests drive that through the real route
 * (`GET /api/iap/entitlements`), which is gated by the signature handshake.
 *
 * Run with: pnpm --filter @workspace/api-server test
 *
 * Requires DATABASE_URL (the dev database is fine). Every row is disposable
 * and deleted in the `after` hook, so the suite never touches real user data.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHmac, createHash } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// Hard mode is the default; the nonce check only runs in hard mode. Set a
// server key before importing the router so the whole module tree agrees.
const SERVER_DEVICE_KEY = `test-device-key-${randomUUID()}${randomUUID()}`;
const ACCESS_LEVEL = "premium";
process.env.SERVER_DEVICE_KEY = SERVER_DEVICE_KEY;
process.env.ADAPTY_ACCESS_LEVEL = ACCESS_LEVEL;
delete process.env.DEVICE_AUTH_SOFT_MODE;

const { default: express } = await import("express");
const { default: iapRouter } = await import("./iap");
const { query, default: pool } = await import("../lib/db");

let server: Server;
let baseUrl: string;
const createdUserIds = new Set<string>();

function newUserId(): string {
  const id = `test-iap-replay-${randomUUID()}`;
  createdUserIds.add(id);
  return id;
}

/**
 * Build a complete, valid set of signed headers. Returns the SAME object every
 * caller can reuse verbatim — a verbatim re-send is exactly what a replay is.
 */
function signedHeaders(userId: string): Record<string, string> {
  const deviceId = `device-${randomUUID()}`;
  const issuedAt = new Date().toISOString();
  const timestamp = new Date().toISOString();
  const path = "/api/iap/entitlements";

  const deviceSecret = createHmac("sha256", SERVER_DEVICE_KEY)
    .update(`${userId}:${deviceId}:${issuedAt}`)
    .digest("hex");
  const bodyHash = createHash("sha256").update("").digest("hex");
  const message = `GET\n${path}\n${timestamp}\n${bodyHash}`;
  const signature = createHmac("sha256", deviceSecret).update(message).digest("hex");

  return {
    "x-user-id": userId,
    "x-device-id": deviceId,
    "x-issued-at": issuedAt,
    "x-timestamp": timestamp,
    "x-signature": signature,
  };
}

async function getEntitlements(
  headers: Record<string, string>,
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}/api/iap/entitlements`, { method: "GET", headers });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function insertRow(userId: string): Promise<void> {
  await query(
    `INSERT INTO iap_entitlements (user_id, product_id, kind, status, expires_at, updated_at)
     VALUES ($1, $2, 'subscription', 'active', $3, NOW())
     ON CONFLICT (user_id, product_id)
     DO UPDATE SET status = 'active', expires_at = EXCLUDED.expires_at, updated_at = NOW()`,
    [userId, ACCESS_LEVEL, new Date(Date.now() + 30 * 86_400_000).toISOString()],
  );
}

// `CREATE TABLE IF NOT EXISTS` is not race-safe when test files run in
// parallel (two concurrent creates collide on a pg_catalog unique index).
// Swallow the duplicate-object errors — the table still ends up existing.
async function ensureTable(ddl: string): Promise<void> {
  try {
    await query(ddl);
  } catch (err: any) {
    if (err?.code === "23505" || err?.code === "42P07") return;
    throw err;
  }
}

before(async () => {
  await ensureTable(`
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
  await ensureTable(`
    CREATE TABLE IF NOT EXISTS device_request_nonces (
      nonce varchar(64) PRIMARY KEY,
      user_id varchar(255),
      seen_at timestamptz NOT NULL DEFAULT now()
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
    await query(`DELETE FROM iap_entitlements WHERE user_id = ANY($1)`, [[...createdUserIds]]);
    await query(`DELETE FROM device_request_nonces WHERE user_id = ANY($1)`, [[...createdUserIds]]);
  }
  await new Promise<void>((resolve, reject) => {
    if (!server) return resolve();
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await pool.end();
});

test("first use of a signed request is accepted, an identical replay is rejected", async () => {
  const userId = newUserId();
  await insertRow(userId);

  const headers = signedHeaders(userId);

  // Accept-once: the first request with these exact headers succeeds.
  const first = await getEntitlements(headers);
  assert.equal(first.status, 200, "first signed request must be accepted");
  assert.equal(first.body.pro_active, true);

  // Reject-on-replay: re-sending the byte-identical request inside the skew
  // window is a replay and must now fail.
  const replay = await getEntitlements(headers);
  assert.equal(replay.status, 401, "a replayed signature must be rejected");
  assert.equal(replay.body.entitlements, undefined, "no data may leak on a rejected replay");
});

test("a replayed signature is recorded exactly once in the nonce table", async () => {
  const userId = newUserId();
  await insertRow(userId);

  const headers = signedHeaders(userId);
  await getEntitlements(headers);
  await getEntitlements(headers);
  await getEntitlements(headers);

  const rows = await query(
    `SELECT COUNT(*)::int AS n FROM device_request_nonces WHERE user_id = $1`,
    [userId],
  );
  assert.equal(rows.rows[0].n, 1, "the same signature must occupy exactly one nonce row");
});

test("two distinct signed requests each get their own nonce and both pass", async () => {
  const userId = newUserId();
  await insertRow(userId);

  // Fresh headers each time -> different timestamp/device -> different
  // signature -> different nonce. Both are first-uses and must be accepted.
  const a = await getEntitlements(signedHeaders(userId));
  const b = await getEntitlements(signedHeaders(userId));
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
});
