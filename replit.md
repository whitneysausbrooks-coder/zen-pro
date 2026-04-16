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
- **Stripe B2B Billing:** `artifacts/api-server/src/routes/stripe-enterprise.ts` — 5 endpoints: POST create-company (Stripe customer), POST subscribe (per-seat checkout at $12/seat/mo), POST update-seats (quantity adjustment), GET billing/:companyId (subscription status), POST portal (Stripe billing portal). All auth-protected with `x-enterprise-key`.
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