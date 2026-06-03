/**
 * Contents-of-the-payload regression tests for the GDPR data-subject endpoints
 * — `GET /api/app-user/:id/export` and `POST /api/app-user/:id/delete`
 * (guarded by `requireDeviceSignatureStrict` in routes/app-user.ts).
 *
 * The strict-gate suite (`app-user.deviceAuth.strict.test.ts`) only proves the
 * AUTH gate: its users have no child rows, so a regression that silently dropped
 * a section from the export — or an erasure that failed to anonymize a child
 * table — would still pass it. For a regulated Article 15 (access) / Article 17
 * (erasure) flow the CONTENTS matter as much as the gate, so this file:
 *   - seeds a user with at least one row in EVERY per-user table, runs a
 *     correctly-signed GET /export, and asserts every section is present AND
 *     populated; and
 *   - seeds the same shape, runs a correctly-signed POST /delete, and asserts
 *     the parent PII is anonymized, IP/UA/device_id are stripped from the
 *     auth-event + ToS-acceptance log tables, and every child row SURVIVES
 *     (anonymization-in-place, not hard delete).
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

// The strict gate needs a server device key to verify signatures.
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
    `INSERT INTO app_users (id, email, name, wearable_connected, wearable_type)
     VALUES ($1, $2, $3, true, 'garmin')
     ON CONFLICT (id) DO NOTHING`,
    [userId, `${userId}@example.test`, "Test User"],
  );
}

/**
 * Seed at least one row in every per-user table the /export handler reads and
 * the /delete handler touches. Returns marker values so each section can be
 * asserted as genuinely populated (not just present-but-empty).
 */
async function seedAllTables(userId: string): Promise<{
  ip: string;
  ua: string;
  deviceId: string;
}> {
  const ip = "203.0.113.7";
  const ua = "NeuroQuest/1.0 (seed-test)";
  const deviceId = `device-${randomUUID()}`;

  await query(
    `INSERT INTO app_user_biometrics
       (app_user_id, hrv, sleep_hours, steps, strain_score,
        neuro_resilience_score, ema_7day, data_source)
     VALUES ($1, 65, 7.5, 8200, 9, 72.5, 72.5, 'manual')`,
    [userId],
  );
  await query(
    `INSERT INTO app_user_ai_personalization
       (app_user_id, suggestion_type, suggestion_payload, triggered_score,
        accepted, feedback_rating, responded_at)
     VALUES ($1, 'recovery', $2, 55, true, 4, now())`,
    [userId, JSON.stringify({ message: "seed suggestion" })],
  );
  await query(
    `INSERT INTO app_user_tos_acceptances
       (app_user_id, tos_version, privacy_version, ip_address, user_agent)
     VALUES ($1, '2026.04.29', '2026.04.29', $2, $3)`,
    [userId, ip, ua],
  );
  await query(
    `INSERT INTO app_user_auth_events
       (app_user_id, event_type, device_id, device_platform, app_version,
        ip_address, user_agent)
     VALUES ($1, 'login', $2, 'ios', '1.0.0', $3, $4)`,
    [userId, deviceId, ip, ua],
  );
  await query(
    `INSERT INTO wearable_sync_errors
       (app_user_id, device_source, error_code, error_message, payload_excerpt)
     VALUES ($1, 'garmin', 'E_TIMEOUT', 'sync timed out', 'partial payload')`,
    [userId],
  );
  await query(
    `INSERT INTO ai_outcome_feedback
       (app_user_id, action_taken, pre_score, post_score, score_delta,
        observed_window_hours, model_version)
     VALUES ($1, 'breathwork', 55, 68, 13, 24, 'tw-v1')`,
    [userId],
  );

  return { ip, ua, deviceId };
}

/**
 * Re-derive the device_secret the same way the server does, then sign a
 * canonical request string. Mirrors lib/deviceAuth.ts exactly so a correctly
 * built request verifies.
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
    // Child rows are ON DELETE CASCADE / SET NULL, but delete explicitly first
    // for the SET NULL log tables so no orphan seed rows are left behind.
    await query(`DELETE FROM app_user_auth_events WHERE app_user_id = ANY($1)`, [ids]);
    await query(`DELETE FROM wearable_sync_errors WHERE app_user_id = ANY($1)`, [ids]);
    await query(`DELETE FROM app_users WHERE id = ANY($1)`, [ids]);
  }
  await new Promise<void>((resolve, reject) => {
    if (!server) return resolve();
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await pool.end();
});

// ---------------- GET /export — contents ----------------

test("a signed export returns every section populated with the user's data", async () => {
  const userId = newUserId();
  await registerUser(userId);
  const { ip, ua, deviceId } = await seedAllTables(userId);

  const path = `/api/app-user/${userId}/export`;
  const res = await getExport(userId, signedHeaders({ userId, method: "GET", path }));

  assert.equal(res.status, 200);
  assert.equal(res.body?.data_subject_id, userId);
  assert.equal(res.body?.export_format_version, "1.0");

  // Profile (parent row) is present and carries the user's identity.
  assert.ok(res.body?.profile, "profile section must be present");
  assert.equal(res.body.profile.id, userId);
  assert.equal(res.body.profile.email, `${userId}@example.test`);
  assert.equal(res.body.profile.name, "Test User");

  // Every per-user section must be an array with at least the seeded row.
  const sections = [
    "biometrics",
    "ai_personalization",
    "tos_acceptances",
    "auth_events",
    "wearable_sync_errors",
    "ai_outcome_feedback",
  ];
  for (const key of sections) {
    assert.ok(Array.isArray(res.body?.[key]), `${key} must be an array`);
    assert.ok(
      res.body[key].length >= 1,
      `${key} must contain the seeded row (was empty — a section was dropped)`,
    );
  }

  // Spot-check that the rows carry the real seeded values, not empty stubs.
  assert.equal(res.body.biometrics[0].neuro_resilience_score, 72.5);
  assert.equal(res.body.ai_personalization[0].suggestion_type, "recovery");
  assert.equal(res.body.tos_acceptances[0].tos_version, "2026.04.29");
  assert.equal(res.body.tos_acceptances[0].ip_address, ip);
  assert.equal(res.body.auth_events[0].event_type, "login");
  assert.equal(res.body.auth_events[0].device_id, deviceId);
  assert.equal(res.body.auth_events[0].user_agent, ua);
  assert.equal(res.body.wearable_sync_errors[0].error_code, "E_TIMEOUT");
  assert.equal(res.body.ai_outcome_feedback[0].action_taken, "breathwork");
});

// ---------------- POST /delete — anonymization-in-place ----------------

test("a signed delete anonymizes parent PII, strips log PII, keeps child rows", async () => {
  const userId = newUserId();
  await registerUser(userId);
  await seedAllTables(userId);

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

  // Parent PII is anonymized in place (PK preserved, email/name tombstoned,
  // wearable fields cleared).
  const profile = await query<{
    id: string;
    email: string;
    name: string;
    wearable_connected: boolean;
    wearable_type: string | null;
  }>(
    `SELECT id, email, name, wearable_connected, wearable_type
       FROM app_users WHERE id = $1`,
    [userId],
  );
  assert.equal(profile.rowCount, 1, "the parent row must survive (anonymize, not delete)");
  assert.equal(profile.rows[0].id, userId, "the primary key is preserved");
  assert.ok(
    profile.rows[0].email.startsWith("deleted_"),
    "email must be anonymized to a tombstone",
  );
  assert.ok(
    profile.rows[0].name.startsWith("deleted_"),
    "name must be anonymized to a tombstone",
  );
  assert.equal(profile.rows[0].wearable_connected, false);
  assert.equal(profile.rows[0].wearable_type, null);

  // Auth-event log rows survive but have IP / UA / device_id stripped.
  const authEvents = await query<{
    ip_address: string | null;
    user_agent: string | null;
    device_id: string | null;
    event_type: string;
  }>(
    `SELECT ip_address, user_agent, device_id, event_type
       FROM app_user_auth_events WHERE app_user_id = $1`,
    [userId],
  );
  assert.ok((authEvents.rowCount ?? 0) >= 1, "auth-event rows must survive erasure");
  for (const row of authEvents.rows) {
    assert.equal(row.ip_address, null, "auth_events.ip_address must be stripped");
    assert.equal(row.user_agent, null, "auth_events.user_agent must be stripped");
    assert.equal(row.device_id, null, "auth_events.device_id must be stripped");
    // Non-PII columns are retained so the log keeps forensic value.
    assert.equal(row.event_type, "login");
  }

  // ToS-acceptance log rows survive but have IP / UA stripped (versions kept).
  const tos = await query<{
    ip_address: string | null;
    user_agent: string | null;
    tos_version: string;
  }>(
    `SELECT ip_address, user_agent, tos_version
       FROM app_user_tos_acceptances WHERE app_user_id = $1`,
    [userId],
  );
  assert.ok((tos.rowCount ?? 0) >= 1, "tos-acceptance rows must survive erasure");
  for (const row of tos.rows) {
    assert.equal(row.ip_address, null, "tos_acceptances.ip_address must be stripped");
    assert.equal(row.user_agent, null, "tos_acceptances.user_agent must be stripped");
    assert.equal(row.tos_version, "2026.04.29", "tos_version must be retained");
  }

  // The remaining child tables survive (de-identified by the parent anonymization).
  for (const table of [
    "app_user_biometrics",
    "app_user_ai_personalization",
    "wearable_sync_errors",
    "ai_outcome_feedback",
  ]) {
    const c = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM ${table} WHERE app_user_id = $1`,
      [userId],
    );
    assert.ok(
      Number(c.rows[0].n) >= 1,
      `${table} rows must survive erasure (anonymize-in-place, not hard delete)`,
    );
  }
});
