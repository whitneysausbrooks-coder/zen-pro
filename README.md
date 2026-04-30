# NeuroQuest Zen Pro — Enterprise Pilot Program

**Version:** 1.0.0 (iOS Build 7+)
**Bundle ID:** `pro.neuroquestzen.app`
**App Store Connect ID:** 6763640852
**Apple Team:** XGP7472WPJ
**Founder & Product Owner:** Whitney Ausbrooks
**Document Purpose:** Enterprise pilot template — overview, scope, security posture, success metrics, and onboarding for prospective workforce-resilience pilots.

---

## 1. Executive Summary

NeuroQuest Zen Pro is a clinically-grounded workforce resilience and neuro-wellness platform delivered as a native iOS app, an Android app, and a web companion, all backed by a single hardened Express API and Postgres data layer.

The platform measures, trends, and improves employee neuro-resilience through a proprietary **Triple-Weight Algorithm** (HRV 50% / Sleep 35% / Activity 15%) computed from passively-collected wearable signals. Members earn measurable improvements through short daily neuro-plasticity training, gratitude practice, and cause-linked compassion challenges that convert engagement into verified charitable impact.

Enterprise pilots run for **6 to 12 weeks** and produce a board-ready Workforce Resilience report covering aggregate (de-identified) trend data, category-level burnout indicators, and recommended intervention pathways.

---

## 2. The Problem

- 76% of US employees report at least one symptom of burnout (Gallup, 2024).
- Traditional EAP utilization sits below 7%, and most employer wellness apps see < 15% sustained engagement at 60 days.
- HR leaders lack a defensible, privacy-safe way to measure whether their wellness investment is actually moving the needle on resilience, retention, or healthcare cost.

## 3. The Solution

NeuroQuest Zen Pro combines three proven mechanisms into a single product:

1. **Continuous, passive measurement** — HRV, sleep, and activity sourced from Apple Watch (HealthKit), Wear OS / Galaxy / Pixel Watch (Health Connect), with Fitbit and Garmin on the roadmap.
2. **Daily neuro-plasticity training** — Stroop, N-Back, Compassion Wheel, and other validated 60-second exercises that have demonstrated measurable HRV and attentional improvement in published literature.
3. **Compassion-linked engagement** — Each completed session contributes to a verified charitable cause, converting wellness behavior into employer-branded social impact.

The result is an app employees actually open daily and an aggregate dashboard the CHRO can defend to the board.

---

## 4. Pilot Scope

| Item | Default Pilot Terms |
|---|---|
| **Pilot duration** | 8 weeks (6-week minimum, 12-week maximum) |
| **Cohort size** | 50 to 500 employees |
| **Onboarding window** | 14 days from kickoff |
| **Required participation rate for valid readout** | 60% of cohort active at week 4 |
| **Reporting cadence** | Weekly snapshot, mid-pilot review (week 4), final readout (week 8) |
| **Data residency** | US (PostgreSQL on Replit deployments, US region) |
| **Pilot pricing** | Custom — see Section 11 |

### In Scope
- iOS and Android app distribution to all enrolled employees
- Web companion for desktop check-ins
- Aggregate (de-identified) Workforce Resilience dashboard for HR sponsors
- Weekly anonymized cohort summaries
- Mid-pilot and final readout sessions with Whitney

### Out of Scope (unless contracted as add-on)
- Custom branding beyond pilot landing screen
- Direct integration with HRIS / SSO providers (SCIM scaffold available; full integration is an add-on)
- Individual-level data export to the employer (privacy-protected — never available)
- On-premise or single-tenant deployment

---

## 5. Success Metrics

The pilot is evaluated against four pre-registered metrics. Targets are negotiable per cohort baseline.

| Metric | Default Target | Measurement Source |
|---|---|---|
| **Activation rate** | 70% of invited employees complete onboarding within 14 days | `app_users.onboarding_status` |
| **30-day retention** | 50% of activated users active in week 4 | `app_user_auth_events` |
| **Mean neuro-resilience improvement** | +8 points on 0–100 composite by week 8 | `app_user_biometrics.neuro_resilience_score` (7-day EMA) |
| **Self-reported burnout reduction** | -1.0 on 5-point scale | In-app survey (Maslach short-form) |

A pilot is considered successful for renewal discussion when at least three of four targets are met.

---

## 6. Architecture Overview

NeuroQuest Zen Pro is a multi-artifact monorepo deployed on Replit:

| Artifact | Stack | Purpose |
|---|---|---|
| `artifacts/neuro-quest-mobile` | Expo SDK 54, React Native, TypeScript | iOS / Android client |
| `artifacts/neuro-quest` | React + Vite | Web companion + marketing site |
| `artifacts/api-server` | Node.js, Express, TypeScript, esbuild CJS bundle | All server logic; mounts at `/api/*` |
| `artifacts/mockup-sandbox` | Vite | Internal component preview (not employee-facing) |
| `lib/db` | Drizzle ORM + raw SQL migrations | Postgres schema |

### Server-side capabilities
- Idempotent migration runner (`runMigrations()`) executes before the listener binds
- Apple JWS notification verification (Apple Root CA G3 inlined, production-then-sandbox fallback)
- Per-device HMAC auth bridge for mobile clients without a Clerk session
- Stripe + In-App Purchase reconciliation with billing dead-letter queue
- Audit log on every privileged mutation (`audit_logs` + `app_user_auth_events`)
- Datadog observability (service `neuroquest-api`)
- Daily revenue-recognition scheduler

### Wearable provider matrix

| Provider | Status |
|---|---|
| Apple HealthKit (iOS) | Live |
| Android Health Connect | Live |
| Manual entry | Live |
| Fitbit | Typed interface stub; SDK integration on roadmap |
| Garmin | Typed interface stub; SDK integration on roadmap |

---

## 7. Security & Privacy Posture

NeuroQuest is built to clear enterprise procurement reviews on first pass.

### Authentication
- **Web:** Clerk-managed sessions with PKCE / OIDC
- **Mobile:** Per-device HMAC handshake (`X-Device-Id`, `X-Issued-At`, `X-Timestamp`, `X-Signature`) bound to a server-held `SERVER_DEVICE_KEY`. Tampered, swapped, or unsigned requests are rejected with 401 and audit-logged.
- **Enterprise SSO:** SCIM 2.0 + SAML scaffold present (`routes/sso-scim.ts`); production wiring is a pilot add-on.

### Data minimization
- Health data is never collected before explicit user consent. Consent state is recorded in `app_users.health_consent_status`.
- Raw biometrics never leave the user's region. AI inference, when enabled, receives only derived, anonymized summaries (see `lib/tripleWeightAi.ts`).
- Personally identifying information is never sent to third-party LLMs. The user identifier is salted-hashed with `SERVER_DEVICE_KEY` before any external API call.

### Audit & compliance
- Every privileged mutation writes to `audit_logs` with actor, target, and full payload
- Terms of Service and Privacy Policy acceptance are versioned per user (`app_user_tos_acceptances`)
- Apple webhook payloads are cryptographically verified against Apple Root CA G3 before any entitlement state is touched
- Wearable sync errors surface to an admin dashboard via `wearable_sync_errors`

### Infrastructure
- Postgres hosted in US region, daily snapshots, point-in-time recovery
- TLS 1.2+ end-to-end, mTLS between proxy and origin
- Replit Deployments handles HTTPS termination, health checks, and auto-scaling
- Secrets stored in Replit's encrypted secrets vault — never committed, never logged

### Compliance posture (current → roadmap)
| Standard | Status |
|---|---|
| GDPR data-subject rights (export, delete) | Available via `/api/app-user/:id/export` and `/delete` |
| CCPA | Available |
| HIPAA Business Associate Agreement | Roadmap, target Q4 2026 (BAA template under counsel review) |
| SOC 2 Type I | In progress, target Q3 2026 |
| SOC 2 Type II | Roadmap, target Q1 2027 |

---

## 8. Onboarding Workflow (Pilot Sponsor)

1. **Kickoff call** with Whitney to define cohort, success metrics, and reporting cadence.
2. **Pilot Master Service Agreement** countersigned (template provided).
3. **Cohort upload** — sponsor provides a CSV of employee emails (or hands off to the SCIM endpoint if SSO integration is contracted).
4. **Welcome email** sent from sponsor's domain with a one-tap install link to TestFlight (iOS) and Internal App Sharing (Android) during pilot. Once pilot graduates, members move to the public App Store / Play Store listing.
5. **Day 0 to Day 14** — onboarding window. Daily activation report emailed to the sponsor.
6. **Week 4** — mid-pilot review. Cohort dashboard walkthrough.
7. **Week 8** — final readout. Board-ready report delivered as PDF + interactive dashboard link.

---

## 9. End-User Experience

A pilot member's first session takes under three minutes:
1. Install from TestFlight / Internal Sharing
2. Choose Individual or Enterprise sign-in (enterprise members enter the cohort code from their welcome email)
3. Grant Apple Health / Health Connect permission (optional — manual entry path always available)
4. Accept Terms and Privacy
5. Land on the Home tab and complete the first 60-second compassion challenge

From day two onward, the member sees a **Workforce Resilience** tab with their personal trend, a **Train** tab with the daily neuro-plasticity exercise, a **Play** tab with the compassion wheel, and a **Profile** tab with their Zen Rank, streak, and total verified impact.

---

## 10. Reporting & Deliverables

Sponsors receive:

| Deliverable | Cadence | Format |
|---|---|---|
| Activation report | Daily during onboarding window | Email + dashboard |
| Cohort engagement snapshot | Weekly | Email + dashboard |
| Mid-pilot review (week 4) | Once | 60-min video call + slide deck |
| Final Workforce Resilience Report | Once at pilot close | PDF + interactive dashboard link |
| Aggregate de-identified data export | On request | CSV / JSON |

All sponsor-facing data is aggregated to the cohort level. **No individual-level data is ever shared with the employer**, by design and by contract.

---

## 11. Commercial Terms (Pilot)

| Tier | Cohort Size | Pilot Investment |
|---|---|---|
| **Foundation** | up to 100 employees | Available — contact founder |
| **Growth** | 100 to 500 employees | Available — contact founder |
| **Enterprise** | 500+ employees | Custom — includes SSO/SCIM, BAA, dedicated support |

Pilot fees are credited 100% toward the first year of an annual subscription if the pilot graduates to a contract within 30 days of final readout.

---

## 12. Roadmap (Q3 / Q4 2026)

- Fitbit and Garmin SDK integration (typed contracts already in place)
- AI-driven personalized intervention engine (consent-gated, runs only post 7-day baseline)
- HRIS integration (Workday, BambooHR, Rippling)
- Manager dashboard for team-level (not individual) trends
- SOC 2 Type I certification

---

## 13. Repository Layout (for technical evaluators)

```
.
├── artifacts/
│   ├── api-server/           # Express + Postgres, mounts /api/*
│   ├── neuro-quest/          # Web companion (Vite + React)
│   ├── neuro-quest-mobile/   # Expo iOS/Android client
│   └── mockup-sandbox/       # Internal component preview
├── lib/
│   └── db/                   # Drizzle schema (auth + neuro_quest)
├── replit.md                 # Living technical journal
└── README.md                 # This document
```

For detailed architecture, build history, and IAP / webhook security implementation, see `replit.md`.

---

## 14. Contact

**Whitney Ausbrooks** — Founder & Product Owner
For pilot inquiries, MSA templates, or technical due-diligence packets, contact the founder directly.

---

*This document is a living template. The current version of record is the one in the `main` branch of the NeuroQuest Zen Pro repository. Last updated: April 30, 2026.*
