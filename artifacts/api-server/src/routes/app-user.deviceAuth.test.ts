/**
 * Regression tests for the per-:id device-signature ENFORCEMENT on the general
 * app-user endpoints (guarded by `requireDeviceSignature` in lib/deviceAuth.ts).
 *
 * Hard mode is now the default: a correctly signed request succeeds, while an
 * unsigned or spoofed (tampered) request is rejected with 401. The entitlement
 * READ path has its own suite (`iap.entitlements.test.ts`); this pins the
 * WRITE-side per-:id routes (here `/api/app-user/:id/outcome`) so a regression
 * that silently reverted hard mode — or broke signature verification — fails
 * the build instead of shipping.
 *
 * The soft-mode escape hatch (`DEVICE_AUTH_SOFT_MODE=1`) is covered in a
 * SEPARATE file (`app-user.deviceAuth.softmode.test.ts`) because deviceAuth
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

// The middleware needs a server device key to verify signatures. deviceAuth
// reads SERVER_DEVICE_KEY at request time, but set it before importing the
// router anyway so the whole module tree sees a stable value. We deliberately
// leave DEVICE_AUTH_SOFT_MODE unset here so hard mode (the default) is active.
const SERVER_DEVICE_KEY = `test-device-key-${randomUUID()}${randomUUID()}`;
process.env.SERVER_DEVICE_KEY = SERVER_DEVICE_KEY;
delete process.env.DEVICE_AUTH_SOFT_MODE;
delete process.env.DEVICE_AUTH_HARD_MODE;

const { default: express } = await import("express");
const { default: appUserRouter } = await import("./app-user");
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

/** Insert the parent app_users row the /outcome handler requires (404 otherwise). */
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
 * built request verifies. Individual fields can be overridden to exercise the
 * tamper case.
 */
function signedHeaders(opts: {
  userId: string;
  method?: string;
  path: string;
  body?: unknown;
  deviceId?: string;
  issuedAt?: string;
  timestamp?: string;
}): Record<string, string> {
  const method = opts.method ?? "POST";
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
  const message = `${method}\n${opts.path}\n${timestamp}\n${bodyHash}`;
  const signature = createHmac("sha256", deviceSecret).update(message).digest("hex");

  return {
    "content-type": "application/json",
    "x-device-id": deviceId,
    "x-issued-at": issuedAt,
    "x-timestamp": timestamp,
    "x-signature": signature,
  };
}

interface PostResult {
  status: number;
  body: any;
}

async function postOutcome(
  userId: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<PostResult> {
  const res = await fetch(`${baseUrl}/api/app-user/${userId}/outcome`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    // Send the SAME serialization the signature was built over. express
    // re-stringifies req.body for the digest; key order is preserved, so a
    // single JSON.stringify on both sides agrees.
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function ensureTable(ddl: string): Promise<void> {
  try {
    await query(ddl);
  } catch (err: any) {
    if (err?.code === "23505" || err?.code === "42P07") return;
    throw err;
  }
}

before(async () => {
  // Self-contained: ensure the tables the route + middleware touch exist even
  // on a fresh DB. IF NOT EXISTS makes these no-ops on a migrated database.
  await ensureTable(`
    CREATE TABLE IF NOT EXISTS app_users (
      id varchar PRIMARY KEY,
      email varchar NOT NULL,
      name varchar NOT NULL,
      account_type varchar NOT NULL DEFAULT 'individual',
      created_at timestamptz NOT NULL DEFAULT now(),
      last_login timestamptz NOT NULL DEFAULT now(),
      onboarding_complete boolean NOT NULL DEFAULT false,
      wearable_connected boolean NOT NULL DEFAULT false,
      wearable_type varchar
    )
  `);
  await ensureTable(`
    CREATE TABLE IF NOT EXISTS ai_outcome_feedback (
      id serial PRIMARY KEY,
      app_user_id varchar NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      personalization_id integer,
      action_taken varchar NOT NULL,
      pre_score double precision,
      post_score double precision,
      score_delta double precision,
      observed_window_hours integer,
      model_version varchar,
      recorded_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  // Replay-protection nonce table (see lib/migrate.ts). Required so the verified
  // signature path records nonces instead of failing open on a missing table.
  await ensureTable(`
    CREATE TABLE IF NOT EXISTS device_request_nonces (
      nonce varchar(64) PRIMARY KEY,
      user_id varchar(255),
      seen_at timestamptz NOT NULL DEFAULT now()
    )
  `);

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
    await query(`DELETE FROM ai_outcome_feedback WHERE app_user_id = ANY($1)`, [ids]);
    await query(`DELETE FROM device_request_nonces WHERE user_id = ANY($1)`, [ids]);
    await query(`DELETE FROM app_users WHERE id = ANY($1)`, [ids]);
  }
  await new Promise<void>((resolve, reject) => {
    if (!server) return resolve();
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await pool.end();
});

test("a correctly device-signed outcome request returns 200 and records the row", async () => {
  const userId = newUserId();
  await registerUser(userId);

  const body = { action_taken: "breathwork", pre_score: 50, post_score: 62 };
  const path = `/api/app-user/${userId}/outcome`;
  const res = await postOutcome(userId, signedHeaders({ userId, path, body }), body);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.outcome_id, "a row id must be returned");
  assert.equal(res.body.delta, 12, "post - pre delta is computed and returned");
});

test("an unsigned outcome request is rejected with 401 (hard mode is the default)", async () => {
  const userId = newUserId();
  await registerUser(userId);

  const body = { action_taken: "breathwork", pre_score: 50, post_score: 62 };
  // No signature headers at all -> the middleware sees `missing` and 401s
  // before the handler ever runs.
  const res = await postOutcome(userId, {}, body);

  assert.equal(res.status, 401);
  assert.equal(res.body?.error, "Authentication failed");
  assert.equal(res.body?.details?.reason, "missing");
});

test("a tampered signature on an outcome request is rejected with 401", async () => {
  const userId = newUserId();
  await registerUser(userId);

  const body = { action_taken: "breathwork", pre_score: 50, post_score: 62 };
  const path = `/api/app-user/${userId}/outcome`;
  const headers = signedHeaders({ userId, path, body });
  // Flip the last hex digit of an otherwise-valid signature -> HMAC mismatch.
  headers["x-signature"] = headers["x-signature"]!.replace(/.$/, (c) =>
    c === "0" ? "1" : "0",
  );

  const res = await postOutcome(userId, headers, body);

  assert.equal(res.status, 401);
  assert.equal(res.body?.error, "Authentication failed");
  assert.equal(res.body?.details?.reason, "invalid");
});
