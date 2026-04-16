# NeuroQuest — Workspace

## Overview

NeuroQuest is a brain-training and wellness application built as a pnpm monorepo using TypeScript. Its core purpose is to apply neuroplasticity science through daily cognitive exercises, interactive games, and social features to promote mental well-being. Key functionalities include a dual-currency reward system (Neural Energy and Compassion Points), which triggers micro-donations to the World Hunger Relief Fund upon achieving compassion milestones. The project integrates monetization tiers, enterprise solutions, and sponsored impact partnerships, aiming to be a Health & Fitness / Lifestyle wellness app compliant with app store guidelines, focusing on engagement and ethical monetization strategies.

## User Preferences

I prefer iterative development, with a focus on delivering functional, well-tested components in stages.
I like clear, concise communication and prefer that you ask before making any major architectural changes or introducing new external dependencies.
Ensure all changes align with the project's brand identity, emphasizing mental wellness, engagement, and ethical monetization.
I expect comprehensive test coverage for new features and modifications.
Do not make changes to files related to internal Replit configurations without explicit instructions.

## System Architecture

The project is structured as a pnpm workspace monorepo using TypeScript 5.9, segregating deployable applications (`artifacts`) from shared libraries (`lib`).

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
The monorepo leverages TypeScript composite projects with project references for type-checking and build order, emitting `.d.ts` files while esbuild handles JavaScript bundling.

**UI/UX and Design ("Luxury Celestial Zen"):**
- **Design Language:** PlayfairDisplay (headings), Inter (body) with gold, forest green, celestial purple, and nebula accents.
- **Visuals:** Cosmic gradient backgrounds, animated twinkling stars, nebula glow circles, and cosmic radiance effects on every screen.
- **Neural Audio Engine:** Web Audio API-generated binaural beats (Alpha, Beta, Theta, Gamma), Solfeggio frequencies, and neural noise (Brown, Pink).
- **Key Metrics:**
    - **Empathy Index:** Client-computed score based on compassion, level, and neural energy.
    - **Heart-Brain Hybrid Score (HBHS):** Client-computed composite score combining brain score, heart score, and harmony bonus.
    - **Lives Impacted:** Real-world impact metrics (trees planted, meals funded, etc.) displayed on Home and Profile screens.
- **Share System:** Dedicated `/share` page with social platform buttons and message presets.
- **Dashboard Layout:** Structured order of information including streaks, notifications, global impact, game cards, daily tasks, and leaderboards.
- **UI Philosophy:** "Intentional, clean, and focused" with purpose-driven elements and controlled animations.
- **Behavioral Design Patterns:** Dopamine triggers (CelebrationOverlay with 18-particle burst, 8-emoji rain, ring pulse, center win badge, double haptic, 2.2s auto-dismiss — triggered on all 3 game win paths), Compassion Loops (linking actions to real-world impact), and No-Shame Loops (graceful handling of streak breaks). CelebrationOverlay has full animation lifecycle cleanup (all Animated values stopped, timers cleared, mountedRef guard) to prevent leaks on rapid unmount.

**Feature Specifications:**
- **Monetization (3-Tier):** Zen Pro subscription, Daily Pass, Enterprise Corporate Wellness, Sponsored Jackpots. 30% of subscription revenue dedicated to charity.
- **Compassion Impact Tracking:** Local tracking of compassion milestones, displayed across 6 causes, contributing to real-world donations.
- **Brain Games (9 total):** A suite of cognitive exercises including Stroop Test, Memory Grid, Neuro Match+, Focus Flow, Logic Lift, N-Back Challenge, and Emotion Storm, all persisting Neural Energy to AsyncStorage.
- **Real-World Impact Counter:** Live display of donation-derived impact (trees, meals, etc.).
- **Weekly Progress Tracking:** Display of Neural Energy, games won, and streak count.
- **Team Building Exercises (Corporate):** 6 science-backed exercises for enterprise users focusing on empathy, communication, and trust.
- **Enterprise Features:** Team Dashboard, ROI Analytics, SSO/SCIM, Burnout Detection, CSR Impact Reports, privacy-first design.
- **Daily Mindful Tasks:** Focus & Mind and Heart & Spirit tasks requiring reflection, with server-side enforcement.
- **Monetization Engine (Mobile Play Screen):** Neural Energy (NE) is the universal currency for games. Balance deducted atomically before animations. 30% of gameplay value tracked as charity impact. Extra Spin Purchase Packs: 3-tier system ($0.99/5 spins Starter, $1.99/15 spins Popular, $4.99/50 spins Best Value) shown on both Play and Shop screens with gold gradient price buttons.
- **Restore Purchases:** Shop screen includes an Apple-compliant "Restore Purchases" button below subscription/spin sections.
- **Game Mechanics:** Compassion Wheel (web-based, staggered stops), Lucky Wheel (mobile, weighted probability, free spins), Hold & Win / "Neural Hold" (mobile, 3-reel, weighted RNG, costs NE), Diamond Reward (mobile, 5-reel, weighted outcomes, costs NE). All user-facing text avoids gambling terminology (no "jackpot", "vegas", "bet", "casino") for Apple App Store compliance.
- **Navigation:** 6-tab navigation (Home, Train, Play, Resilience, Zen Pro, Profile) with native and classic tab implementations.
- **Onboarding:** 4-step premium onboarding flow (mobile) and a splash screen with focus test (web), persisting completion status.
- **Streak System:** Tracks `streak_count`, `last_game_date`, with a multiplier and visual cues.
- **Push Notifications:** Web Push API for smart, admin-triggered pushes.
- **Raid Mode:** Admin-toggled global event doubling compassion points.
- **Auth & Paywall:** Replit Auth integration with `AuthGate` and `PaywallGate` for subscription access.
- **Legal:** In-app legal screen (Mobile) and dedicated `/copyright`, `/privacy`, `/terms` pages (Web) covering policies, disclosures, and compliance. Legal pages bypass AgeGate for public accessibility (App Store reviewer access).
- **Accessibility (Mobile):** Extensive use of accessibility roles, labels, states, and `accessibilityLiveRegion="polite"` on all dynamic result announcements (win/lose toasts, game outcomes). All interactive buttons have `accessibilityRole="button"` with descriptive labels. Diamond Reward reels have individual reel labels for screen readers. Shop plan cards use `accessibilityState={{ selected }}`. Legal screen uses proper `tablist`/`tab` roles with selected state.
- **Anti-Exploit:** Premium spin lock with 15-second fail-safe timeout prevents stuck states on interrupted flows. Result toast is positioned as a fixed overlay above scroll content for reliable visibility across devices. Home screen spins rehydration uses `Number.isNaN` guard to preserve valid zero-spin state.
- **Apple Compliance (Icons):** All gambling-associated icons removed — Play tab uses `gamecontroller`/`game-controller` (SF Symbol + Ionicons), replacing `cards-club`/`suit.club`. No playing card imagery anywhere in the app.
- **Not Found Screen:** Custom celestial-themed 404 page with gradient background, Playfair Display typography, and gold CTA button matching the app's design language.

**Enterprise Stack (Zen Pro Enterprise):**
- **Database:** 6 PostgreSQL tables (companies, enterprise_users, biometrics, behaviors, resilience_scores, audit_logs) with indexes.
- **Scoring Engine:** Deterministic WRI/ERI/CPS/NSB/burnout risk scoring in `artifacts/api-server/src/lib/scoringEngine.ts`. All scores bounded 0-100, NaN-safe.
- **Enterprise API:** 11 endpoints at `/api/enterprise/*` with Zod validation, API key auth (`x-enterprise-key` header), audit logging. POST biometrics/behaviors/score/users/companies, GET scores/burnout-trend/company-metrics/company-dashboard/audit-log/reset-protocol.
- **Burnout Engine v2.0.0:** `analyzeBurnoutV2()` — world-class deterministic burnout detection. Features: personal baselines (14-day calibration via `user_baselines` table), 3-day trend (+15 risk), 2-sigma anomaly detection (+10), HRV integration (low HRV +10-20, sudden drop +15, baseline deviation +10), sleep quality signals, explainability (`reasons[]` with factor/contribution/detail), predictive 7/30-day projections (linear regression, no ML), engine versioning (`engine_version` column in `resilience_scores`). All calculations audited with latency tracking.
- **Outcome Metrics:** `calculateOutcomes()` — 30-day burnout change %, WRI change %, projected retention impact (industry benchmark: 10% burnout drop ≈ +4% retention).
- **Company Dashboard Endpoint:** `/api/enterprise/company/:companyId/dashboard?view=executive|manager` — Executive view: avg WRI, burnout risk, severity, 7-day trend (Recharts line chart), 7/30-day projections, top risk factors (explainability), outcome metrics, trend direction. Manager view: adds high-risk count (anonymized), team cohesion, cohesion delta %. Uses temporal 14-day series for projections.
- **New Endpoints:** GET `/enterprise/burnout-analysis/:userId` (full v2 analysis with reasons), GET `/enterprise/baseline/:userId` (personal baseline status).
- **Mobile Resilience Tab:** `artifacts/neuro-quest-mobile/app/(tabs)/resilience.tsx` — WRI score ring, burnout risk indicator, component score bars, Reset Protocol (4-3-5 box breathing, 2-min, +10 NE), personalized insights, privacy explainer.
- **Admin Dashboard (Web):** `artifacts/neuro-quest/src/pages/admin-dashboard.tsx` at `/admin-dashboard` — Executive/Manager view toggle, Recharts line chart (7-day trend), burnout severity badges, outcome metrics cards (burnout change, WRI change, retention impact), projections (7d/30d), top risk factors panel, billing status, cohesion delta, alert banners, audit log table, engine version display. API key authentication required.
- **Stripe B2B Billing (Hardened):** `artifacts/api-server/src/routes/stripe-enterprise.ts` — 10 endpoints: POST create-company (Stripe customer + address + idempotency key), POST subscribe (per-seat checkout at $12/seat/mo + Stripe Tax + SaaS tax code `txcd_10103001`), POST update-seats (quantity + proration_behavior + idempotency key), GET billing/:companyId (DB-first with Stripe fallback + dunning/grace info), GET invoices/:companyId (full invoice history + PDF links + tax breakdown), GET upcoming/:companyId (next charge preview), POST portal (Stripe billing portal), GET webhook-metrics (24h success rate, latency, DLQ status), POST retry-dlq (manual dead-letter retry). All auth-protected with `x-enterprise-key`. RBAC: subscribe/update-seats/portal require admin role via `x-enterprise-caller` header.
- **Enterprise Webhooks (Production-Hardened):** `artifacts/api-server/src/lib/enterpriseWebhook.ts` — Strict signature verification (rejects if no secret configured), full idempotency via `processed_stripe_events` table (duplicate events return 200 instantly), async processing (HTTP 200 returned within ms, business logic runs via `setImmediate`), out-of-order safe (fetches latest state from Stripe API on subscription events), database transactions (`withTransaction()`) for all state changes, dead-letter queue with exponential backoff (3 retries), webhook metrics tracking (success/failure/latency per event type). Handles 5 event types: checkout.session.completed, customer.subscription.updated/deleted, invoice.payment_succeeded/failed.
- **Dunning & Payment Failure:** Configurable grace period (7 days), 3-strike suspension policy, `dunning_attempts`/`dunning_last_at`/`suspended_at`/`grace_period_end` columns on companies. On payment failure: increment dunning counter + set grace period (first failure) → suspend after 3 failures. Payment success: reset all dunning state. Reconciliation checks expired grace periods.
- **Billing Reconciliation:** `artifacts/api-server/src/lib/billingReconciliation.ts` — Hourly cron job compares companies table against live Stripe API. Detects/auto-fixes: status mismatches, seat count drift, period end drift, subscription ID mismatches, phantom active subscriptions. All fixes wrapped in transactions. Also retries dead-letter queue items. Results logged to `billing_reconciliation_log` table + audit_logs.
- **Seat Enforcement:** `artifacts/api-server/src/lib/seatEnforcement.ts` — Blocks user creation when: no active subscription, account suspended, seat limit reached. Checks `seat_count`, `seat_cap`, `subscription_status`, `suspended_at`. GET `/enterprise/seats/:companyId` returns full billing health.
- **Stripe Tax:** `automatic_tax: { enabled: true }` on checkout sessions, SaaS tax code on product data, customer address collection on create-company, tax amounts on invoice history display.
- **RBAC:** Billing-sensitive operations (subscribe, update-seats, portal) check `x-enterprise-caller` header against enterprise_users role. Only `admin` role permitted; employees get 403 with clear error. All denials audit-logged.
- **Audit Log Export:** GET `/enterprise/audit-log` supports filtering (action, resource, since), pagination (limit/offset), total count, and CSV export (`?format=csv`). SOC 2 / financial audit ready.
- **Admin Dashboard (Web):** `artifacts/neuro-quest/src/pages/admin-dashboard.tsx` — Now includes: Billing & Seats panel (seat utilization, status, dunning counter, reconcile button), Webhook Health panel (24h events, success rate, avg latency, DLQ pending), Invoice History (with PDF download links, tax amounts, status badges), suspension/past-due alert banners.
- **ASC 606 Revenue Recognition v2:** `artifacts/api-server/src/lib/revenueRecognition.ts` — Full five-step ASC 606 compliant model for per-seat SaaS subscriptions ($12/seat/month). Uses `revenue_schedules` table for per-subscription period tracking (deferred → recognized ratably over billing period). Key functions: `handleNewSubscription` (creates schedule), `handleInvoicePaid` (creates schedule for new periods + billing journal), `handleSeatChangeProspective` (supersedes old schedule, creates new with adjusted daily rate anchored on original period), `handleCancellation` (stops recognition, releases deferred), `handleRefund` (adjusts deferred/recognized), `handleSuspension`/`handleReactivation` (pause/resume recognition). Daily recognition cron (`startDailyRecognitionScheduler`) runs hourly, recognizes once per day, handles catch-up for missed days and period-end rounding. All schedule changes create audit trail. Webhook-only seat change processing (no duplicate from update-seats endpoint). Invoice.payment_succeeded is sole billing journal source (no duplicate from checkout). Reactivation triggered on payment recovery from suspended/past_due state. Endpoints: GET `/enterprise/revenue/summary` (MTD/YTD/lifetime + per-company schedule breakdown), GET `/enterprise/revenue/waterfall` (monthly waterfall with recognized/billed/refunded/net), GET `/enterprise/revenue/journal` (filterable by company/type, CSV export), POST `/enterprise/revenue/run-recognition` (manual trigger).
- **Admin Dashboard Revenue Panel:** Revenue Recognition (ASC 606) section showing: contract value, recognized, deferred, % recognized with progress bar, MTD/YTD/lifetime recognized with entry counts, per-company schedule breakdown (seats, daily rate, status, period dates, recognized/deferred), revenue waterfall (monthly with billed/refunded/seats/released/net), revenue journal with color-coded entry types (recognition, billing, seat_change, cancellation, refund, deferred_release) and CSV export.
- **Database Tables (Billing):** `processed_stripe_events` (idempotency), `webhook_dead_letter` (DLQ with retry), `webhook_metrics` (observability), `billing_reconciliation_log` (drift tracking), `revenue_schedules` (per-subscription period tracking: company_id, subscription_id, period_start/end, seat_count, total_amount, recognized_to_date, deferred_balance, daily_rate, status, last_recognized_date, parent_schedule_id for modification chain), `revenue_journal` (journal entries with schedule_id link), `revenue_recognition` (point-in-time snapshots). Companies table extended: `dunning_attempts`, `dunning_last_at`, `suspended_at`, `grace_period_end`, `seat_cap`.
- **Age Gate:** Consumer age verification bypassed for enterprise paths (/admin-dashboard, /admin, /enterprise). Only shown on consumer app pages.
- **Privacy:** Employee-level data never exposed to employers. Only anonymized team averages shown. Full audit trail for SOC 2 compliance.

## External Dependencies

-   **PostgreSQL:** Database persistence.
-   **Drizzle ORM:** ORM for database interactions.
-   **Express:** API server framework.
-   **Zod:** Schema validation.
-   **Orval:** OpenAPI client code generation.
-   **React Query:** Frontend data fetching and caching.
-   **Stripe:** Payment gateway.
-   **Replit Auth:** User authentication.
-   **Web Push API (VAPID):** Push notifications.