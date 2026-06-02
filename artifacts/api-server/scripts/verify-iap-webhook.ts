#!/usr/bin/env tsx
/**
 * Adapty webhook verification harness (server-side half of the IAP flow).
 *
 * Drives POST /iap/adapty-webhook through its full lifecycle and asserts the
 * resulting `iap_entitlements` mirror state after each event. This is the part
 * of the purchase flow that lives on the server and can be reproduced without a
 * device. The on-device half (SDK purchase/restore/identify on a dev-client /
 * TestFlight build) must be validated manually — see docs/iap-verification.md.
 *
 * Auth: reads ADAPTY_WEBHOOK_SECRET from the environment and sends it as the
 * Authorization header. The secret is never printed. Run with the same env the
 * server uses, e.g.:
 *
 *   BASE_URL=http://localhost:80 tsx scripts/verify-iap-webhook.ts
 *
 * Exits 0 if every assertion passes, 1 otherwise. Cleans up its own test rows.
 */
import { query } from "../src/lib/db.js";

const SECRET = process.env.ADAPTY_WEBHOOK_SECRET;
const BASE = (process.env.BASE_URL || "http://localhost:80").replace(/\/$/, "");
const URL = `${BASE}/api/iap/adapty-webhook`;
const ACCESS_LEVEL = process.env.ADAPTY_ACCESS_LEVEL || "premium";

const UID = `iapverify-${Date.now()}`;
const UID_NS = `${UID}-ns`;

let passed = 0;
let failed = 0;

function check(label: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function post(body: unknown, authHeader?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authHeader !== undefined) headers["Authorization"] = authHeader;
  const res = await fetch(URL, { method: "POST", headers, body: JSON.stringify(body) });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, json };
}

async function rowFor(userId: string) {
  const r = await query(
    `SELECT status, kind, expires_at FROM iap_entitlements WHERE user_id = $1 AND product_id = $2`,
    [userId, ACCESS_LEVEL],
  );
  return r.rows[0] ?? null;
}

async function cleanup() {
  await query(`DELETE FROM iap_entitlements WHERE user_id = ANY($1)`, [[UID, UID_NS]]);
}

async function run() {
  if (!SECRET) {
    console.error("ADAPTY_WEBHOOK_SECRET is not set in the environment — cannot run.");
    process.exit(1);
  }

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  ADAPTY WEBHOOK VERIFICATION — server-side IAP mirror         ║");
  console.log(`║  target: ${URL.padEnd(50)}║`);
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  await cleanup();

  const exp1 = new Date(Date.now() + 30 * 864e5).toISOString();
  const exp2 = new Date(Date.now() + 60 * 864e5).toISOString();

  // --- Auth gate ---------------------------------------------------------
  console.log("Auth gate:");
  check("missing Authorization → 401", (await post({ event_type: "subscription_started" })).status === 401);
  check("wrong Authorization → 401", (await post({ event_type: "subscription_started" }, "definitely-wrong")).status === 401);

  // --- Activation --------------------------------------------------------
  console.log("\nActivation:");
  let r = await post({ event_type: "subscription_started", event_properties: { customer_user_id: UID, subscription_expires_at: exp1 } }, SECRET);
  check("subscription_started → 200 active", r.status === 200 && r.json?.status === "active");
  let row = await rowFor(UID);
  check("row is active subscription with expiry", !!row && row.status === "active" && row.kind === "subscription" && !!row.expires_at, JSON.stringify(row));

  // --- Renewal extends expiry -------------------------------------------
  console.log("\nRenewal:");
  r = await post({ event_type: "subscription_renewed", event_properties: { customer_user_id: UID, subscription_expires_at: exp2 } }, SECRET);
  check("subscription_renewed → 200 active", r.status === 200 && r.json?.status === "active");
  row = await rowFor(UID);
  check("expiry extended to renewal date", !!row && new Date(row.expires_at).toISOString() === exp2, JSON.stringify(row?.expires_at));

  // --- Non-directional events do NOT corrupt the mirror ------------------
  console.log("\nNon-directional events (must be no-ops):");
  const before = await rowFor(UID);
  r = await post({ event_type: "subscription_renewal_cancelled", event_properties: { customer_user_id: UID } }, SECRET);
  check("subscription_renewal_cancelled → 200 ignored", r.status === 200 && r.json?.ignored === true);
  r = await post({ event_type: "access_level_updated", event_properties: { customer_user_id: UID } }, SECRET);
  check("access_level_updated → 200 ignored", r.status === 200 && r.json?.ignored === true);
  const after = await rowFor(UID);
  check("mirror unchanged after no-op events", JSON.stringify(before) === JSON.stringify(after), JSON.stringify({ before, after }));

  // --- Non-subscription purchase ----------------------------------------
  console.log("\nNon-subscription purchase:");
  r = await post({ event_type: "non_subscription_purchase", event_properties: { customer_user_id: UID_NS } }, SECRET);
  check("non_subscription_purchase → 200 active", r.status === 200 && r.json?.status === "active");
  row = await rowFor(UID_NS);
  check("row is active non_consumable, no expiry", !!row && row.status === "active" && row.kind === "non_consumable" && row.expires_at === null, JSON.stringify(row));

  // --- Anonymous (no identify) ------------------------------------------
  console.log("\nAnonymous event:");
  r = await post({ event_type: "subscription_started", event_properties: {} }, SECRET);
  check("missing customer_user_id → 200 ignored", r.status === 200 && r.json?.ignored === "no customer_user_id");

  // --- Deactivation ------------------------------------------------------
  console.log("\nDeactivation:");
  r = await post({ event_type: "subscription_expired", event_properties: { customer_user_id: UID } }, SECRET);
  check("subscription_expired → 200 expired", r.status === 200 && r.json?.status === "expired");
  row = await rowFor(UID);
  check("subscription row flipped to expired", !!row && row.status === "expired", JSON.stringify(row));

  await cleanup();

  console.log(`\n${failed === 0 ? "✅" : "❌"} RESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  cleanup().finally(() => process.exit(1));
});
