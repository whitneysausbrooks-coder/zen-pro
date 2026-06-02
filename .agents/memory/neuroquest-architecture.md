---
name: NeuroQuest architecture — individual wellness only
description: Single user track (device-key individual); enterprise/B2B fully removed; resilience score sourcing; IAP; lucide gotcha.
---

# NeuroQuest architecture — individual wellness only

Enterprise/B2B features have been fully removed. There is now ONE user track.

## Individual / mobile track (the only track)
Identity is a client-generated `user_id` UUID held in SecureStore (`lib/userAuth.ts`),
registered via `POST /api/app-user/register` which mints a per-device HMAC secret.
Resilience score: single **`neuro_resilience_score`** (+ `ema_7day`, trend) stored in
`app_user_biometrics`, served by `GET /api/app-user/:id/baseline`. Displayed on the HOME tab
via `components/AiBaselineCard.tsx` and on `app/wearable.tsx`.

## What was removed
- All enterprise DB tables (companies, enterprise_users, sso_sessions, enterprise_leads, etc.)
  — DROP TABLE IF EXISTS in `migrate.ts` cleans them on next deploy.
- Clerk auth from the API server (`@clerk/express`). Admin routes now gate on `ADMIN_SECRET`
  bearer token. Device-key HMAC is the only auth for user-facing routes.
- Enterprise route files, lib files (billingReconciliation, revenueRecognition, seatEnforcement,
  enterpriseWebhook, clerkUser), and scheduled jobs.
- Pilot/enterprise tabs in mobile OnboardingSignIn and health.ts sync.
- Enterprise UI in web: wearable-setup enterprise form, dashboard "Corporate Wellness" card,
  landing "For Teams" footer link.

## Resilience-tab real-data (not demo data)
`app/(tabs)/resilience.tsx` fetches the individual user's REAL data: `fetchBaseline()` on focus,
shows real `neuro_resilience_score` ring + 7-day EMA + trend + session count.
Three states: loading, **load error** (userId present but server returned null — don't collapse with
"building baseline"), **building baseline** (no score yet). Don't merge the error and building states.

## IAP (paid users)
Real & production-ready: `lib/iap.ts` (expo-iap, iOS-only) → `POST /api/iap/validate`
(`verifyAppleReceipt` with `APPLE_IAP_SHARED_SECRET`, 21007 sandbox fallback) → entitlements in
`iap_entitlements`; gated via `GET /api/iap/entitlements` (`pro_active`). App Store Server
Notifications V2 webhook is JWS-verified against a bundled Apple Root CA. `APPLE_IAP_SHARED_SECRET`
MUST be set in production or validation fails.

## lucide `Infinity` collision (web)
In `neuro-quest` web, importing lucide's `Infinity` icon shadows the global `Infinity`, breaking
`repeat: Infinity` framer-motion loops with a TS error. Alias the icon import (`Infinity as
InfinityIcon`) — don't import a lucide icon under a JS global's name.
