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