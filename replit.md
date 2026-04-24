# NeuroQuest — Workspace

## Overview

NeuroQuest is a brain-training and wellness application built as a pnpm monorepo using TypeScript. Its core purpose is to apply neuroplasticity science through daily cognitive exercises, interactive games, and social features to promote mental well-being. It features a dual-currency reward system (Neural Energy and Compassion Points) that triggers micro-donations to the World Hunger Relief Fund upon achieving compassion milestones. The project integrates monetization tiers, enterprise solutions, and sponsored impact partnerships, aiming to be a compliant Health & Fitness / Lifestyle wellness app focused on engagement and ethical monetization.

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

**TypeScript & Composite Projects:**
The monorepo leverages TypeScript composite projects with project references for type-checking and build order.

**UI/UX and Design ("Luxury Celestial Zen"):**
- **Design Language:** PlayfairDisplay (headings), Inter (body) with gold, forest green, celestial purple, and nebula accents, cosmic gradient backgrounds, and celestial animations.
- **Neural Audio Engine:** Web Audio API-generated binaural beats and neural noise.
- **Key Metrics:** Empathy Index, Heart-Brain Hybrid Score (HBHS), and Lives Impacted (real-world impact metrics).
- **Dashboard Layout:** Structured order of information including streaks, notifications, global impact, game cards, daily tasks, and leaderboards.
- **UI Philosophy:** "Intentional, clean, and focused" with purpose-driven elements and controlled animations.
- **Behavioral Design Patterns:** Dopamine triggers (CelebrationOverlay), Compassion Loops (linking actions to real-world impact), and No-Shame Loops (graceful handling of streak breaks).

**Feature Specifications:**
- **Monetization (3-Tier):** Zen Pro subscription, Daily Pass, Enterprise Corporate Wellness, Sponsored Jackpots, with a portion of revenue dedicated to charity.
- **Compassion Impact Tracking:** Local tracking of compassion milestones, contributing to real-world donations across 6 causes.
- **Brain Games (9 total):** A suite of cognitive exercises persisting Neural Energy to AsyncStorage.
- **Real-World Impact Counter:** Live display of donation-derived impact.
- **Weekly Progress Tracking:** Display of Neural Energy, games won, and streak count.
- **Enterprise Features:** Team Building Exercises, Team Dashboard, ROI Analytics, SSO/SCIM, Burnout Detection, CSR Impact Reports, and privacy-first design.
- **Daily Mindful Tasks:** Reflection-based tasks with server-side enforcement.
- **Monetization Engine (Mobile Play Screen):** Neural Energy (NE) as universal currency for games, with extra spin purchase packs and an Apple-compliant "Restore Purchases" button.
- **Game Mechanics:** Compassion Wheel, Lucky Wheel, Neural Hold, and Diamond Reward, all designed to avoid gambling terminology for App Store compliance.
- **Navigation:** 6-tab navigation (Home, Train, Play, Resilience, Zen Pro, Profile).
- **Onboarding:** Multi-step premium onboarding flow for mobile and a splash screen for web.
- **Streak System:** Tracks `streak_count` and `last_game_date` with visual cues.
- **Push Notifications:** Web Push API for smart, admin-triggered pushes.
- **Raid Mode:** Admin-toggled global event doubling compassion points.
- **Auth & Paywall:** Clerk authentication (SSO-ready, Organization support) with `AuthGate` and `PaywallGate`.
- **Legal:** In-app legal screen (Mobile) and dedicated web pages for policies and disclosures.
- **Accessibility (Mobile):** Extensive use of accessibility roles, labels, states, and `accessibilityLiveRegion`.
- **Anti-Exploit:** Premium spin lock with fail-safe timeout and robust state preservation.
- **Apple Compliance (Icons):** All gambling-associated icons removed; Play tab uses generic game controller icons.
- **Not Found Screen:** Custom celestial-themed 404 page.

**Enterprise Stack (Zen Pro Enterprise):**
- **Database:** 6 PostgreSQL tables with indexes for enterprise data.
- **Scoring Engine:** Deterministic WRI/ERI/CPS/NSB/burnout risk scoring in `api-server`.
- **Enterprise API:** 11 endpoints at `/api/enterprise/*` with Zod validation, API key auth, and audit logging.
- **Burnout Engine v2.0.0:** `analyzeBurnoutV2()` for deterministic burnout detection with personal baselines, anomaly detection, HRV integration, explainability, and predictive projections.
- **Outcome Metrics:** `calculateOutcomes()` for 30-day burnout change, WRI change, and projected retention impact.
- **Company Dashboard Endpoint:** `/api/enterprise/company/:companyId/dashboard` provides executive and manager views of company metrics.
- **Mobile Resilience Tab:** Displays WRI score, burnout risk, component score bars, and Reset Protocol.
- **Admin Dashboard (Web):** `/admin-dashboard` provides executive/manager views, analytics, and billing information.
- **Stripe B2B Billing (Hardened):** 10 endpoints for creating companies, managing subscriptions, billing inquiries, and handling webhooks.
- **Enterprise Webhooks (Production-Hardened):** Strict signature verification, idempotency, async processing, out-of-order safety, database transactions, and dead-letter queue with exponential backoff.
- **Dunning & Payment Failure:** Configurable grace period and 3-strike suspension policy.
- **Billing Reconciliation:** Hourly cron job to compare database against live Stripe API for detecting and auto-fixing discrepancies.
- **Seat Enforcement:** Blocks user creation when subscription is inactive, account suspended, or seat limit reached.
- **Stripe Tax:** `automatic_tax` enabled with SaaS tax codes.
- **RBAC:** Billing-sensitive operations are restricted to `admin` role users.
- **Audit Log Export:** Supports filtering, pagination, and CSV export for SOC 2 compliance.
- **ASC 606 Revenue Recognition v2:** Full five-step compliant model for per-seat SaaS subscriptions, using `revenue_schedules` table for tracking and daily recognition cron.
- **Admin Dashboard Revenue Panel:** Displays ASC 606 revenue recognition details, contract value, recognized/deferred amounts, and a revenue journal.
- **Database Tables (Billing):** Additional tables for idempotency, DLQ, webhook metrics, billing reconciliation, revenue schedules, and revenue journal.
- **Age Gate:** Consumer age verification bypassed for enterprise paths.
- **Privacy:** Employee-level data never exposed to employers; only anonymized team averages are shown.
- **Wearable Integration (Clinical-Grade v2):** `WearableIntegration` service ingesting HRV, SleepDuration (minutes), Steps from Apple Health/Google Fit/Fitbit/Garmin/Whoop/Oura. Computes proprietary NeuroResilienceScore (0-100) with: **HRV 50%** (ln(RMSSD) normalized — ANS Fight-or-Flight vs Rest-and-Digest), **Sleep 35%** (recovery floor with penalty — insufficient sleep caps score regardless of HRV), **Activity 15%** (strain modifier — high activity + low HRV = burnout_risk penalty of -12; high activity + high recovery = growth bonus of +5). Uses **7-day Exponential Moving Average** (α=0.25) to prevent one bad night from tanking scores. Strain-recovery states: growth/functional_overreach/burnout_risk/recovery/neutral. Endpoints: `POST /enterprise/wearable`, `GET /enterprise/wearable/:userId`, `GET /enterprise/wearable/:userId/trend`, `POST /enterprise/wearable/score`. DB table: `wearable_data`.
- **SSO/SCIM (Production):** Full OIDC Authorization Code flow: `/enterprise/sso/.well-known/openid-configuration` (public discovery), `/enterprise/sso/authorize` (builds IdP redirect URL with state+nonce, creates `sso_sessions`), `/enterprise/sso/callback` (exchanges code with IdP, fetches userinfo, auto-provisions user if enabled, issues NeuroQuest auth code), `/enterprise/sso/token` (exchanges NeuroQuest auth code for access_token + id_token with org_id/role claims), `/enterprise/sso/userinfo`. SSO configuration at `/enterprise/sso/configure` (supports Okta, Azure AD, Google Workspace, OneLogin, Custom OIDC). Caches discovered IdP endpoints (token, userinfo, jwks_uri). Full SCIM v2 provisioning: `GET/POST/PUT/PATCH/DELETE /enterprise/scim/v2/Users`, `ServiceProviderConfig`, `ResourceTypes`, `Schemas`. Domain restriction, auto-provisioning, and default role assignment. **SCIM→Revenue Bridge:** When HR deactivates a user via SCIM PATCH (active=false) or DELETE, the system automatically: (1) removes the user, (2) recalculates the company's active seat count, (3) triggers `handleSeatChangeProspective()` to adjust the ASC 606 revenue schedule. DB tables: `sso_configurations`, `sso_sessions`. Enterprise users table has `external_id`, `idp_subject`, `last_login` columns for IdP integration.
- **Tenant Branding:** Company-specific dashboard customization via `GET/PUT /enterprise/tenant/:companyId/branding` (logo_url, primary_color, secondary_color, accent_color, custom_domain, welcome_message). `GET /enterprise/tenant/:companyId/theme` returns CSS variables (`--nq-primary`, `--nq-secondary`, `--nq-accent`) for frontend injection. Default palette: #6C63FF/#2D2B55/#00D9FF. Stored on `companies` table.
- **Team Heatmap:** `GET /enterprise/team-heatmap/:companyId` — aggregates NeuroResilienceScores by department, fully anonymized. Per-department: avg/min/max score, risk level (critical/high/moderate/good/excellent), heatmap color, score distribution, biometric averages (HRV, sleep, steps), 14-day trend. Company-wide summary with at-risk/critical counts. Automatic burnout alerts with actionable recommendations for critical/high-risk departments. Department assignment via `PUT /enterprise/users/:userId/department`. DB: `department` column on `enterprise_users`.
- **Auth Gate (isLoaded):** `AuthGate` component uses Clerk's `useAuth()` with `isLoaded` + `isSignedIn` states. Shows branded loading spinner during Clerk initialization, branded sign-in UI when not authenticated — prevents premature redirect loops to `/sign-in`.
- **Wearable Engagement Widget (Company Admin Dashboard):** `GET /api/company-admin/wearable-engagement` (in `routes/company-admin.ts`, behind `requireCompanyAdmin`) renders in the Wellness tab at `/company-admin`. **Tiered k-anonymity privacy model (5+ employees):** TIER 1 — always-safe headcount only (`total_employees`, `connected_30d`, `connection_rate`, threshold message). TIER 2 — 30-day cohort ≥ 5 unlocks behavioral metrics: `synced_24h`, `active_7d`, `last_sync_bucket` (coarsened to "within last 6 hours / 24 hours / 7 days / >7 days" — never minute-precision), `total_syncs_30d`, source breakdown. TIER 3 — also requires 7-day active cohort ≥ 5 to expose personal-health aggregates (`avg_resilience_score`, `avg_hrv`, `avg_sleep_minutes`, `avg_steps`) and `trend_7d` (per-day k-anon: days with <5 active users emit `avg_score: null`). UI handles all states: loading, explicit error with retry, zero, partial, full. Includes 7-day resilience sparkline rendered with Framer Motion bars. Never shows individual employee data. Smoke-tested across all 4 states.
- **Mobile Apple Health (HealthKit) Integration:** Expo mobile app uses `@kingstinct/react-native-healthkit` (config plugin in `app.json` with `NSHealthShareUsageDescription`). Reads HRV (SDNN), Sleep Analysis (de-overlapped intervals across asleepUnspecified/Core/Deep/REM enums = 1/3/4/5), and Step Count for the trailing 24h. Wrapper in `lib/health.ts` is defensive: tolerates both v14 object signature `requestAuthorization({toShare,toRead})` and the legacy positional shape, and both `{filter:{date:{startDate,endDate}}}` and `{from,to}` query options. UI in `app/wearable.tsx` (linked from Profile tab). **Identity model (no Clerk on mobile):** user enters work email + company `invite_code`, both stored in AsyncStorage. The pair must match a row in `enterprise_users JOIN companies` on the server — the invite code acts as a shared secret that prevents email-only impersonation. Endpoint: `POST /api/wearable/sync` (mounted in `enterprise.ts`) — also enforces `pilot_status='active' AND pilot_ends_at>NOW()` OR `subscription_status IN (trialing|active)`, and rejects suspended companies. Reuses the existing `ingestWearableData()` pipeline, so resilience scoring is identical to web/manual entry. **Requires EAS native rebuild** (HealthKit, like expo-iap, cannot run in Expo Go).

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