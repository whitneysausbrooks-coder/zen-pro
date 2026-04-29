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