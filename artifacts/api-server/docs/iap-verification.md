# IAP (Adapty) purchase + webhook verification

Adapty is the single source of truth for iOS purchases and entitlements. The
client purchases through the Adapty SDK and reads the live access level from the
on-device Adapty profile; the server keeps a lightweight mirror of entitlement
state in `iap_entitlements`, updated exclusively by Adapty's server-to-server
webhook (`POST /api/iap/adapty-webhook`).

Verification therefore has two halves:

1. **Server-side webhook → `iap_entitlements` mirror** — reproducible here, no
   device required. Automated and passing (see below).
2. **On-device SDK flow** (purchase / restore / identify) — requires a real
   EAS dev-client / TestFlight build with App Store sandbox accounts. Manual
   checklist below; cannot be run from this environment.

---

## 1. Server-side webhook (automated, reproducible)

Harness: `scripts/verify-iap-webhook.ts`. It reads `ADAPTY_WEBHOOK_SECRET` from
the environment (never printed), drives the webhook through its full lifecycle,
and asserts the `iap_entitlements` row after each event, cleaning up its own
test rows.

Run (server must be up):

```bash
# from artifacts/api-server, with the same env the server uses
BASE_URL=http://localhost:80 tsx scripts/verify-iap-webhook.ts
```

Covered assertions (all passing — 14/14):

- Auth gate: missing / wrong `Authorization` header → `401` (constant-time
  compare against `ADAPTY_WEBHOOK_SECRET`).
- `subscription_started` → upserts an **active** `subscription` row with expiry.
- `subscription_renewed` → **extends** the expiry, stays active.
- `subscription_renewal_cancelled` and `access_level_updated` → acknowledged
  **no-ops**; the mirror is unchanged (proves non-directional events can't
  falsely grant or revoke Pro).
- `non_subscription_purchase` → **active** `non_consumable` row, no expiry.
- Event with no `customer_user_id` → ignored (anonymous Adapty profiles can't be
  mirrored until `identify()` is called).
- `subscription_expired` → row flipped to **expired**.

> Directional-events rule: only unambiguously directional event types mutate the
> mirror. See `src/routes/iap.ts` (`ACTIVATING_EVENTS` / `DEACTIVATING_EVENTS`)
> and `.agents/memory/adapty-monetization.md`.

### Configuration confirmed

- `ADAPTY_WEBHOOK_SECRET` — present (secret).
- `EXPO_PUBLIC_ADAPTY_SDK_KEY` — present (secret); public SDK key, also needs to
  be an EAS secret to embed at build time (see below).
- `ADAPTY_ACCESS_LEVEL` — unset; server defaults to `premium` (matches the
  client `EXPO_PUBLIC_ADAPTY_ACCESS_LEVEL` default).
- `iap_entitlements` table + `UNIQUE (user_id, product_id)` present
  (`src/lib/migrate.ts`).
- Client SDK guarding confirmed correct in
  `artifacts/neuro-quest-mobile/lib/adapty.ts` (gated on `Platform.OS`, Expo Go
  `appOwnership`, and SDK-key presence; native module lazily `require`d).

---

## 2. On-device flow (manual — required before launch)

These steps need a physical iOS device, an Apple Developer account, App Store
sandbox accounts, an Expo/EAS login, and the Adapty dashboard. They cannot be
performed in the Replit environment.

### a. EAS secret + dev-client build

- [ ] Add the Adapty public SDK key as an EAS secret so it is embedded at build
      time:
      `eas secret:create --scope project --name EXPO_PUBLIC_ADAPTY_SDK_KEY --value <key>`
- [ ] Build and install a dev client on a real device:
      `eas build --profile development --platform ios` (see `eas.json`).

### b. Adapty dashboard

- [ ] Products, the `zenpro` placement paywall, and the `premium` access level
      are configured (see `.agents/memory/adapty-remote-paywall.md`).
- [ ] Webhook configured: `POST https://<your-domain>/api/iap/adapty-webhook`
      with the `Authorization` header set to the exact `ADAPTY_WEBHOOK_SECRET`
      value.

### c. Sandbox purchase / restore / identify (on device)

- [ ] Sign in to an App Store **sandbox** account on the device.
- [ ] Purchase a Pro product → the on-device Adapty profile shows the `premium`
      access level active; the app unlocks Pro.
- [ ] Confirm the webhook fired and the server mirror updated: an
      `iap_entitlements` row exists for the app user with `status = active`.
      (Spot-check via the DB, or `GET /api/iap/entitlements` from the app.)
- [ ] **Restore purchases** on a fresh install / second device → Pro is
      restored from the Adapty profile.
- [ ] **Identify**: confirm the webhook arrives with `customer_user_id` equal to
      the app's `app_users.id` (so the mirror row is keyed to the right user).
- [ ] Let a sandbox subscription lapse (or refund) → `subscription_expired` /
      `subscription_refunded` webhook flips the mirror row to `expired`.
