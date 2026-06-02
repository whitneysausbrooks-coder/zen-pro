/**
 * Regression test proving the STRICT GDPR gate (`requireDeviceSignatureStrict`
 * in routes/app-user.ts) IGNORES the emergency soft-mode rollback.
 *
 * The general per-:id routes honor `DEVICE_AUTH_SOFT_MODE=1` and let an unsigned
 * request through (proven in `app-user.deviceAuth.softmode.test.ts`). The
 * privacy export/erasure routes intentionally do NOT: even with soft mode on,
 * an unsigned request to `GET /export` or `POST /delete` must still 401, because
 * regulated data must never be exposed or destroyed via the rollback path.
 *
 * deviceAuth resolves hard/soft mode once at module load, so this lives in its
 * own file: the node test runner isolates each test file in its own process, and
 * we set DEVICE_AUTH_SOFT_MODE=1 BEFORE importing the router.
 *
 * Run with: pnpm --filter @workspace/api-server test
 *
 * Requires DATABASE_URL (the dev database is fine). Each test uses its own
 * disposable user_id and every row is deleted in the `after` hook.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHmac, createHash } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// Activate the soft-mode escape hatch BEFORE importing the router. A server key
// is still configured so this proves the STRICT gate ignores soft mode (not a
// missing-key bypass).
const SERVER_DEVICE_KEY = `test-device-key-${randomUUID()}${randomUUID()}`;
process.env.SERVER_DEVICE_KEY = SERVER_DEVICE_KEY;
process.env.DEVICE_AUTH_SOFT_MODE = "1";
delete process.env.DEVICE_AUTH_HARD_MODE;

const { default: express } = await import("express");
const { default: appUserRouter } = await import("./app-user");
const { runMigrations } = await import("../lib/migrate");
const { query, default: pool } = await import("../lib/db");

let server: Server;
let baseUrl: string;
const createdUserIds = new Set<string>();

function newUserId(): string {
  const id = randomUUID();
  createdUserIds.add(id);
  return id;
}

async function registerUser(userId: string): Promise<void> {
  await query(
    `INSERT INTO app_users (id, email, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [userId, `${userId}@example.test`, "Test User"],
  );
}

/** Mirrors lib/deviceAuth.ts so a correctly built request verifies. */
function signedHeaders(opts: {
  userId: string;
  method: string;
  path: string;
  body?: unknown;
}): Record<string, string> {
  const deviceId = `device-${randomUUID()}`;
  const issuedAt = new Date().toISOString();
  const timestamp = new Date().toISOString();
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

before(async () => {
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

test("soft mode does NOT let an unsigned EXPORT through — strict gate still 401s", async () => {
  const userId = newUserId();
  await registerUser(userId);

  // No signature headers. The general /outcome route 200s under soft mode; the
  // strict GDPR gate must still reject.
  const res: CallResult = await fetch(`${baseUrl}/api/app-user/${userId}/export`, {
    method: "GET",
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

  assert.equal(res.status, 401, "soft mode must NOT expose regulated data");
  assert.equal(res.body?.details?.reason, "missing");
  assert.equal(res.body?.details?.scope, "gdpr_strict");
});

test("soft mode does NOT let an unsigned DELETE through — strict gate still 401s", async () => {
  const userId = newUserId();
  await registerUser(userId);

  const res: CallResult = await fetch(`${baseUrl}/api/app-user/${userId}/delete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirm: "DELETE_MY_DATA" }),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

  assert.equal(res.status, 401, "soft mode must NOT erase regulated data");
  assert.equal(res.body?.details?.reason, "missing");
  assert.equal(res.body?.details?.scope, "gdpr_strict");

  // Prove no anonymization happened.
  const row = await query<{ email: string }>(
    `SELECT email FROM app_users WHERE id = $1`,
    [userId],
  );
  assert.equal(row.rows[0]?.email.startsWith("deleted_"), false);
});

test("a correctly signed EXPORT still succeeds under soft mode (gate works normally)", async () => {
  const userId = newUserId();
  await registerUser(userId);

  const path = `/api/app-user/${userId}/export`;
  const res: CallResult = await fetch(`${baseUrl}/api/app-user/${userId}/export`, {
    method: "GET",
    headers: signedHeaders({ userId, method: "GET", path }),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

  assert.equal(res.status, 200);
  assert.equal(res.body?.data_subject_id, userId);
});
