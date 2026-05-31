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

## Resilience-tab demo-data trap
`app/(tabs)/resilience.tsx` is an ungated tab (every user sees it) but is built around the
ENTERPRISE score shape AND its `fetchScores` is never invoked (the mount `useEffect(()=>{},[])`
is empty). So it always renders a hardcoded `demoScore` (eri 72 / cps 76 / nsb 58 / …) for
everyone. This is fabricated static data — an App-Review and paid-user-trust risk. Real
individual data for this tab would have to come from `/api/app-user/:id/baseline`, which lacks
the 4 sub-metrics, so populating it honestly requires redesigning which metrics it shows.

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
