/**
 * Regression test for the emergency soft-mode rollback escape hatch on the
 * per-:id device-signature gate (lib/deviceAuth.ts).
 *
 * Hard mode is the default (see `app-user.deviceAuth.test.ts`). As an emergency
 * rollback ONLY, `DEVICE_AUTH_SOFT_MODE=1` must let an unsigned request through
 * instead of 401ing it, so the rollback path stays trustworthy if signature
 * verification ever needs to be disabled in production. deviceAuth resolves
 * hard/soft mode once at module load, so this lives in its own file: the node
 * test runner isolates each test file in its own process, and we set the env
 * var BEFORE importing the router.
 *
 * Run with: pnpm --filter @workspace/api-server test
 *
 * Requires DATABASE_URL (the dev database is fine). Each test uses its own
 * disposable user_id and every row is deleted in the `after` hook.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// Activate the soft-mode escape hatch BEFORE importing the router. A server key
// is still configured so this proves soft mode (not a missing-key bypass) is
// what lets the unsigned request through.
process.env.SERVER_DEVICE_KEY = `test-device-key-${randomUUID()}${randomUUID()}`;
process.env.DEVICE_AUTH_SOFT_MODE = "1";
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
    await query(`DELETE FROM app_users WHERE id = ANY($1)`, [ids]);
  }
  await new Promise<void>((resolve, reject) => {
    if (!server) return resolve();
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await pool.end();
});

test("DEVICE_AUTH_SOFT_MODE=1 lets an UNSIGNED outcome request through (200)", async () => {
  const userId = newUserId();
  await registerUser(userId);

  // No signature headers at all. In hard mode this is a 401 (proven in the
  // sibling test); in soft mode the middleware logs the verdict and calls
  // next(), so the handler runs and the request succeeds.
  const body = { action_taken: "breathwork", pre_score: 40, post_score: 55 };
  const res = await fetch(`${baseUrl}/api/app-user/${userId}/outcome`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json: any = await res.json().catch(() => null);

  assert.equal(res.status, 200, "soft mode must NOT reject an unsigned request");
  assert.equal(json?.success, true);
  assert.equal(json?.delta, 15);
});
