# Apple App Review Checklist — NQ Zen Pro 1.0

Verified against Whitney's Zero-Defect brief AND her ZenPro Developer Sprint
Checklist on the date of this build.

## Backend Hardening (ZenPro Sprint, April 29 2026)

- [x] **Rate limiting on every `/api/*` endpoint.** 120 req/min per
  user_id-or-IP, returns standard `RateLimit-*` headers + 429 with
  `retry-after`. Source: `artifacts/api-server/src/middlewares/security.ts`.
- [x] **Helmet security headers + HSTS in production.** `X-Frame-Options`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
  `Strict-Transport-Security` (prod only). Confirmed via
  `curl -I` smoke test.
- [x] **JSON body size capped (32KB soft, 1MB hard).** Hostile payloads
  rejected with 413 before they reach the parser.
- [x] **Auth event log (login / logout / session_resume / timeout).**
  Recorded to `app_user_auth_events` with `device_id`, `device_platform`,
  `app_version`, `ip_address`, `user_agent`. Logout event fires BEFORE
  local credentials are wiped so the audit trail attributes the action.
  Source: `lib/userAuth.ts` → `recordAuthEvent`.
- [x] **ToS / Privacy acceptance tracked with version + timestamp.** Backend
  table `app_user_tos_acceptances`, idempotent on same version. Mobile
  helper `acceptCurrentTos()` ready to wire to a UI modal once the
  UI-change exception is approved (modal not yet shipped per the
  "no UI changes" ground rule).
- [x] **Wearable sync errors logged** to `wearable_sync_errors` so silent
  HealthKit / future-SDK failures are visible in the admin dashboard.
  Helper: `recordWearableSyncError`.
- [x] **AI outcome feedback table** records pre/post resilience scores +
  delta + `model_version` per recommendation, enabling per-user model
  retraining downstream.
- [x] **Crash / error monitoring adapter** ships in
  `lib/errorMonitoring.ts`. Currently emits structured JSON to stdout for
  Replit log aggregation; provider DSN can be wired without touching call
  sites.
- [x] **All secrets in environment variables** (verified in Replit Secrets
  panel). No keys / tokens checked into the repo.
- [x] **Input validation on every body** via `zod` schemas. Smoke-tested
  rejection paths (action_taken empty → 400; pre_score > 100 → 400).



## Account / Identity

- [x] **Individual sign-up requires Name + Email.** Both fields are validated
  client-side (name ≥ 2 chars, email regex) before "Continue as Individual" is
  enabled. Source: `components/OnboardingSignIn.tsx`.
- [x] **No silent / anonymous accounts.** Backend `/api/app-user/register`
  rejects requests missing name or email with a 400. Source:
  `artifacts/api-server/src/routes/app-user.ts`.
- [x] **User identity persists across reinstalls only on the same install.**
  UUID is stored in iOS Keychain via `expo-secure-store`
  (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`). Reinstall → fresh identity → new private
  baseline. Source: `lib/userAuth.ts`.
- [x] **Account deletion is honored end-to-end.** Profile → Delete Account
  removes local credentials, then calls `/api/account/delete` to remove server
  records (enterprise mode). Source: `lib/health.ts`, `app/(tabs)/profile.tsx`.

## Navigation / UX

- [x] **Bug 3 fix: back navigation from Health screen.** OnboardingHealth
  now exposes a `← Back to Sign In` button (top-left, pill style) that resets
  login + health state and clears the partial individual identity, dropping
  the user back at SignIn cleanly. Source: `components/OnboardingHealth.tsx`,
  `app/_layout.tsx`.
- [x] **Bug 2 audit: every post-login screen is wrapped in a ScrollView.**
  Verified in `app/(tabs)/index.tsx`, `train.tsx`, `play.tsx`,
  `resilience.tsx`, `shop.tsx`, `profile.tsx`, plus `app/wearable.tsx`. Bottom
  insets account for the tab bar (`paddingBottom: insets.bottom + 110`).

## HealthKit / Privacy

- [x] **`NSHealthShareUsageDescription`** is present in `app.json` and
  explains exactly which categories (HRV, Sleep, Steps), the purpose
  (computing the user's personal Neuro-Resilience Score), and the corporate
  data-sharing model (k-anonymity ≥ 5, never name-attached).
- [x] **No HealthKit write access requested.** Only read for HRV, Sleep,
  Steps. Confirmed in `lib/health.ts` (`requestHealthPermissions`).
- [x] **HealthKit denial is gracefully handled.** When permissions are denied
  or no data is returned, the user is offered a Settings shortcut and may
  switch to manual entry without losing onboarding progress.
  (`lib/health.ts:openAppSettings`, `OnboardingHealth.tsx`.)

## In-App Purchases

- [x] **`expo-iap` plugin configured and entitlement validated server-side.**
  `/api/iap/*` routes verify Apple receipts via `APPLE_IAP_SHARED_SECRET`
  before granting Zen Pro entitlement.
- [x] **`ITSAppUsesNonExemptEncryption: false`** declared in `app.json`,
  matching App Store Connect compliance.

## Data Architecture / AI Personalization

- [x] **Individual baseline endpoint live.** `POST /api/app-user/biometrics`
  and `GET /api/app-user/:id/baseline` smoke-tested end-to-end:
  `register → biometrics → baseline` returns the freshly computed
  Triple-Weight Score (HRV 50% / Sleep 35% / Strain 15%) and 7-day EMA.
- [x] **Dashboard surfaces the baseline.** `AiBaselineCard` shows
  "Learning Your Baseline" until the first sync, then displays today's score,
  the 7-day average, the session count, the trend (rising/falling/steady),
  and a personalized suggestion (recovery / growth / burnout_alert).
- [x] **Migrations gate the listener.** API server runs
  `runMigrations()` *before* `app.listen` and exits hard on failure, so the
  listener never accepts traffic against missing tables. Source:
  `artifacts/api-server/src/index.ts`.
- [x] **PII not echoed by unauthenticated endpoints.** `GET /baseline` returns
  `account_type` + score/EMA/trend/suggestion only — no name, no email, no
  raw biometrics. An exposed UUID can only reveal a score, never identity.
  Source: `artifacts/api-server/src/routes/app-user.ts`.
- [x] **Atomic identity writes.** `registerIndividual()` rolls back the UUID
  if the profile write fails, then re-reads both back to verify. Concurrent
  callers share an in-flight `ensureUserId()` promise so two parallel boots
  never mint two UUIDs. Reinstall reconciliation
  (`reconcileLocalIdentity()`) wipes any orphan Keychain UUID with no
  matching profile, so a fresh sign-up never inherits a stranger's baseline.
  Source: `lib/userAuth.ts`, `app/_layout.tsx`.

## Build Hygiene

- [x] **No placeholder text.** Searched the mobile artifact for `lorem`,
  `TODO:`, `FIXME:`, `XXX` — none in user-facing strings.
- [x] **Bundle identifier matches Apple Developer record.**
  `pro.neuroquestzen.app`, owner `whitneyausbrooks`.
- [x] **App icon, splash, and dark-mode treatment present** under
  `assets/images/`.
- [x] **Deep link / universal link origin** declared:
  `expo.plugins.expo-router.origin = "https://neuroquestzen.pro"`.

## Ship Readiness

| Bug                                | Status   |
| ---------------------------------- | -------- |
| Bug 1 — Individual auth bypass     | **FIXED** (name + email required, UUID persisted, backend record created) |
| Bug 2 — Scroll on post-login tabs  | **VERIFIED** (all tabs wrap in ScrollView with correct insets) |
| Bug 3 — Back navigation from Health| **FIXED** (back button + state reset wired in `_layout.tsx`) |
| AI personalization wiring          | **WIRED** (baseline endpoint + dashboard card live) |
| Apple Review checklist             | **PASSED** (this document) |
