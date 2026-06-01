# NeuroQuest — Architecture Reference Guide

**Purpose:** A reference for a code-integrity / backend review. It explains how the
system is built, how data is kept correct and secure, and what has been verified.
**Last updated:** June 1, 2026.

---

## 1. System at a glance

NeuroQuest is a wellness / burnout-resilience product delivered as three coordinated
applications sharing one backend and one database.

| Layer | Technology | Notes |
|---|---|---|
| Mobile app | Expo SDK 54, React Native, expo-router | Primary App Store product (individual paying users) |
| Web app | React + Vite | Marketing + web experience |
| API server | Express 5.2 + TypeScript (run via `tsx`) | Single backend for all clients |
| Database | PostgreSQL (`pg` 8.20) + Drizzle ORM | One Postgres instance |
| Enterprise auth | Clerk (`@clerk/express` 2.1) | B2B / pilot organizations |
| Mobile auth | Per-device HMAC request signing | Individual app users (no Clerk) |
| Payments (B2B) | Stripe 20.4 | Enterprise contracts |
| Payments (mobile) | Apple In-App Purchase (`expo-iap`) | Individual users, iOS |
| Rate limiting | `express-rate-limit` 8.4 | Global + auth-specific limiters |
| Security headers | `helmet` | Applied to all responses |
| Error monitoring | Datadog | `DATADOG_API_KEY` |

The codebase is a **pnpm monorepo**. Shared types and the database schema live in a
common workspace package (`@workspace/...`) consumed by every app, so the API and the
clients cannot drift apart on data shapes.

---

## 2. Repository layout

```
artifacts/
  api-server/          Express 5 backend (the system of record)
  neuro-quest/         React + Vite web app
  neuro-quest-mobile/  Expo / React Native mobile app
lib/
  db/                  Shared Drizzle schema + types
docs/                  This document
```

---

## 3. Backend architecture

### 3.1 Request pipeline (`api-server/src/app.ts`)
Middleware is ordered deliberately for correctness and security:

1. **Error-monitoring request handler** (Datadog) wraps every request.
2. **Raw-body webhook routes mounted first** — Stripe, Stripe Enterprise, and
   every.org webhooks parse the *raw* body (`express.raw`) **before** the JSON
   parser runs. This is required so cryptographic signatures are verified against
   the exact bytes received, not a re-serialized object.
3. **Security middleware** — `helmet` headers + `express-rate-limit` limiters.
4. **Clerk proxy + Clerk middleware** for enterprise identity.
5. **CORS** (credentialed) and **JSON / urlencoded parsers** with size limits.
6. **`/api` router** — all application routes.
7. **Error-monitoring error handler** (terminal).
8. **Static serving** of the built web app in production, with an explicit
   regex guard so `/api/*` is never swallowed by the SPA fallback.

### 3.2 Route modules (`api-server/src/routes/`)
Each domain is an isolated Express router, composed in `routes/index.ts`:

`health`, `auth`, `quest`, `stripe`, `iap`, `sso-scim`, `enterprise`,
`app-user`, `ai`, `cbi`, `company-admin`, `stripe-enterprise`, `donations`,
`sponsor`, `admin`, `notifications`.

### 3.3 Core libraries (`api-server/src/lib/`)
- `db.ts` — Postgres connection pool plus three primitives every route uses:
  `query()`, `withTransaction()` (transaction wrapper), and `auditLog()`.
- `migrate.ts` — idempotent schema migrations (`CREATE TABLE IF NOT EXISTS …`)
  run **before the HTTP listener binds**, so the server never accepts traffic
  against an un-migrated schema.
- `deviceAuth.ts` — per-device HMAC signing and verification (see §6).
- `scoringEngine.ts` / `tripleWeightAi.ts` — resilience score computation.
- `wearableIntegration.ts` — biometric ingestion.
- `appleNotificationVerifier.ts` (+ bundled `apple-roots/` CA) — Apple receipt
  and server-notification verification.
- `everyOrg.ts` — Compassion Reels donation settlement + webhook handling.
- `seatEnforcement.ts`, `billingReconciliation.ts`, `revenueRecognition.ts` —
  enterprise billing integrity.
- `errorMonitoring.ts`, `enterpriseWebhook.ts`, `clerkUser.ts`.

---

## 4. Data model

Schema is managed two ways and both are versioned in the repo: shared **Drizzle**
table definitions (`lib/db/src/schema/`) and **idempotent raw-SQL migrations**
(`api-server/src/lib/migrate.ts`). Tables grouped by domain:

**Individual app users (mobile / App Store):**
- `app_users` — account record (client-owned UUID identity).
- `app_user_biometrics` — biometric readings + computed `neuro_resilience_score`,
  `ema_7day`, trend (the resilience data source).
- `app_user_ai_personalization` — per-user AI learning state.
- `app_user_auth_events`, `app_user_tos_acceptances` — auth + consent audit trail.
- `cbi_responses` — Copenhagen Burnout Inventory responses.
- `iap_entitlements` — validated Apple purchase entitlements.

**Enterprise / B2B:**
- `enterprise_users`, `resilience_scores` (richer enterprise score shape:
  `eri, cps, nsb, cohesion, wri, burnout_risk`), plus enterprise lead tables.

**Compassion Reels donations:**
- `compassion_budget` — per-month hard giving budget + accrued total.
- `compassion_donations` — donation ledger (accrued → settling → settled).

**Platform / shared:**
- `user_profiles`, `global_settings`, `activities`, `task_completions`,
  `push_subscriptions`, `ai_outcome_feedback`, `wearable_sync_errors`,
  `enterprise_leads`, `sponsor_leads`.

---

## 5. Identity & authentication — two independent tracks

A frequent point of confusion, so stated plainly: there are **two** identity
systems that do **not** share a credential or a score shape.

| | Individual (mobile) | Enterprise (B2B) |
|---|---|---|
| Identity | Client-generated UUID in device secure storage | Clerk user |
| Credential | Per-device HMAC secret | Clerk session |
| Registration | `POST /api/app-user/register` | Clerk + invite code |
| Resilience score | single `neuro_resilience_score` (+ EMA-7, trend) | rich multi-metric (`eri/cps/nsb/cohesion/wri/burnout_risk`) |
| Served by | `GET /api/app-user/:id/baseline` | `GET /api/enterprise/scores/:userId` (needs `x-enterprise-key`) |

---

## 6. Code integrity & security controls

This is the heart of a backend-integrity review. Each control below is implemented
in code today.

1. **Per-device HMAC request signing** (`deviceAuth.ts`). On registration the
   server mints `device_secret = HMAC_SHA256(SERVER_DEVICE_KEY, user_id : device_id
   : issued_at)`. Subsequent mobile requests are signed with that secret and
   verified server-side. Signature comparison uses **constant-time**
   `crypto.timingSafeEqual` to prevent timing attacks. (Currently in a monitored
   "soft-mode" rollout — verdicts are logged while clients finish adopting.)

2. **Transactional correctness under concurrency.** Money- and capacity-sensitive
   operations run inside `withTransaction()` with **`SELECT … FOR UPDATE` row
   locks**, so concurrent requests cannot race. Two examples:
   - The Compassion Reels monthly giving cap (a row lock on the budget row).
   - Enterprise seat enforcement (cannot oversubscribe paid seats).

3. **Migrations before traffic.** The listener binds only after migrations
   complete — the server never serves requests on an inconsistent schema.

4. **Webhook authenticity (fail-closed).** Webhooks are parsed from the raw
   request body and verified:
   - **Stripe** — signature-verified.
   - **Apple** Server Notifications V2 — JWS verified against a bundled Apple Root CA.
   - **every.org** — shared-token checked; in production it **refuses** to process
     if no token is configured (fails closed rather than trusting an unsigned call).

5. **Rate limiting + hardened headers.** `express-rate-limit` applies a global API
   limiter and a stricter auth limiter; `helmet` sets security headers on every
   response.

6. **Admin endpoint protection.** Privileged endpoints (e.g. donation settlement)
   require the `ADMIN_MASTER_KEY` secret via an `x-admin-key` header.

7. **Input validation.** Request bodies are validated with **Zod** schemas
   (e.g. strict UUID regex on identity fields) before any DB access.

8. **Server-authoritative purchases.** Apple IAP receipts are validated
   server-side (`verifyAppleReceipt`, shared secret, automatic 21007 sandbox
   fallback); entitlements are written from the server, with duplicate-transaction
   detection. The client is never trusted as the source of truth for entitlements.

9. **Audit logging.** Sensitive operations write structured `auditLog` records.

10. **Secrets never in code.** All credentials are injected via the platform's
    environment/secret manager (see §11).

---

## 7. Resilience scoring pipeline (verified)

Flow for an individual user: biometrics in → score computed → stored → read by the
Resilience tab.

- Ingestion: `POST /api/app-user/biometrics` accepts HRV, sleep hours, and steps.
- Computation: `scoringEngine.ts` normalizes inputs and produces the
  `neuro_resilience_score`, blends a 7-day EMA, and derives a trend. The mobile
  Resilience tab presents the component contributions as HRV 50% / Sleep 35% /
  Activity 15%.
- Read path: `GET /api/app-user/:id/baseline` returns the latest score, EMA-7,
  trend, session count, and a coaching suggestion.

**Verification performed (live backend, June 1 2026):** a fresh user was
registered and two readings submitted — low metrics (HRV 42 / 6.0h / 4000 steps)
produced **55.6** (`recovery_needed`); higher metrics (HRV 68 / 8.0h / 11000 steps)
produced **81.2** (`optimal`), with EMA blending to 62 and trend `rising`. The
baseline endpoint returned the correct aggregate. Test data was removed afterward.

---

## 8. Compassion Reels — donation system (verified)

A **business-funded** giving mechanic. The user never pays; NeuroQuest donates from
a capped monthly budget.

- **Model:** accrue-then-settle. Each milestone accrues a real, committed
  micro-donation in the `compassion_donations` ledger, capped by a hard monthly
  budget in `compassion_budget`. Per-event card transfers of a few cents are
  economically impossible (fees dwarf the amount), so the aggregate is **settled**
  to the nonprofit in batches via every.org, whose webhook confirms disbursement.
- **Cap integrity:** enforced transactionally with a `SELECT … FOR UPDATE` lock so
  concurrent plays / bots can never overspend the budget.
- **Settlement:** an admin action atomically claims all `accrued` rows into a batch
  and computes the settlement total from exactly those rows.

**Verification performed (June 1 2026):** with only 5 milestones of headroom left,
**40 simultaneous** milestone requests were fired. Result: exactly **5 accrued, 35
capped**, and the accrued total landed **exactly on the budget** — never exceeding
it. The cap holds under concurrency. Test data was removed afterward.

---

## 9. Payments & monetization

- **Enterprise (Stripe):** B2B subscriptions, with billing-integrity helpers for
  reconciliation, revenue recognition, and seat enforcement.
- **Individual (Apple IAP):** server-validated receipts and entitlements; Apple
  Server Notifications V2 are JWS-verified. **`APPLE_IAP_SHARED_SECRET` must be set
  in production**, or receipt validation fails.

---

## 10. Observability

Datadog request/error handlers wrap the Express pipeline (`errorMonitoring.ts`),
providing centralized error capture and tracing in production.

---

## 11. Privacy & compliance

- **GDPR Article 17 (erasure):** erased accounts are tombstoned (email becomes
  `deleted_<random>@neuroquest.local`). Registration **refuses to re-bind a
  tombstoned account ID**, so historical biometrics can never be re-attached to a
  new identity.
- **Strict signature gate on regulated endpoints:** data export and erasure
  endpoints hard-reject (HTTP 401) any request whose device signature is not
  valid — they do **not** honor the global soft-mode rollout.
- **Consent trail:** ToS acceptances and auth events are recorded per user.

---

## 12. Deployment & environment

- Runs on Replit; the web build is served by the API server in production.
- Secrets are managed by the platform secret store (never committed). Key secrets:
  `SERVER_DEVICE_KEY`, `ADMIN_MASTER_KEY`, `APPLE_IAP_SHARED_SECRET`,
  `DATADOG_API_KEY`, plus enterprise keys. Compassion Reels settlement requires
  `EVERY_ORG_API_KEY` (+ optional `EVERY_ORG_WEBHOOK_TOKEN`); without it the
  feature **degrades safely** — milestones still accrue, but live settlement is
  skipped.

---

## 13. Verified vs. known gaps (honest status)

**Verified working:** resilience scoring pipeline (end-to-end, live); donation cap
under concurrency; both mobile and API TypeScript type-checks pass cleanly; webhook
raw-body mounting; correct secret wiring for every.org.

**Known gaps / roadmap (disclosed deliberately):**
1. **Milestone accrual endpoint hardening.** `POST /donations/compassion-milestone`
   is not yet authenticated per-user; the hard budget cap prevents financial
   overspend, but a script could consume the day's giving budget. Planned:
   per-device rate limiting and a server-validated game outcome.
2. **Settlement recovery path.** Rows move to `settling` before the external
   payment confirms; there is no automatic requeue/cancel if a settlement is
   abandoned. Planned: a `settling` timeout + admin retry/cancel.
3. **Webhook semantic validation.** The every.org webhook authenticates by shared
   token but does not yet assert payment status / amount / nonprofit match before
   marking `settled`. Planned: full payload consistency checks.
4. **Play-tab Apple-safety reframe (in progress).** Gambling-adjacent copy and the
   purchasable "spins" mechanic are being reframed ahead of App Store submission.
```