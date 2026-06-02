/**
 * Regression tests for the STRICT device-signature gate on the GDPR privacy
 * endpoints — `GET /api/app-user/:id/export` and `POST /api/app-user/:id/delete`
 * (guarded by `requireDeviceSignatureStrict` in routes/app-user.ts).
 *
 * These two routes leak (export) or destroy (erasure) regulated user data, so
 * they use a STRICTER gate than the general per-:id routes:
 *   - it HARD-401s on anything other than `ok`, and
 *   - it ALSO rejects a replayed (already-seen) but cryptographically valid
 *     signature.
 * The general `/outcome` route is pinned by `app-user.deviceAuth.test.ts`; this
 * file pins the privacy routes so a regression that weakened the strict gate
 * (e.g. accidentally honoring soft mode, or dropping the replay check) fails the
 * build instead of silently exposing or erasing regulated data.
 *
 * The soft-mode escape hatch's NON-EFFECT on this gate is proven in a SEPARATE
 * file (`app-user.deviceAuth.strict.softmode.test.ts`) because deviceAuth
 * resolves hard/soft mode once at module load; the node test runner isolates
 * each test file in its own process, so each can pick a different mode.
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

// The strict gate needs a server device key to verify signatures. We leave
// DEVICE_AUTH_SOFT_MODE unset so the general default (hard mode) is active —
// though the strict gate ignores that flag entirely (proven separately).
const SERVER_DEVICE_KEY = `test-device-key-${randomUUID()}${randomUUID()}`;
process.env.SERVER_DEVICE_KEY = SERVER_DEVICE_KEY;
delete process.env.DEVICE_AUTH_SOFT_MODE;
delete process.env.DEVICE_AUTH_HARD_MODE;

const { default: express } = await import("express");
const { default: appUserRouter } = await import("./app-user");
const { runMigrations } = await import("../lib/migrate");
const { query, default: pool } = await import("../lib/db");

let server: Server;
let baseUrl: string;
const createdUserIds = new Set<string>();

/** A real v4 UUID — the handler enforces UUID_RE on req.params.id. */
function newUserId(): string {
  const id = randomUUID();
  createdUserIds.add(id);
  return id;
}

/** Insert the parent app_users row the GDPR handlers require (404 otherwise). */
async function registerUser(userId: string): Promise<void> {
  await query(
    `INSERT INTO app_users (id, email, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [userId, `${userId}@example.test`, "Test User"],
  );
}

/**
 * Re-derive the device_secret the same way the server does, then sign a
 * canonical request string. Mirrors lib/deviceAuth.ts exactly so a correctly
 * built request verifies. Returns the headers; reusing the SAME returned object
 * on a second request reproduces an identical signature (the replay case).
 */
function signedHeaders(opts: {
  userId: string;
  method: string;
  path: string;
  body?: unknown;
  deviceId?: string;
  issuedAt?: string;
  timestamp?: string;
}): Record<string, string> {
  const deviceId = opts.deviceId ?? `device-${randomUUID()}`;
  const issuedAt = opts.issuedAt ?? new Date().toISOString();
  const timestamp = opts.timestamp ?? new Date().toISOString();
  const bodyString =
    opts.body && Object.keys(opts.body as object).length > 0
      ? JSON.stringify(opts.body)
      : "";

  const deviceSecret = createHmac("sha256", SERVER_DEVICE_KEY)
    .update(`${opts.userId}:${deviceId}:${issuedAt}`)
    .digest("hex");

  const bodyHash = createHash("sha256").update(bodyString).digest("hex");
  const message = `${opts.method}\n${opts.path}\n${timestamp}\n${bodyHash}`;
  const signature = createHmac("sha256", deviceSecret).update(message).digest("hex");

  return {
    "content-type": "application/json",
    "x-device-id": deviceId,
    "x-issued-at": issuedAt,
    "x-timestamp": timestamp,
    "x-signature": signature,
  };
}

interface CallResult {
  status: number;
  body: any;
}

/** GET /export. No request body, so headers are signed over an empty body. */
async function getExport(
  userId: string,
  headers: Record<string, string>,
): Promise<CallResult> {
  const res = await fetch(`${baseUrl}/api/app-user/${userId}/export`, {
    method: "GET",
    headers,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** POST /delete with the confirmation body the handler requires. */
async function postDelete(
  userId: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<CallResult> {
  const res = await fetch(`${baseUrl}/api/app-user/${userId}/delete`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

before(async () => {
  // The /export handler reads from every per-user table. runMigrations is
  // idempotent (CREATE TABLE IF NOT EXISTS) so this is a no-op on a migrated
  // database and self-bootstraps a fresh one.
  await runMigrations();

  const app = express();
  app.use(express.json());
  app.use("/api", appUserRouter);

  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (createdUserIds.size > 0) {
    const ids = [...createdUserIds];
    await query(`DELETE FROM device_request_nonces WHERE user_id = ANY($1)`, [ids]);
    await query(`DELETE FROM app_users WHERE id = ANY($1)`, [ids]);
  }
  await new Promise<void>((resolve, reject) => {
    if (!server) return resolve();
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await pool.end();
});

// ---------------- GET /export ----------------

test("a correctly device-signed export request returns 200", async () => {
  const userId = newUserId();
  await registerUser(userId);

  const path = `/api/app-user/${userId}/export`;
  const res = await getExport(userId, signedHeaders({ userId, method: "GET", path }));

  assert.equal(res.status, 200);
  assert.equal(res.body?.data_subject_id, userId);
  assert.equal(res.body?.export_format_version, "1.0");
});

test("an unsigned export request is rejected with 401 (strict gate)", async () => {
  const userId = newUserId();
  await registerUser(userId);

  const res = await getExport(userId, {});

  assert.equal(res.status, 401);
  assert.equal(res.body?.error, "Authentication failed");
  assert.equal(res.body?.details?.reason, "missing");
  assert.equal(res.body?.details?.scope, "gdpr_strict");
});

test("a tampered export signature is rejected with 401 (strict gate)", async () => {
  const userId = newUserId();
  await registerUser(userId);

  const path = `/api/app-user/${userId}/export`;
  const headers = signedHeaders({ userId, method: "GET", path });
  // Flip the last hex digit of an otherwise-valid signature -> HMAC mismatch.
  headers["x-signature"] = headers["x-signature"]!.replace(/.$/, (c) =>
    c === "0" ? "1" : "0",
  );

  const res = await getExport(userId, headers);

  assert.equal(res.status, 401);
  assert.equal(res.body?.error, "Authentication failed");
  assert.equal(res.body?.details?.reason, "invalid");
  assert.equal(res.body?.details?.scope, "gdpr_strict");
});

test("a replayed (identical, valid) export signature is rejected with 401", async () => {
  const userId = newUserId();
  await registerUser(userId);

  const path = `/api/app-user/${userId}/export`;
  // Reuse the EXACT same headers twice -> identical signature -> same nonce.
  const headers = signedHeaders({ userId, method: "GET", path });

  const first = await getExport(userId, headers);
  assert.equal(first.status, 200, "the first use of a valid signature succeeds");

  const replay = await getExport(userId, headers);
  assert.equal(replay.status, 401, "a replayed signature must be rejected");
  assert.equal(replay.body?.details?.reason, "replayed");
  assert.equal(replay.body?.details?.scope, "gdpr_strict");
});

// ---------------- POST /delete ----------------

test("a correctly device-signed delete request returns 200 and anonymizes", async () => {
  const userId = newUserId();
  await registerUser(userId);

  const body = { confirm: "DELETE_MY_DATA" };
  const path = `/api/app-user/${userId}/delete`;
  const res = await postDelete(
    userId,
    signedHeaders({ userId, method: "POST", path, body }),
    body,
  );

  assert.equal(res.status, 200);
  assert.equal(res.body?.success, true);
  assert.equal(res.body?.method, "anonymize_in_place");
});

test("an unsigned delete request is rejected with 401 (strict gate)", async () => {
  const userId = newUserId();
  await registerUser(userId);

  const res = await postDelete(userId, {}, { confirm: "DELETE_MY_DATA" });

  assert.equal(res.status, 401);
  assert.equal(res.body?.error, "Authentication failed");
  assert.equal(res.body?.details?.reason, "missing");
  assert.equal(res.body?.details?.scope, "gdpr_strict");

  // Prove the gate ran BEFORE the handler: the user must NOT be anonymized.
  const row = await query<{ email: string }>(
    `SELECT email FROM app_users WHERE id = $1`,
    [userId],
  );
  assert.equal(
    row.rows[0]?.email.startsWith("deleted_"),
    false,
    "an unsigned delete must not erase any data",
  );
});

test("a tampered delete signature is rejected with 401 (strict gate)", async () => {
  const userId = newUserId();
  await registerUser(userId);

  const body = { confirm: "DELETE_MY_DATA" };
  const path = `/api/app-user/${userId}/delete`;
  const headers = signedHeaders({ userId, method: "POST", path, body });
  headers["x-signature"] = headers["x-signature"]!.replace(/.$/, (c) =>
    c === "0" ? "1" : "0",
  );

  const res = await postDelete(userId, headers, body);

  assert.equal(res.status, 401);
  assert.equal(res.body?.error, "Authentication failed");
  assert.equal(res.body?.details?.reason, "invalid");
  assert.equal(res.body?.details?.scope, "gdpr_strict");
});

test("a replayed (identical, valid) delete signature is rejected with 401", async () => {
  const userId = newUserId();
  await registerUser(userId);

  const body = { confirm: "DELETE_MY_DATA" };
  const path = `/api/app-user/${userId}/delete`;
  const headers = signedHeaders({ userId, method: "POST", path, body });

  const first = await postDelete(userId, headers, body);
  assert.equal(first.status, 200, "the first use of a valid signature succeeds");

  const replay = await postDelete(userId, headers, body);
  assert.equal(replay.status, 401, "a replayed erasure signature must be rejected");
  assert.equal(replay.body?.details?.reason, "replayed");
  assert.equal(replay.body?.details?.scope, "gdpr_strict");
});
