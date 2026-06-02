/**
 * Regression test for the SAMPLED success log on the per-:id device-signature
 * gate (lib/deviceAuth.ts).
 *
 * Non-ok verdicts were always logged, but a correctly signed (ok) request used
 * to return immediately with no capture — so monitoring could confirm "no spike
 * of failures" but could never compute a true pass rate. The middleware now
 * emits a sampled `device_signature:ok` capture so the ok-vs-rejected ratio is
 * directly measurable.
 *
 * Successes are sampled (default 1%); this test forces a deterministic 100%
 * sample with `DEVICE_AUTH_SUCCESS_SAMPLE_RATE=1` so a single signed request is
 * guaranteed to emit exactly one capture. deviceAuth resolves the sample rate
 * once at module load, so this lives in its own file: the node test runner
 * isolates each test file in its own process, and we set the env var BEFORE
 * importing the router.
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

// Force every success to be logged so the assertion is deterministic, and
// configure a server key so signatures actually verify. Set BOTH before the
// router (and thus deviceAuth) is imported, because the sample rate is resolved
// once at module load.
const SERVER_DEVICE_KEY = `test-device-key-${randomUUID()}${randomUUID()}`;
process.env.SERVER_DEVICE_KEY = SERVER_DEVICE_KEY;
process.env.DEVICE_AUTH_SUCCESS_SAMPLE_RATE = "1";
delete process.env.DEVICE_AUTH_SOFT_MODE;
delete process.env.DEVICE_AUTH_HARD_MODE;

const { default: express } = await import("express");
const { default: appUserRouter } = await import("./app-user");
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

function signedHeaders(opts: {
  userId: string;
  method?: string;
  path: string;
  body?: unknown;
}): Record<string, string> {
  const method = opts.method ?? "POST";
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

test("a correctly signed request emits a sampled device_signature:ok capture with metadata", async () => {
  const userId = newUserId();
  await registerUser(userId);

  // captureMessage writes a JSON line to console.warn. Intercept it so we can
  // assert the success capture was emitted with enough metadata to compute a
  // pass rate.
  const captured: any[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const first = args[0];
    if (typeof first === "string" && first.includes("device_signature:ok")) {
      try {
        captured.push(JSON.parse(first));
      } catch {
        // ignore non-JSON lines
      }
    }
  };

  try {
    const body = { action_taken: "breathwork", pre_score: 50, post_score: 62 };
    const path = `/api/app-user/${userId}/outcome`;
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: signedHeaders({ userId, path, body }),
      body: JSON.stringify(body),
    });
    assert.equal(res.status, 200, "the signed request itself must still succeed");
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(
    captured.length,
    1,
    "exactly one device_signature:ok capture must be emitted at 100% sampling",
  );
  const log = captured[0];
  assert.equal(log.message, "device_signature:ok");
  assert.equal(log.user_id, userId);
  assert.ok(
    typeof log.route === "string" && log.route.includes("/outcome"),
    "the capture must carry the route so a per-route pass rate is computable",
  );
  assert.equal(log.extra.hard_mode, true, "hard_mode flag must travel with the capture");
  assert.equal(log.extra.sampled, true);
  assert.equal(
    log.extra.sample_rate,
    1,
    "sample_rate must travel with the capture so the count can be scaled to true volume",
  );
});
