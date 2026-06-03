/**
 * Regression test for the `active_install` tag on the IAP device-auth REJECTION
 * captures (`requireUserOrDevice` in routes/iap.ts).
 *
 * The IAP entitlements path rejects device-signature failures INDEPENDENTLY of
 * the general per-:id gate and intentionally ignores DEVICE_AUTH_SOFT_MODE. The
 * strict/IAP lockout monitor
 * (docs/monitors/device-signature-lockout-strict-iap.json) must page only when
 * REAL (device-aware) installs get rejected, not on the harmless steady tail of
 * pre-handshake installs that never send the headers and always land on
 * `missing`. The gate therefore tags every non-ok verdict with
 * `extra.active_install`, emitted under the `iap_device_auth:<status>` message
 * family:
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

// Hard mode is the default; set a server key before importing the router so the
// whole module tree agrees. The IAP gate ignores soft mode regardless.
const SERVER_DEVICE_KEY = `test-device-key-${randomUUID()}${randomUUID()}`;
process.env.SERVER_DEVICE_KEY = SERVER_DEVICE_KEY;
delete process.env.DEVICE_AUTH_SOFT_MODE;

const { default: express } = await import("express");
const { default: iapRouter } = await import("./iap");
const { query, default: pool } = await import("../lib/db");

let server: Server;
let baseUrl: string;
const createdUserIds = new Set<string>();

function newUserId(): string {
  const id = `test-iap-activeinstall-${randomUUID()}`;
  createdUserIds.add(id);
  return id;
}

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

/**
 * Intercept the captureMessage console.warn line for a given IAP verdict and
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
    if (typeof first === "string" && first.includes(`iap_device_auth:${verdict}`)) {
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
    const ids = [...createdUserIds];
    await query(`DELETE FROM iap_entitlements WHERE user_id = ANY($1)`, [ids]);
    await query(`DELETE FROM device_request_nonces WHERE user_id = ANY($1)`, [ids]);
  }
  await new Promise<void>((resolve, reject) => {
    if (!server) return resolve();
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await pool.end();
});

test("an unsigned entitlements request (no device-auth headers) is tagged active_install:false", async () => {
  const userId = newUserId();

  const log = await captureVerdict("missing", async () => {
    const res = await fetch(`${baseUrl}/api/iap/entitlements`, {
      method: "GET",
      headers: { "x-user-id": userId },
    });
    assert.equal(res.status, 401, "an unsigned IAP request must be rejected");
  });

  assert.ok(log, "an iap_device_auth:missing capture must be emitted");
  assert.equal(log.message, "iap_device_auth:missing");
  assert.equal(
    log.extra.active_install,
    false,
    "a header-less (pre-handshake) install must NOT be flagged active — the monitor ignores this tail",
  );
});

test("a tampered entitlements signature (device-aware client) is tagged active_install:true", async () => {
  const userId = newUserId();
  const headers = signedHeaders(userId);
  headers["x-signature"] = headers["x-signature"]!.replace(/.$/, (c) =>
    c === "0" ? "1" : "0",
  );

  const log = await captureVerdict("invalid", async () => {
    const res = await fetch(`${baseUrl}/api/iap/entitlements`, { method: "GET", headers });
    assert.equal(res.status, 401, "a tampered IAP signature must be rejected");
  });

  assert.ok(log, "an iap_device_auth:invalid capture must be emitted");
  assert.equal(log.message, "iap_device_auth:invalid");
  assert.equal(
    log.extra.active_install,
    true,
    "a request that carried device-auth headers is a real install — the monitor must page on these",
  );
});

test("a partial-header entitlements request (handshake-capable but broken) is tagged active_install:true", async () => {
  const userId = newUserId();

  // x-user-id plus only X-Device-Id: a device-aware client whose other headers
  // got dropped by a regression. This lands on `missing` but is still ACTIVE —
  // the discriminator is "sent >=1 device-auth header", not "all 4".
  const log = await captureVerdict("missing", async () => {
    const res = await fetch(`${baseUrl}/api/iap/entitlements`, {
      method: "GET",
      headers: { "x-user-id": userId, "x-device-id": `device-${randomUUID()}` },
    });
    assert.equal(res.status, 401, "a partial-header IAP request must be rejected");
  });

  assert.ok(log, "an iap_device_auth:missing capture must be emitted");
  assert.equal(
    log.extra.active_install,
    true,
    "any device-auth header present marks an active install, even on a `missing` verdict",
  );
});
