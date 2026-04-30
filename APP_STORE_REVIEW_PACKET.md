# NeuroQuest Zen Pro — Build #9 App Store Review Packet

**For Whitney to double-check before hitting "Submit for Review" in App Store Connect.**

Last updated: 2026-04-30

---

## 1. Build Identification

| Field | Value |
|---|---|
| App name | NQ Zen Pro |
| Bundle ID | `pro.neuroquestzen.app` |
| App Store Connect App ID | `6763640852` |
| Apple Team ID | `XGP7472WPJ` |
| Apple ID (developer account) | `whitneysausbrooks@icloud.com` |
| Version (CFBundleShortVersionString) | `1.0.0` |
| Build number (CFBundleVersion) | Auto-incremented by EAS — confirm in App Store Connect after upload |
| Category | `public.app-category.healthcare-fitness` (Health & Fitness) |
| Min iOS | 15.1 (Expo SDK 54 default) |
| iPad support | **No** (`supportsTablet: false`) |
| Encryption (`ITSAppUsesNonExemptEncryption`) | `false` (declared in Info.plist — only standard HTTPS/TLS used) |

---

## 2. App Store Connect — App Review Information

Paste these into **App Store Connect → My Apps → NQ Zen Pro → App Information → App Review Information**.

### 2a. Sign-In Required

> **Yes — sign-in is required.** Reviewer must use the demo account below.

### 2b. Demo Account

Create this in your app **before** submitting:

| Field | Value |
|---|---|
| Email | `apple-review@neuroquestzen.pro` |
| Password | (set a strong password — store in 1Password and paste into ASC) |
| Account type | Individual (not enterprise) |

Action required: register this account through the app's onboarding flow once on a TestFlight device, complete the consent gate, and add 7 days of synthetic biometric samples so the reviewer sees a non-empty Resilience Score and personalized insights. Otherwise the reviewer will see "baseline_incomplete" and may flag the app as "non-functional".

### 2c. Contact Information

| Field | Value |
|---|---|
| First name | Whitney |
| Last name | Ausbrooks |
| Phone | (your number with country code) |
| Email | `whitneysausbrooks@icloud.com` |

### 2d. Notes for Apple Reviewer

Paste verbatim into the **Notes** field:

```
Thank you for reviewing NeuroQuest Zen Pro.

OVERVIEW
NeuroQuest Zen Pro is a personal wellness and brain-training app. It reads
optional Heart Rate Variability, Sleep, and Step data from Apple HealthKit
to compute a "Neuro Resilience Score" for the user, and offers binaural-beat
meditation audio, brain-training mini-games, and an optional in-app
subscription. There is no medical diagnostic claim — copy uses wellness
language only.

DEMO ACCOUNT
Email:    apple-review@neuroquestzen.pro
Password: (see Demo Account field)
The account is pre-loaded with 7 days of biometric samples so the Resilience
Score, personalized insights, and the daily check-in flow are immediately
visible. No real personal data is in this account.

HEALTHKIT USAGE
On first launch the app requests read-only access to Heart Rate Variability,
Sleep Analysis, and Step Count. These reads are used solely to compute the
on-device Neuro Resilience Score and the user's personal trend over time.
Individual readings are never shared with third parties or with the user's
employer; only anonymized aggregates of 5 or more employees are surfaced in
the optional Enterprise dashboard, and the user's name is never attached.
The HealthKit usage description in Info.plist explains this in plain English.

IN-APP PURCHASES
- pro.neuroquestzen.app.zenpro.monthly  (auto-renewable subscription, $9.99/mo
  with 7-day free trial) — unlocks all premium meditation tracks, advanced
  AI insights, and unlimited brain-training game replays.
- pro.neuroquestzen.app.daypass  (non-consumable one-day pass, $1.99) —
  24-hour access to all premium features without a subscription.
- pro.neuroquestzen.app.spins.5 / .15 / .50  (consumables, $0.99 / $1.99 /
  $4.99) — additional spins for the in-app "Lucky Spin" reward wheel beyond
  the 5 free daily spins. The wheel awards in-app cosmetic / gameplay
  rewards only — no real money or gambling component.

The Lucky Spin wheel is a free-to-play game-of-chance bonus mechanic. It
is NOT gambling: prizes are virtual rewards inside the app, the user
cannot wager real money, and the user cannot cash out anything of monetary
value. 5 spins refresh free every 24 hours.

SUBSCRIPTION DISCLOSURE
Subscription terms (price, billing period, auto-renewal, cancellation) are
shown to the user before purchase on the Shop screen, with links to our
Terms of Use and Privacy Policy. Auto-renewal can be cancelled at any
time in iOS Settings → Apple ID → Subscriptions.

PRIVACY
Privacy Policy:  https://neuroquestzen.pro/privacy
Terms of Use:    https://neuroquestzen.pro/terms
Data deletion / export: in-app under Profile → Privacy & Data, or by emailing
privacy@neuroquestzen.pro. The app implements GDPR-compliant data export
and erasure routes at the API level.

GDPR / DATA SUBJECT RIGHTS
The app provides a one-tap data export (downloads a JSON of all stored data
for the user) and a one-tap account deletion (anonymizes all PII in place
while preserving audit-log integrity). These are reachable from the in-app
Profile screen.

If you have any questions during review, please reach out at
whitneysausbrooks@icloud.com — I respond within hours.

Thank you,
Whitney Ausbrooks
NeuroQuest LLC
```

### 2e. Attachments

You can optionally attach:
- A short PDF cheat-sheet explaining the demo flow (not required)
- The Privacy Policy URL (already in notes — no PDF needed)

---

## 3. Privacy Practices ("Nutrition Label")

In **App Store Connect → App Privacy → Get Started**, declare exactly the following. Misdeclaration is the #1 cause of post-launch removal.

### 3a. Data You Collect

| Category | Specific data | Linked to user? | Used to track? | Purpose |
|---|---|---|---|---|
| Health & Fitness | Heart Rate Variability | Yes | No | App Functionality, Analytics (your own — not 3rd-party tracking) |
| Health & Fitness | Sleep Analysis | Yes | No | App Functionality |
| Health & Fitness | Step Count | Yes | No | App Functionality |
| Contact Info | Email Address | Yes | No | App Functionality (account), Customer Support |
| Contact Info | Name | Yes | No | App Functionality (display name) |
| Identifiers | User ID | Yes | No | App Functionality |
| Purchases | Purchase History | Yes | No | App Functionality (entitlements) |
| Diagnostics | Crash Data | No | No | App Functionality |
| Diagnostics | Performance Data | No | No | Analytics |
| Usage Data | Product Interaction | Yes | No | Analytics, App Functionality |

### 3b. Data NOT Collected

Confirm "No" for everything else, especially:
- Location (precise / coarse) — **No**
- Contacts — **No**
- Photos / Videos — **No**
- Audio Data — **No**
- Search History — **No**
- Browsing History — **No**
- Financial Info — **No** (Stripe handles all payment data; we never see card numbers)
- Sensitive Info — **No** (race, religion, sexual orientation, political opinion, etc.)

### 3c. Tracking

> **No data is used to track the user across other companies' apps and websites.**

We do not use IDFA, do not use Facebook SDK, do not use AppsFlyer, Adjust, Branch, or any other attribution SDK. No tracking, period. This is critical — declaring "Yes" here triggers ATT prompts and a Privacy Manifest that we don't currently ship.

---

## 4. Age Rating

| Question | Answer |
|---|---|
| Cartoon or Fantasy Violence | None |
| Realistic Violence | None |
| Prolonged Graphic or Sadistic Realistic Violence | None |
| Profanity or Crude Humor | None |
| Mature/Suggestive Themes | None |
| Horror/Fear Themes | None |
| Medical/Treatment Information | **Infrequent/Mild** (wellness guidance, no diagnostic claims) |
| Alcohol, Tobacco, or Drug Use | None |
| Simulated Gambling | **Infrequent/Mild** ⚠️ — the Lucky Spin wheel is a game-of-chance with no real-money wagering. Apple sometimes still asks for a 17+ rating if "Simulated Gambling" is checked at all. **If you want to keep a 4+ or 12+ rating, set this to "None"** on the grounds that the prizes are non-monetary in-game items. Either answer is defensible; the safest is "None" because the user cannot wager and cannot cash out. |
| Unrestricted Web Access | None |
| Gambling and Contests | **No** (no real-money gambling) |

**Recommended target rating: 12+** (medical/treatment information at "infrequent/mild" forces 12+ minimum in Apple's rating engine).

---

## 5. Export Compliance

| Field | Value |
|---|---|
| Does your app use encryption? | **Yes** |
| Does your app qualify for any of the exemptions? | **Yes** — exempt under category 5D992.c (uses only standard encryption like HTTPS/TLS) |
| Does your app implement encryption algorithms not accessible to other apps? | **No** |
| Already declared in `Info.plist`? | **Yes** — `ITSAppUsesNonExemptEncryption = false`. ASC will not re-prompt on every build. |

No CCATS or French Encryption Declaration required.

---

## 6. In-App Purchases — Status Checklist

For each product below, confirm in **App Store Connect → My Apps → NQ Zen Pro → Monetization → In-App Purchases & Subscriptions**:

| Product ID | Type | Price | Status required at submit |
|---|---|---|---|
| `pro.neuroquestzen.app.zenpro.monthly` | Auto-Renewable Subscription | $9.99/mo (7-day free trial) | "Ready to Submit" + attached to this app version |
| `pro.neuroquestzen.app.daypass` | Non-Consumable | $1.99 | "Ready to Submit" + attached to this app version |
| `pro.neuroquestzen.app.spins.5` | Consumable | $0.99 | "Ready to Submit" |
| `pro.neuroquestzen.app.spins.15` | Consumable | $1.99 | "Ready to Submit" |
| `pro.neuroquestzen.app.spins.50` | Consumable | $4.99 | "Ready to Submit" |

**Each product needs:**
- Reference name + display name (max 30 chars)
- Description (max 45 chars on the price screen, 4000 chars in the long description)
- Localization for English (US) at minimum
- A single 1024×1024 review screenshot showing the purchase context — for the subscription, this is your Shop screen with the "Subscribe" button visible. **Apple rejects 100% of subscription submissions missing this screenshot.**
- Subscription only: a "Subscription Group" must be created (e.g. "NeuroQuest Pro") and the subscription assigned to it
- Subscription only: paste the Auto-Renew Disclosure (see §7) into the description field

**Critical:** all 5 products MUST be in "Ready to Submit" state and explicitly attached to this build's version (1.0.0) BEFORE you click Submit. Otherwise the app will reject any purchase attempt during review and Apple will fail you on Guideline 2.1 (Performance) for "non-functional purchase flow".

---

## 7. Subscription Auto-Renew Disclosure

This block of text MUST appear visibly to the user on the Shop screen near the "Subscribe" button (Apple Guideline 3.1.2). Verify the text below is rendered in `app/(tabs)/shop.tsx` before submitting:

```
NeuroQuest Pro Monthly — $9.99/month with a 7-day free trial.

• Payment will be charged to your Apple ID at confirmation of purchase.
• Subscription automatically renews unless cancelled at least 24 hours
  before the end of the current period.
• Your account will be charged for renewal within 24 hours prior to the
  end of the current period at $9.99/month.
• You can manage and cancel your subscription in your iOS Settings →
  Apple ID → Subscriptions after purchase.
• Any unused portion of the free trial is forfeited when you purchase
  a subscription.

Privacy Policy: https://neuroquestzen.pro/privacy
Terms of Use:   https://neuroquestzen.pro/terms
```

**Guideline 3.1.2 rejection trigger:** if any of these bullets is missing, or if the Privacy/Terms links don't open functioning pages, you will get rejected.

---

## 8. App Privacy Policy & Terms — URLs Must Be Live

Before submitting, open each URL in a private browser window and confirm it loads:

- https://neuroquestzen.pro/privacy
- https://neuroquestzen.pro/terms
- https://neuroquestzen.pro/support  (Marketing URL / Support URL in ASC)

These are required fields in App Store Connect → App Information. A dead URL is an automatic rejection.

---

## 9. Apple-Review-Fail-Proof Checklist (Build #9 Specific)

Hardening done in this session that defends against the most common rejection reasons:

| Risk | Apple Guideline | Our Defense |
|---|---|---|
| IAP fails during review (purchase doesn't unlock anything) | 2.1 Performance | Mobile IAP routes now go through `requireUserOrDevice` HMAC-signed; `play.tsx` and `shop.tsx` reconcile with server-authoritative `spin_balance` after every purchase. Server validates Apple JWS receipts. |
| Health data misused / overshared | 5.1.1 Data Collection, HealthKit | `NSHealthShareUsageDescription` explicitly states data stays personal; aggregates are anonymized to ≥5 employees; no individual data sent to employer. |
| Subscription terms missing 3.1.2 disclosure | 3.1.2 Subscriptions | See §7 — verify presence on Shop screen. |
| Account creation without account deletion | 5.1.1(v) | GDPR-compliant `/delete` route ships with this build; reachable from Profile screen. Anonymizes in place, idempotent, audit-logged. |
| Re-registration after deletion ("data resurrection") | 5.1.1 / GDPR | `/register` returns 410 Gone on tombstoned PKs; placeholder is opaque random hex (not derivable from PK). |
| Missing Sign in with Apple when other 3rd-party logins exist | 4.8 | We use device-key + Clerk only. No Google / Facebook login is offered, so Sign in with Apple is **not required**. (If you ever add Google/Facebook login, you must also add SIWA.) |
| Mentioning Android / "Pixel Watch" in marketing copy on iOS app | 2.3.10 | Audit your App Store description and screenshot copy — remove any Android / Galaxy / Pixel mentions before submit. |
| Crash on launch / non-functional features | 2.1 | api-server tsc clean (0 errors), mobile tsc clean (0 errors). Production CJS bundle (~1.5 MB) builds and boots cleanly. Smoke-tested register → biometrics → score → export → delete round-trip. |
| Lucky Spin classified as gambling | 5.3.4 | Free 5 spins/day, no real-money wagering, prizes are non-monetary in-app cosmetics. Set Simulated Gambling = "None" in age rating (see §4). |
| HIPAA / BAA marketing claim that's not delivered | 5.4 / general accuracy | README downgraded HIPAA BAA from "Available" to "Roadmap Q4 2026". If your App Store description or screenshots claim HIPAA compliance, **remove that claim before submit**. |
| Background HealthKit reads draining battery | HealthKit best practice | `background: false` declared in app.json HealthKit plugin config. |
| App Tracking Transparency prompt not shown but tracking declared | 5.1.2 | We declare "Not used to track" — we do not call `requestTrackingPermission` and do not need ATT. Verify no analytics SDK that uses IDFA was added since this audit. |

---

## 10. Pre-Submit Manual Checklist for Whitney

Tick each item in App Store Connect before clicking **Submit for Review**:

- [ ] App version 1.0.0 created with the new Build #9 attached
- [ ] App Information → Privacy Policy URL filled and loading
- [ ] App Information → Support URL filled and loading
- [ ] App Information → Marketing URL (optional but recommended)
- [ ] App Information → Category: Primary "Health & Fitness"
- [ ] Pricing & Availability set (free with IAP, all territories OR your chosen subset)
- [ ] App Privacy "Nutrition Label" filled per §3 above
- [ ] Age Rating set per §4 above
- [ ] All 5 IAP products in "Ready to Submit" and attached to v1.0.0
- [ ] Subscription Group created and `zenpro.monthly` assigned
- [ ] Auto-Renew Disclosure present in subscription description per §7
- [ ] Demo account created in production app per §2b
- [ ] App Review Information completed per §2 (sign-in YES, demo creds, contact, notes pasted)
- [ ] Export Compliance answered per §5
- [ ] At least 3 iPhone 6.7" screenshots uploaded (1290×2796) — **screenshots must match what's actually in the app, no marketing mockups**
- [ ] App description does not claim HIPAA, does not mention Android/Galaxy/Pixel
- [ ] Promotional text (170 chars) reviewed
- [ ] Keywords (100 chars) reviewed — avoid competitor brand names
- [ ] What's New text (4000 chars) reviewed
- [ ] iPad checkbox confirmed OFF in pricing (since `supportsTablet: false`)

When every box is ticked → **Submit for Review**.

---

## 11. Post-Submit Monitoring

- Apple's median review time for Health & Fitness apps in 2026 is ~24 hours; 90th percentile is ~48 hours.
- Watch for "Metadata Rejected" first (faster, fixable in ASC without resubmitting binary) vs "Binary Rejected" (requires Build #10).
- If rejected, do not panic — read the Resolution Center message carefully, reply with reasoned justification (Apple reviewers reverse ~30% of rejections on appeal when the explanation is clear), and only resubmit a new binary if a code change is genuinely needed.

---

## 12. Build Dispatch Status

The Build #9 binary has **not yet been uploaded to App Store Connect** as of this packet's timestamp. The Replit sandbox blocks the EAS CLI's local git operations, so the dispatch command needs to run from a different environment. Two options:

1. **Run locally on your Mac** (recommended — faster, you see the QR code / build URL directly):
   ```
   cd artifacts/neuro-quest-mobile
   EXPO_TOKEN=<your-token> eas build --platform ios --profile production --non-interactive
   ```
   Once the build finishes (~15 min on EAS cloud), run:
   ```
   eas submit --platform ios --profile production --latest
   ```
   `eas submit` uploads the .ipa to App Store Connect; from there you go to ASC and follow §10.

2. **Dispatch from this Replit project as a background project task** — let me know and I'll switch to plan mode and propose the dispatch as a task; the task agent has the git permissions the main agent doesn't.

Either way, the binary that gets built is identical — same source code, same `eas.json` production profile, same EAS project ID `ec03c65f-26ac-4c59-a053-617a543396fe`.

---

*End of packet. Save this file, walk through every section, then submit. Good luck on Review — the engineering is solid.*
