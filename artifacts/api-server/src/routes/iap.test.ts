/**
 * Regression tests for the Adapty subscription webhook.
 *
 * `POST /api/iap/adapty-webhook` is the ONLY path that keeps the server's
 * `iap_entitlements` mirror in sync with App Store subscriptions. A silent
 * regression here could grant Pro to everyone or fail to expire lapsed
 * subscribers, and nothing else would catch it. These tests pin the exact
 * mirror-row state for every directional / non-directional event class plus
 * the auth gate.
 *
 * Run with: pnpm --filter @workspace/api-server test
 *
 * Requires DATABASE_URL (the dev database is fine). Each test uses its own
 * disposable user_id and every row is deleted in the `after` hook, so the
 * suite never touches real user data.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// The webhook reads ADAPTY_ACCESS_LEVEL at module load and the shared secret
// at request time, so set both BEFORE importing the router (and use dynamic
// imports so the assignment runs first).
const WEBHOOK_SECRET = `test-secret-${randomUUID()}`;
const ACCESS_LEVEL = "premium";
process.env.ADAPTY_WEBHOOK_SECRET = WEBHOOK_SECRET;
process.env.ADAPTY_ACCESS_LEVEL = ACCESS_LEVEL;

const { default: express } = await import("express");
const { default: iapRouter } = await import("./iap");
const { query, default: pool } = await import("../lib/db");

let server: Server;
let baseUrl: string;
const createdUserIds = new Set<string>();

function newUserId(): string {
  const id = `test-iap-${randomUUID()}`;
  createdUserIds.add(id);
  return id;
}

interface WebhookResponse {
  status: number;
  body: any;
}

async function postWebhook(
  payload: unknown,
  opts: { authorization?: string | null } = {},
): Promise<WebhookResponse> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  // `authorization: null` means "send no header"; `undefined` means "send the
  // valid secret" (the common case).
  if (opts.authorization === undefined) {
    headers.authorization = WEBHOOK_SECRET;
  } else if (opts.authorization !== null) {
    headers.authorization = opts.authorization;
  }
  const res = await fetch(`${baseUrl}/api/iap/adapty-webhook`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.json() };
}

interface MirrorRow {
  product_id: string;
  kind: string;
  status: string;
  expires_at: Date | null;
}

async function getMirrorRow(userId: string): Promise<MirrorRow | null> {
  const r = await query<MirrorRow>(
    `SELECT product_id, kind, status, expires_at FROM iap_entitlements
     WHERE user_id = $1 AND product_id = $2`,
    [userId, ACCESS_LEVEL],
  );
  return r.rows[0] ?? null;
}

function activatingEvent(
  userId: string,
  eventType: string,
  expiresAt?: string,
): Record<string, unknown> {
  return {
    event_type: eventType,
    event_properties: {
      customer_user_id: userId,
      ...(expiresAt ? { subscription_expires_at: expiresAt } : {}),
    },
  };
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

test("subscription_started -> active subscription row with expiry", async () => {
  const userId = newUserId();
  const expiry = new Date(Date.now() + 30 * 86_400_000).toISOString();

  const res = await postWebhook(activatingEvent(userId, "subscription_started", expiry));
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "active");

  const row = await getMirrorRow(userId);
  assert.ok(row, "mirror row should be created");
  assert.equal(row!.product_id, ACCESS_LEVEL);
  assert.equal(row!.kind, "subscription");
  assert.equal(row!.status, "active");
  assert.equal(new Date(row!.expires_at!).toISOString(), expiry);
});

test("subscription_renewed activates an account", async () => {
  const userId = newUserId();
  const expiry = new Date(Date.now() + 30 * 86_400_000).toISOString();

  await postWebhook(activatingEvent(userId, "subscription_renewed", expiry));

  const row = await getMirrorRow(userId);
  assert.ok(row);
  assert.equal(row!.status, "active");
  assert.equal(row!.kind, "subscription");
  assert.equal(new Date(row!.expires_at!).toISOString(), expiry);
});

test("trial_started -> active subscription row", async () => {
  const userId = newUserId();
  const expiry = new Date(Date.now() + 7 * 86_400_000).toISOString();

  await postWebhook(activatingEvent(userId, "trial_started", expiry));

  const row = await getMirrorRow(userId);
  assert.ok(row);
  assert.equal(row!.status, "active");
  assert.equal(row!.kind, "subscription");
});

test("non_subscription_purchase -> active non_consumable row (no expiry)", async () => {
  const userId = newUserId();

  const res = await postWebhook(activatingEvent(userId, "non_subscription_purchase"));
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "active");

  const row = await getMirrorRow(userId);
  assert.ok(row);
  assert.equal(row!.status, "active");
  assert.equal(row!.kind, "non_consumable");
  assert.equal(row!.expires_at, null);
});

test("renewal extends expiry and stays active", async () => {
  const userId = newUserId();
  const first = new Date(Date.now() + 10 * 86_400_000).toISOString();
  const later = new Date(Date.now() + 40 * 86_400_000).toISOString();

  await postWebhook(activatingEvent(userId, "subscription_started", first));
  const afterFirst = await getMirrorRow(userId);
  assert.equal(new Date(afterFirst!.expires_at!).toISOString(), first);

  await postWebhook(activatingEvent(userId, "subscription_renewed", later));
  const afterRenew = await getMirrorRow(userId);
  assert.equal(afterRenew!.status, "active");
  assert.equal(new Date(afterRenew!.expires_at!).toISOString(), later);
  assert.ok(
    new Date(afterRenew!.expires_at!).getTime() >
      new Date(afterFirst!.expires_at!).getTime(),
    "renewal must push expiry further out",
  );
});

test("non-directional events leave the mirror unchanged", async () => {
  const userId = newUserId();
  const expiry = new Date(Date.now() + 30 * 86_400_000).toISOString();
  await postWebhook(activatingEvent(userId, "subscription_started", expiry));
  const baseline = await getMirrorRow(userId);

  for (const eventType of ["subscription_renewal_cancelled", "access_level_updated"]) {
    const res = await postWebhook(activatingEvent(userId, eventType, expiry));
    assert.equal(res.status, 200);
    assert.equal(res.body.ignored, true, `${eventType} should be ignored`);

    const row = await getMirrorRow(userId);
    assert.equal(row!.status, baseline!.status, `${eventType} must not change status`);
    assert.equal(
      new Date(row!.expires_at!).toISOString(),
      new Date(baseline!.expires_at!).toISOString(),
      `${eventType} must not change expiry`,
    );
  }
});

test("access_level_updated never creates a grant for an unknown user", async () => {
  const userId = newUserId();

  const res = await postWebhook(activatingEvent(userId, "access_level_updated"));
  assert.equal(res.status, 200);
  assert.equal(res.body.ignored, true);

  const row = await getMirrorRow(userId);
  assert.equal(row, null, "ambiguous event must not grant Pro out of nowhere");
});

test("subscription_expired flips an active row to expired", async () => {
  const userId = newUserId();
  const expiry = new Date(Date.now() + 30 * 86_400_000).toISOString();
  await postWebhook(activatingEvent(userId, "subscription_started", expiry));

  const res = await postWebhook(activatingEvent(userId, "subscription_expired"));
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "expired");

  const row = await getMirrorRow(userId);
  assert.equal(row!.status, "expired");
});

test("subscription_refunded flips an active row to expired", async () => {
  const userId = newUserId();
  const expiry = new Date(Date.now() + 30 * 86_400_000).toISOString();
  await postWebhook(activatingEvent(userId, "subscription_started", expiry));

  const res = await postWebhook(activatingEvent(userId, "subscription_refunded"));
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "expired");

  const row = await getMirrorRow(userId);
  assert.equal(row!.status, "expired");
});

test("missing customer_user_id is ignored (no row created)", async () => {
  const res = await postWebhook({
    event_type: "subscription_started",
    event_properties: {
      subscription_expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.ignored, "no customer_user_id");
});

test("missing Authorization header -> 401, no mutation", async () => {
  const userId = newUserId();
  const expiry = new Date(Date.now() + 30 * 86_400_000).toISOString();

  const res = await postWebhook(activatingEvent(userId, "subscription_started", expiry), {
    authorization: null,
  });
  assert.equal(res.status, 401);

  const row = await getMirrorRow(userId);
  assert.equal(row, null, "unauthorized request must not touch the mirror");
});

test("wrong Authorization header -> 401, no mutation", async () => {
  const userId = newUserId();
  const expiry = new Date(Date.now() + 30 * 86_400_000).toISOString();

  const res = await postWebhook(activatingEvent(userId, "subscription_started", expiry), {
    authorization: "definitely-not-the-secret",
  });
  assert.equal(res.status, 401);

  const row = await getMirrorRow(userId);
  assert.equal(row, null, "unauthorized request must not touch the mirror");
});
