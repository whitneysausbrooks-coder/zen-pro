/**
 * Regression test for the `active_install` tag on device-signature REJECTION
 * captures (lib/deviceAuth.ts).
 *
 * The wrongful-lockout monitor (docs/monitors/device-signature-lockout.json)
 * must page only when REAL (device-aware) installs get rejected, not on the
 * harmless steady tail of pre-handshake installs that never send the headers
 * and always land on `missing`. The middleware therefore tags every non-ok
 * verdict with `extra.active_install`:
 *   - false when the request carries NONE of the device-auth headers
 *     (old / pre-handshake install — expected, must not page)
 *   - true when the request carries at least one device-auth header
 *     (a build that knows the handshake — a rejection here is a real lockout)
 *
 * If this tag regresses, the monitor can no longer separate the two
 * populations and would either page on the normal tail or miss real lockouts.
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

// Configure a server key so signatures actually verify, and leave the mode
// flags unset so hard mode (the default) is active. deviceAuth resolves mode
// once at module load, so this must run before the router is imported.
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

/**
 * Intercept the captureMessage console.warn line for a given verdict and return
 * the parsed log object (or null if none was emitted). Restores console.warn.
 */
async function captureVerdict(
  verdict: string,
  fn: () => Promise<void>,
): Promise<any | null> {
  const lines: any[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const first = args[0];
    if (typeof first === "string" && first.includes(`device_signature:${verdict}`)) {
      try {
        lines.push(JSON.parse(first));
      } catch {
        // ignore non-JSON lines
      }
    }
  };
  try {
    await fn();
  } finally {
    console.warn = originalWarn;
  }
  return lines.length > 0 ? lines[lines.length - 1] : null;
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

test("an unsigned request (no device-auth headers) is tagged active_install:false", async () => {
  const userId = newUserId();
  await registerUser(userId);
  const body = { action_taken: "breathwork", pre_score: 50, post_score: 62 };

  const log = await captureVerdict("missing", async () => {
    const res = await fetch(`${baseUrl}/api/app-user/${userId}/outcome`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    assert.equal(res.status, 401, "an unsigned request must be rejected in hard mode");
  });

  assert.ok(log, "a device_signature:missing capture must be emitted");
  assert.equal(log.message, "device_signature:missing");
  assert.equal(
    log.extra.active_install,
    false,
    "a header-less (pre-handshake) install must NOT be flagged active — the monitor ignores this tail",
  );
});

test("a tampered signature (device-aware client) is tagged active_install:true", async () => {
  const userId = newUserId();
  await registerUser(userId);
  const body = { action_taken: "breathwork", pre_score: 50, post_score: 62 };
  const path = `/api/app-user/${userId}/outcome`;
  const headers = signedHeaders({ userId, path, body });
  headers["x-signature"] = headers["x-signature"]!.replace(/.$/, (c) =>
    c === "0" ? "1" : "0",
  );

  const log = await captureVerdict("invalid", async () => {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    assert.equal(res.status, 401, "a tampered signature must be rejected");
  });

  assert.ok(log, "a device_signature:invalid capture must be emitted");
  assert.equal(log.message, "device_signature:invalid");
  assert.equal(
    log.extra.active_install,
    true,
    "a request that carried device-auth headers is a real install — the monitor must page on these",
  );
});

test("a partial-header request (handshake-capable but broken) is tagged active_install:true", async () => {
  const userId = newUserId();
  await registerUser(userId);
  const body = { action_taken: "breathwork", pre_score: 50, post_score: 62 };
  const path = `/api/app-user/${userId}/outcome`;

  // Only X-Device-Id present: a device-aware client whose other headers got
  // dropped by a regression. This lands on `missing` but is still an ACTIVE
  // install — the discriminator is "sent >=1 device-auth header", not "all 4".
  const log = await captureVerdict("missing", async () => {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-device-id": `device-${randomUUID()}` },
      body: JSON.stringify(body),
    });
    assert.equal(res.status, 401, "a partial-header request must be rejected");
  });

  assert.ok(log, "a device_signature:missing capture must be emitted");
  assert.equal(
    log.extra.active_install,
    true,
    "any device-auth header present marks an active install, even on a `missing` verdict",
  );
});
