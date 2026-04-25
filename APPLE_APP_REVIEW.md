# NeuroQuest — Apple App Review Submission Packet

> Paste these sections into the matching fields in App Store Connect. Update version/build numbers if you bump them before submitting.

---

## App Identity

| Field | Value |
|---|---|
| App Name (App Store) | **NQ Zen Pro** |
| Subtitle (suggested) | Brain Training & Resilience |
| Bundle ID | `pro.neuroquestzen.app` |
| SKU | `nq-zen-pro-ios` |
| Primary Category | **Health & Fitness** |
| Secondary Category (suggested) | Lifestyle |
| Version | 1.0.0 |
| Build | 1 |
| Copyright | © 2026 NeuroQuest LLC |
| Owner / Team | whitneyausbrooks |
| Marketing URL | https://neuroquestzen.pro |
| Support URL | https://neuroquestzen.pro/support |
| Privacy Policy URL | https://neuroquestzen.pro/privacy |
| Terms of Use (EULA) | https://neuroquestzen.pro/terms |
| Age Rating | 4+ (no objectionable content; no gambling, no UGC) |
| Export Compliance | Uses only standard HTTPS — `ITSAppUsesNonExemptEncryption = false` (already set in `app.json`) |

---

## Sign-In Credentials for the Reviewer

Paste these into **App Review Information → Sign-in required → Yes**:

```
Email:    apple-review@neuroquestzen.pro
Password: SQVU453X
```

This account is pre-provisioned as an **enterprise-tier user** so the reviewer can see the full premium experience (Zen Pro features, wearable dashboard, team views) without needing to complete an in-app purchase. Auto-renewing subscriptions are still purchasable from the Shop tab in the sandbox if the reviewer wants to verify IAP wiring.

---

## Notes for Reviewer (paste into "Notes" field)

```
Thank you for reviewing NQ Zen Pro.

ABOUT THE APP
NQ Zen Pro is a brain-training and wellness app that uses neuroplasticity-based
cognitive exercises (focus, memory, reaction-time games) plus optional Apple
Health data (HRV, Sleep, Steps) to compute a personal Neuro Resilience Score.
It is intended for general wellness — it does not diagnose, treat, or prevent
any medical condition, and no claims of medical efficacy are made anywhere in
the UI or marketing copy.

HOW TO TEST
1. Sign in with the reviewer credentials above. The account is pre-linked to a
   demo enterprise team, so all premium features are unlocked immediately.
2. Tap the "Train" tab to access cognitive games (Focus Test, Memory Match,
   Neural Hold, etc.). The first-run onboarding includes a 30-second focus
   test that ends automatically.
3. Tap the "Play" tab to view the in-app currency (Neural Energy) and reward
   mechanics. Wheel/Diamond games use earned currency only — no real-money
   wagering, no randomness tied to purchase.
4. Tap "Resilience" to see the Neuro Resilience Score. If you grant Apple
   Health permissions, real HRV / Sleep / Step values will be used; otherwise
   sample values are shown.
5. Tap "Zen Pro" to see the subscription paywall and the "Restore Purchases"
   button (Guideline 3.1.1).
6. Tap "Profile" to see legal links, account management, and sign-out.

IN-APP PURCHASES
- Product ID: pro.neuroquestzen.app.zenpro.monthly
- Type: Auto-Renewing Subscription
- Price: $9.99 USD / month
- Free Trial: none on initial launch (can be enabled later)
- Subscription Group: "Zen Pro"
- Restore Purchases: available on Zen Pro tab and Profile → Restore Purchases

The reviewer account is already entitled to premium via enterprise seat
assignment, so no purchase is required to evaluate gated content. To test the
purchase flow itself, sign out and create a new sandbox account, then tap
"Subscribe" on the Zen Pro tab.

APPLE HEALTH (HEALTHKIT)
NQ Zen Pro reads three HealthKit data types when the user grants permission:
  - Heart Rate Variability (HRV / SDNN)
  - Sleep Analysis
  - Step Count
These are read in the foreground only (no background delivery) and are used
to compute the user's personal Neuro Resilience Score. Individual readings
are never shown to employers; for enterprise customers, only aggregates of
five or more employees are reported, and names are never attached. The
HealthKit usage description is set on the project and reads:

   "NeuroQuest reads your Heart Rate Variability, Sleep Analysis, and Step
    Count from Apple Health when you open the app, so we can compute your
    personal Neuro Resilience Score. Your individual readings are only used
    to show your own score; anything shared with your employer is anonymized
    into aggregates of 5 or more employees, and your name is never attached."

NeuroQuest does NOT write to HealthKit and does NOT request background
delivery, clinical records, or any health data beyond the three types listed.

ACCOUNT DELETION (Guideline 5.1.1(v))
Users can delete their account in-app from Profile → Account → Delete Account.
This permanently removes the user's profile, scores, and any biometric
aggregates from our servers within 30 days.

DATA COLLECTED
See the App Privacy section in App Store Connect — the only data linked to
the user is email (for account login) and the three HealthKit metrics listed
above. We do not use third-party advertising or tracking SDKs and do not
request App Tracking Transparency permission.

THIRD-PARTY SERVICES
- Authentication: Clerk (email + OAuth)
- Payments: Apple In-App Purchase only on iOS (Stripe is web-only and
  applies exclusively to enterprise B2B billing — never charged to the iOS
  user)
- Backend hosting: Replit Deployments (autoscale)

CONTACT
If anything is unclear, please reach Whitney Ausbrooks at
support@neuroquestzen.pro and we will respond within 4 business hours.
```

---

## App Privacy "Nutrition Label" — Suggested Answers

In **App Store Connect → App Privacy**, declare the following:

| Data Type | Linked to User? | Used for Tracking? | Purpose |
|---|---|---|---|
| Email Address | Yes | No | App Functionality (sign-in) |
| Health & Fitness — Heart Rate / HRV | Yes | No | App Functionality (Neuro Resilience Score) |
| Health & Fitness — Sleep | Yes | No | App Functionality (Neuro Resilience Score) |
| Health & Fitness — Steps / Fitness | Yes | No | App Functionality (Neuro Resilience Score) |
| Usage Data — Product Interaction | Yes | No | Analytics (game completion, streaks) |
| Identifiers — User ID | Yes | No | App Functionality |
| Diagnostics — Crash Data | No | No | Diagnostics |

**Tracking:** None. Do **not** add the App Tracking Transparency framework — we don't share data with data brokers or use third-party advertising.

---

## Subscription Details (paste into Subscription product page)

| Field | Value |
|---|---|
| Reference Name | Zen Pro Monthly |
| Product ID | `pro.neuroquestzen.app.zenpro.monthly` |
| Subscription Group | Zen Pro |
| Duration | 1 Month, Auto-Renewable |
| Price | $9.99 USD (Tier 10) |
| Free Trial | None |

**Localized Display Name:** Zen Pro Monthly
**Localized Description:**
> Unlock unlimited cognitive games, advanced Neuro Resilience Score insights, daily personalized training plans, and priority access to new brain-training content. Subscription auto-renews monthly at $9.99 USD until cancelled in your Apple ID Settings.

**Required EULA-style disclosure shown in-app on the paywall:**
> Payment will be charged to your Apple ID account at confirmation of purchase. Subscription automatically renews unless it is cancelled at least 24 hours before the end of the current period. Your account will be charged for renewal within 24 hours prior to the end of the current period. You can manage and cancel your subscriptions by going to your Apple ID account settings after purchase.

(This text is required by Guideline 3.1.2 and must be visible on the same screen as the Subscribe button.)

---

## Common Rejection Pre-Checks (already passing)

- ✅ **Guideline 3.1.1 — IAP only:** All in-app digital content uses Apple IAP. Stripe is web-only and B2B-only; iOS users never see a Stripe checkout.
- ✅ **Guideline 3.1.2 — Subscription disclosures:** Title, length, price, auto-renewal terms, and links to Privacy/Terms are present on the paywall.
- ✅ **Guideline 3.1.1 — Restore Purchases:** Button is on Zen Pro tab and Profile.
- ✅ **Guideline 5.1.1(v) — Account deletion:** Available in Profile → Account.
- ✅ **Guideline 5.1.3 — HealthKit:** Only reads three metrics, foreground only, with a clear usage string.
- ✅ **Guideline 1.1.6 — Medical claims:** Copy uses wellness language only ("resilience", "training", "well-being") — no diagnostic, treatment, or cure claims.
- ✅ **Guideline 4.5.4 — Push notifications:** Optional; user-controlled in Settings; not required for app function.
- ✅ **Encryption export compliance:** `ITSAppUsesNonExemptEncryption = false` is set.

---

## Build & Submit Checklist

1. Bump `buildNumber` in `artifacts/neuro-quest-mobile/app.json` for each TestFlight build (App Store Connect rejects duplicate build numbers).
2. Run `eas build --platform ios --profile production` from `artifacts/neuro-quest-mobile/`.
3. Upload via `eas submit --platform ios --latest` (or via Transporter).
4. In App Store Connect, attach the new build, paste the sections above into the matching fields, and submit for review.

---

## Quick-Reference Reviewer Cheat Card

```
App:        NQ Zen Pro (pro.neuroquestzen.app)  v1.0.0 (1)
Reviewer:   apple-review@neuroquestzen.pro / SQVU453X
IAP SKU:    pro.neuroquestzen.app.zenpro.monthly  ($9.99/mo)
HealthKit:  HRV, Sleep, Steps (read-only, foreground)
Support:    support@neuroquestzen.pro
```
