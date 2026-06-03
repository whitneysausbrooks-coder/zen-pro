/**
 * Regression test for the `active_install` tag on the STRICT GDPR gate's
 * device-signature REJECTION captures (`requireDeviceSignatureStrict` in
 * routes/app-user.ts).
 *
 * The strict GDPR export/erasure path rejects device-signature failures
 * INDEPENDENTLY of the general per-:id gate and intentionally ignores
 * DEVICE_AUTH_SOFT_MODE. The strict/IAP lockout monitor
 * (docs/monitors/device-signature-lockout-strict-iap.json) must page only when
 * REAL (device-aware) installs get rejected, not on the harmless steady tail of
 * pre-handshake installs that never send the headers and always land on
 * `missing`. The gate therefore tags every non-ok verdict with
 * `extra.active_install`, emitted under the `device_signature_strict:<status>`
 * message family:
 *   - false when the request carries NONE of the device-auth headers
 *     (old / pre-handshake install — expected, must not page)
 *   - true when the request carries at least one device-auth header
 *     (a build that knows the handshake — a rejection here is a real lockout)
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
// once at module load, so this must run before the router is imported. The
// strict gate ignores soft mode regardless, but we keep the default here.
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
  const method = opts.method ?? "GET";
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
 * Intercept the captureMessage console.warn line for a given strict verdict and
 * return the parsed log object (or null if none was emitted). Restores
 * console.warn.
 */
async function captureVerdict(
  verdict: string,
  fn: () => Promise<void>,
): Promise<any | null> {
  const lines: any[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const first = args[0];
    if (typeof first === "string" && first.includes(`device_signature_strict:${verdict}`)) {
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

test("an unsigned EXPORT (no device-auth headers) is tagged active_install:false", async () => {
  const userId = newUserId();
  await registerUser(userId);

  const log = await captureVerdict("missing", async () => {
    const res = await fetch(`${baseUrl}/api/app-user/${userId}/export`, {
      method: "GET",
    });
    assert.equal(res.status, 401, "an unsigned export must be rejected by the strict gate");
  });

  assert.ok(log, "a device_signature_strict:missing capture must be emitted");
  assert.equal(log.message, "device_signature_strict:missing");
  assert.equal(log.extra.scope, "gdpr_strict");
  assert.equal(
    log.extra.active_install,
    false,
    "a header-less (pre-handshake) install must NOT be flagged active — the monitor ignores this tail",
  );
});

test("a tampered EXPORT signature (device-aware client) is tagged active_install:true", async () => {
  const userId = newUserId();
  await registerUser(userId);
  const path = `/api/app-user/${userId}/export`;
  const headers = signedHeaders({ userId, method: "GET", path });
  headers["x-signature"] = headers["x-signature"]!.replace(/.$/, (c) =>
    c === "0" ? "1" : "0",
  );

  const log = await captureVerdict("invalid", async () => {
    const res = await fetch(`${baseUrl}${path}`, { method: "GET", headers });
    assert.equal(res.status, 401, "a tampered export signature must be rejected");
  });

  assert.ok(log, "a device_signature_strict:invalid capture must be emitted");
  assert.equal(log.message, "device_signature_strict:invalid");
  assert.equal(log.extra.scope, "gdpr_strict");
  assert.equal(
    log.extra.active_install,
    true,
    "a request that carried device-auth headers is a real install — the monitor must page on these",
  );
});

test("a partial-header EXPORT (handshake-capable but broken) is tagged active_install:true", async () => {
  const userId = newUserId();
  await registerUser(userId);
  const path = `/api/app-user/${userId}/export`;

  // Only X-Device-Id present: a device-aware client whose other headers got
  // dropped by a regression. This lands on `missing` but is still an ACTIVE
  // install — the discriminator is "sent >=1 device-auth header", not "all 4".
  const log = await captureVerdict("missing", async () => {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      headers: { "x-device-id": `device-${randomUUID()}` },
    });
    assert.equal(res.status, 401, "a partial-header export must be rejected");
  });

  assert.ok(log, "a device_signature_strict:missing capture must be emitted");
  assert.equal(
    log.extra.active_install,
    true,
    "any device-auth header present marks an active install, even on a `missing` verdict",
  );
});
