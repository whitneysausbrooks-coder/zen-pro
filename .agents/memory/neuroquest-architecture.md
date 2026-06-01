---
name: NeuroQuest dual identity + resilience score sourcing
description: Two separate user tracks with DIFFERENT resilience-score shapes; where each is displayed; the Resilience-tab demo-data trap.
---

# NeuroQuest user tracks & resilience score sourcing

There are TWO independent user identity + scoring tracks. Confusing them wastes hours.

- **Individual / mobile track** (the paid App Store users): identity is a client-generated
  `user_id` UUID held in SecureStore (`lib/userAuth.ts`), registered via
  `POST /api/app-user/register` which mints a per-device HMAC secret. Their resilience score
  is a single **`neuro_resilience_score`** (+ `ema_7day`, trend) stored in `app_user_biometrics`,
  served by `GET /api/app-user/:id/baseline`. It is displayed on the HOME tab via
  `components/AiBaselineCard.tsx` and on `app/wearable.tsx`. This path is real and works.
- **Enterprise / B2B track**: Clerk identity; resilience stored in `resilience_scores` with a
  RICHER shape — `eri, cps, nsb, cohesion, wri, burnout_risk` — served by
  `GET /api/enterprise/scores/:userId` (needs `x-enterprise-key`).

**Key gotcha:** the two tracks do NOT share a score shape. Individual users have only
`neuro_resilience_score`; they do NOT have eri/cps/nsb/cohesion/wri. Any UI that wants those
four sub-metrics can only get real values for enterprise users.

## Resilience-tab demo-data trap (FIXED)
`app/(tabs)/resilience.tsx` used to be an ungated tab built around the ENTERPRISE score shape
whose `fetchScores` was never invoked (empty mount effect), so it always rendered a hardcoded
`demoScore` (eri 72 / cps 76 / nsb 58 / …) to every user — fabricated static data, an
App-Review/paid-user-trust risk.
**Now rebuilt** around the individual user's REAL data: fetches `fetchBaseline()` on focus
(`useFocusEffect`), shows the real `neuro_resilience_score` ring + 7-day EMA + trend +
session count, status pill derived from the server `suggestion.type`, and the score-driving
components (HRV 50% / Sleep 35% / Activity 15%) read locally via `readLatestMetrics()` with
"Not synced" fallbacks. Has three distinct non-score states: loading, **load error** (had a
stored userId but `fetchBaseline()` returned null → offline/server, offers Retry), and
**building baseline** (genuinely no score yet → CTA to /wearable). Breathing Reset Protocol kept.
**Why the load-error split matters:** `fetchBaseline()` returns null for BOTH "no identity" and
"request failed", so without the userId check a connectivity blip would falsely show
"building baseline" to a user who actually has data. Don't collapse these states back together.

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
