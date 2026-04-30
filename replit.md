# NeuroQuest — Workspace

## Overview

NeuroQuest is a brain-training and wellness application built as a pnpm monorepo using TypeScript. It applies neuroplasticity science through daily cognitive exercises, interactive games, and social features to promote mental well-being. The application features a dual-currency reward system (Neural Energy and Compassion Points) that triggers micro-donations to the World Hunger Relief Fund upon achieving compassion milestones. NeuroQuest integrates monetization tiers, enterprise solutions, and sponsored impact partnerships, aiming to be a compliant Health & Fitness / Lifestyle wellness app focused on engagement and ethical monetization.

## User Preferences

I prefer iterative development, with a focus on delivering functional, well-tested components in stages.
I like clear, concise communication and prefer that you ask before making any major architectural changes or introducing new external dependencies.
Ensure all changes align with the project's brand identity, emphasizing mental wellness, engagement, and ethical monetization.
I expect comprehensive test coverage for new features and modifications.
Do not make changes to files related to internal Replit configurations without explicit instructions.

## System Architecture

The project is structured as a pnpm workspace monorepo using TypeScript, segregating deployable applications (`artifacts`) from shared libraries (`lib`).

**Core Technologies:**
- **Monorepo Tool:** pnpm workspaces
- **Node.js:** Version 24
- **API Framework:** Express 5
- **Database:** PostgreSQL with Drizzle ORM
- **Validation:** Zod and `drizzle-zod`
- **API Codegen:** Orval (from OpenAPI specification)
- **Build Tool:** esbuild

**Project Structure:**
- `artifacts/api-server`: Primary Express API server.
- `lib/api-spec`: OpenAPI specification and Orval configuration.
- `lib/api-client-react`: Generated React Query hooks.
- `lib/api-zod`: Generated Zod schemas for API validation.
- `lib/db`: Drizzle ORM schema and database logic.

**UI/UX and Design ("Luxury Celestial Zen"):**
- **Design Language:** PlayfairDisplay (headings), Inter (body) with a palette of gold, forest green, celestial purple, and nebula accents, cosmic gradient backgrounds, and celestial animations.
- **Neural Audio Engine:** Web Audio API for binaural beats and neural noise.
- **Key Metrics:** Empathy Index, Heart-Brain Hybrid Score (HBHS), and Lives Impacted.
- **UI Philosophy:** "Intentional, clean, and focused" with purpose-driven elements and controlled animations.
- **Behavioral Design Patterns:** Dopamine triggers (CelebrationOverlay), Compassion Loops (linking actions to real-world impact), and No-Shame Loops (graceful handling of streak breaks).

**Feature Specifications:**
- **Monetization (3-Tier):** Zen Pro subscription, Daily Pass, Enterprise Corporate Wellness, and Sponsored Jackpots, with charity contributions.
- **Compassion Impact Tracking:** Local tracking of milestones contributing to real-world donations.
- **Brain Games:** A suite of cognitive exercises.
- **Enterprise Features:** Team Building Exercises, Team Dashboard, ROI Analytics, SSO/SCIM, Burnout Detection, CSR Impact Reports, and privacy-first design.
- **Daily Mindful Tasks:** Reflection-based tasks.
- **Monetization Engine (Mobile Play Screen):** Neural Energy (NE) as universal currency for games, with in-app purchases.
- **Game Mechanics:** Compassion Wheel, Lucky Wheel, Neural Hold, and Diamond Reward, designed to avoid gambling terminology.
- **Navigation:** 6-tab navigation (Home, Train, Play, Resilience, Zen Pro, Profile).
- **Onboarding:** Multi-step premium onboarding flow for mobile and a splash screen for web.
- **Streak System:** Tracks `streak_count` and `last_game_date`.
- **Push Notifications:** Web Push API for smart, admin-triggered pushes.
- **Auth & Paywall:** Clerk authentication with `AuthGate` and `PaywallGate`.
- **Legal:** In-app legal screen (Mobile) and dedicated web pages for policies.
- **Accessibility (Mobile):** Extensive use of accessibility roles, labels, states.

**Enterprise Stack (Zen Pro Enterprise):**
- **Database:** 6 PostgreSQL tables for enterprise data.
- **Scoring Engine:** Deterministic WRI/ERI/CPS/NSB/burnout risk scoring in `api-server`.
- **Enterprise API:** 11 endpoints at `/api/enterprise/*` with Zod validation, API key auth, and audit logging.
- **Burnout Engine v2.0.0:** `analyzeBurnoutV2()` for deterministic burnout detection with personal baselines, anomaly detection, HRV integration, explainability, and predictive projections.
- **Stripe B2B Billing (Hardened):** 10 endpoints for company creation, subscription management, billing inquiries, and webhooks, including dunning, payment failure handling, and billing reconciliation.
- **Seat Enforcement:** Blocks user creation based on subscription status or seat limits.
- **Stripe Tax:** `automatic_tax` enabled with SaaS tax codes.
- **RBAC:** Billing-sensitive operations restricted to `admin` role users.
- **Audit Log Export:** Supports filtering, pagination, and CSV export.
- **ASC 606 Revenue Recognition v2:** Full five-step compliant model for per-seat SaaS subscriptions.
- **Privacy:** Employee-level data anonymized for employers.
- **Wearable Integration (Clinical-Grade v2):** Service ingesting HRV, SleepDuration, Steps from various sources. Computes proprietary NeuroResilienceScore (0-100) using a weighted average of HRV (50%), Sleep (35%), and Activity (15%) with a 7-day Exponential Moving Average. Endpoints for wearable data ingestion and retrieval.
- **SSO/SCIM (Production):** Full OIDC Authorization Code flow and SCIM v2 provisioning. Integrates with Okta, Azure AD, Google Workspace, OneLogin, and custom OIDC. SCIM actions automatically adjust seat counts and ASC 606 revenue schedules.
- **Tenant Branding:** Company-specific dashboard customization via API (logo_url, primary_color, secondary_color, accent_color, custom_domain, welcome_message).
- **Team Heatmap:** Aggregates anonymized NeuroResilienceScores by department, providing risk levels, score distributions, biometric averages, and trends. Includes automatic burnout alerts for critical/high-risk departments.
- **Wearable Engagement Widget (Company Admin Dashboard):** Displays tiered k-anonymity privacy model for wearable engagement metrics.
- **Mobile Native Health Integration (iOS + Android):** Expo mobile app reads HRV, Sleep, and Step Count from Apple HealthKit on iOS (Apple Watch + iPhone) and from Android Health Connect on Android (Galaxy Watch via Samsung Health, Pixel Watch, Wear OS, and any Android wearable that writes to Health Connect). Platform is auto-detected via `isHealthAvailable` / `healthProviderLabel` in `lib/health.ts`; the data source ("apple_health" vs "health_connect") is auto-stamped on every server sync. Uses an email + invite_code identity model for enterprise users.

**In-App Purchase (iOS) Hardening:**
- **Dual-Auth on `/api/iap/{validate,restore,entitlements}`:** Accepts either a Clerk session (web) OR a per-device HMAC handshake (mobile) via `requireUserOrDevice()`. Mobile clients send `X-User-Id` + the standard signed-fetch headers (`X-Device-Id`, `X-Issued-At`, `X-Timestamp`, `X-Signature`); the server re-derives the `device_secret` from `SERVER_DEVICE_KEY` and verifies with `crypto.timingSafeEqual`. This unblocks shop purchases for mobile users who never had a Clerk session.
- **Apple JWS Webhook Verification (`/api/iap/webhook`):** Uses `@apple/app-store-server-library`'s `SignedDataVerifier` to validate the x5c chain against bundled Apple Root CA G3 (DER, base64-inlined for bundler safety; SHA-256 fingerprint `6334:3ABF:...:9179` matches Apple's published value). Tries production verifier first, falls back to sandbox. Inner `signedTransactionInfo` is re-verified in the same environment as the outer envelope. All `productId`/`originalTransactionId`/`expiresDate` reads come from the verified decoded payload only — forged REFUND/EXPIRED/REVOKE notifications cannot mutate entitlement state. Failures emit `iap_webhook:signature_invalid` to Datadog with the `VerificationStatus` enum name for forensics.

**Individual Account Stack:**
- **Identity-Only Auth (no password):** Individual users provide name + email; mobile app generates a stable UUID v4 and persists it securely.
- **Backend Tables:** `app_users`, `app_user_biometrics`, `app_user_ai_personalization` tables created on API server boot. Note: This codebase mixes Drizzle-managed and raw-SQL-managed schema.
- **Endpoints:** `POST /api/app-user/register`, `POST /api/app-user/heartbeat`, `POST /api/app-user/biometrics` (computes Triple-Weight Score), `GET /api/app-user/:id/baseline`, `POST /api/app-user/:id/feedback`.
- **AI Baseline Dashboard Card:** Displays personalized insights, scores, trends, and suggestions based on AI analysis.

**Web Hardening:**
- **BootstrapGate:** Enforces canonical web entry order: onboarding → Clerk sign-in → wearable connect → dashboard. Persists Clerk identity server-side reliably.
- **Reliable Enterprise Identity:** `resolveClerkIdentity()` falls back to Clerk Backend REST API when JWT session claims omit email, with in-process caching.
- **Focus Test Timer:** Wall-clock based 30s countdown for onboarding.
- **Wearable Setup Self-Service Join:** Signed-in users can enter a company invite code to join an enterprise.
- **Mid-Month Seat Changes:** `proration_behavior: "create_prorations"` for Stripe seat updates, with atomic transaction handling for adding members to prevent race conditions.

## External Dependencies

-   **PostgreSQL:** Database persistence.
-   **Drizzle ORM:** ORM for database interactions.
-   **Express:** API server framework.
-   **Zod:** Schema validation.
-   **Orval:** OpenAPI client code generation.
-   **React Query:** Frontend data fetching and caching.
-   **Stripe:** Payment gateway.
-   **Clerk:** User authentication (SSO, Organizations, enterprise identity).
-   **Web Push API (VAPID):** Push notifications.
-   **Apple HealthKit (via `@kingstinct/react-native-healthkit`):** iOS mobile wearable data integration (Apple Watch).
-   **Android Health Connect (via `react-native-health-connect`):** Android mobile wearable data integration (Galaxy Watch, Pixel Watch, Wear OS — anything that writes to Health Connect).

## Recent Changes & Known Follow-ups

### 2026-04-30 — Build #8 surgical fix pass (post-#7 Whitney spec)
Whitney installed Build #7 from TestFlight and reported: share button broken, profile screen missing, home button broken, plus a spec for new additions (Back-to-Login on screen one, expanded user-profile DB columns, AI consent gate placeholder, Fitbit/Garmin interface placeholders).

**Root causes found:**
1. **iOS 26 6-tab overflow.** `app/(tabs)/_layout.tsx` was branching to `expo-router/unstable-native-tabs` when `isLiquidGlassAvailable()` returned true. iOS UITabBar pushes the 6th tab into a hidden "More" stack — Profile (the 6th tab) was hidden in More, and `router.replace("/")` from inside the More-stack didn't pop back to Home. **Fix:** always render `ClassicTabLayout` (preserves all 6 tabs and routes; `NativeTabLayout` retained as dead code with `void` reference for future re-enable).
2. **Share button silently failed.** `shareText()` in `profile.tsx` and `handleShare` in `index.tsx` had empty `} catch {}` blocks that swallowed every Share API rejection. **Fix:** replaced with `Alert.alert("Couldn't share", err.message)` so failures are visible.

**Net additions:**
- **Back-to-Login button on Home (screen one).** Icon `Pressable` (Feather `log-out`) added to `topRight` of `app/(tabs)/index.tsx`. Confirms via Alert, then calls `signOutAndReset()` from `lib/health.ts` — which clears `nq_login_done` / `nq_enterprise_email` from AsyncStorage and triggers signOut listeners that the root state machine in `app/_layout.tsx` already subscribes to. User drops back to `OnboardingSignIn` without an app restart.
- **`app_users` DB columns added** (additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, all with safe defaults, PG11+ metadata-only operation): `display_name`, `auth_provider` (default `'local'`), `onboarding_status` (default `'pending'`), `baseline_status` (default `'pending'`), `health_consent_status` (default `'not_granted'`), `watch_connected_status` (default `'not_connected'`), `updated_at`. Existing rows unaffected. The register/heartbeat routes in `app-user.ts` now write `display_name` and `updated_at` and return the new fields.
- **`analyzeTripleWeightBaseline()` placeholder** in new `artifacts/api-server/src/lib/tripleWeightAi.ts`. Pure function, deterministic, no OpenAI call wired up. Enforces: (a) `consentConfirmed === true`, (b) `baselineDays >= 7`, (c) `sampleCount >= 5`, (d) `anonymizedUserId` rejects raw UUIDs as defense-in-depth.
- **`POST /api/ai/analyze-baseline` route** in new `artifacts/api-server/src/routes/ai.ts`. Same device-or-Clerk auth pattern as `/api/iap/*`. Hashes `user_id` with `SERVER_DEVICE_KEY` HMAC-SHA256 before passing to analyzer. Computes baseline from `app_user_biometrics` server-side (never trusts client-supplied days). Returns 401 unauth, 403 consent_required, 400 baseline_incomplete.
- **Fitbit/Garmin provider stubs** appended to `artifacts/neuro-quest-mobile/lib/health.ts`: typed `WearableProvider` interface, `FitbitProviderStub` and `GarminProviderStub` that throw `not_implemented` if invoked. Pure type contract, no runtime side effects, no permission requests, no network calls. `WEARABLE_PROVIDERS` registry references them so the contract stays enforceable.

**Forward-looking note (NOT a Build #8 blocker, per architect):** When OpenAI is actually wired into `analyzeTripleWeightBaseline`, replace the `SERVER_DEVICE_KEY`-salted HMAC anonymization with HKDF + rotating salt or per-request nonce stored in a mapping table — current scheme is reversible if `SERVER_DEVICE_KEY` leaks.

Verified end-to-end: mobile tsc clean; API tsc clean on all changed files; DB columns confirmed via `psql \d app_users`; new route returns 401/403/400 in correct ordering; production CJS bundle (1.5MB) builds, boots, runs migrations, contains the `/ai/analyze-baseline` route. Architect re-review: PASS, no release blockers.

### 2026-04-30 — Mobile bug-fix pass (TestFlight build #6)
Fixed three Whitney-reported bugs:
1. **Binaural beats now play on iOS.** `useNeuralAudio.ts` rewritten with native `expo-av` path (was Web AudioContext only). Added 9 looping WAV assets (22050 Hz, 10s) generated by `scripts/generate-binaural-audio.mjs` into `artifacts/neuro-quest-mobile/assets/audio/`. Audio mode set with `playsInSilentModeIOS:true`. Load-token guard prevents stale-sound races on rapid preset switching.
2. **Lucky wheel refills daily.** `play.tsx` now grants `DAILY_FREE_SPINS = 5` every 24 h via `LAST_SPIN_REFILL_KEY` in AsyncStorage; `max(currentSpins, 5)` so a paid balance is never reduced.
3. **Home back-button on Profile and Zen Pro shop.** Both root tabs now have a gold pill `Pressable` (chevron-back + "Home") wired to `router.replace("/")`.

### Known follow-up (DO NOT SHIP IAP CONSUMABLES YET)
The mobile app authenticates to the API server with HMAC device-key auth (`signedFetch` in `lib/userAuth.ts`), but the IAP routes in `artifacts/api-server/src/routes/iap.ts` (`/iap/validate`, `/iap/restore`, `/iap/entitlements`) require Clerk session auth via `requireUserId`. There is no `@clerk/clerk-expo` SDK in the mobile app. As a result, any call to `purchaseProduct(...)` from mobile would charge the user via StoreKit but fail server validation with 401, never call `finishTransaction`, and never credit `user_spin_balance` — an Apple Review fail-prone state.

To prevent this, `play.tsx` `handleBuySpinPack` now displays a "Free Daily Spins" / "spin packs available in an upcoming update" alert instead of calling `purchaseProduct`. The daily refill mechanism (#2 above) covers Whitney's actual reported gameplay complaint.

`shop.tsx` subscription / daypass / spin-pack purchase paths still call `purchaseProduct` (this was the pre-existing state at HEAD before this session — not a new regression). Before re-enabling IAP for charged purchases, the auth bridge must be built first. Two reasonable options:
- Add `@clerk/clerk-expo` to the mobile app and pass `getToken()` into `purchaseProduct(productId, token)` and `restorePurchases(token)`.
- Or add a parallel auth path on the IAP routes that accepts the device-signed HMAC headers (`X-Device-Id`, `X-Issued-At`, `X-Timestamp`, `X-Signature`) and resolves to an `app_users.id`.

After auth is wired, also follow the architect's recommendations: post-purchase server-truth balance fetch (call `fetchEntitlements()` after `purchaseProduct`, set local `SPINS_KEY` to `spin_balance`), reconcile entitlements on app foreground/start, and replace any silent `catch {}` around credit writes with explicit error surfacing.