# NeuroQuest — In-App Purchase Submission Guide
**Bundle ID:** `pro.neuroquestzen.app`
**App Name:** NQ Zen Pro
**Date prepared:** April 24, 2026

This document contains everything needed to create the 5 in-app purchases in App Store Connect → Monetization → In-App Purchases. Each product below has been wired into the app code and is ready to be submitted alongside the binary.

> **Donation pledge applied uniformly:** 30% of every IAP purchase is committed to mental-health charities. Per-product donation amounts are listed with each item.

---

## 1 · Zen Pro Monthly (Auto-Renewable Subscription)

| Field | Value |
|---|---|
| **Type** | Auto-Renewable Subscription |
| **Subscription Group** | `NeuroQuest Premium` (create if it doesn't exist) |
| **Product ID** | `pro.neuroquestzen.app.zenpro.monthly` |
| **Reference Name** | NeuroQuest Zen Pro Monthly |
| **Display Name** | Zen Pro Monthly |
| **Description (≤45 chars)** | All games unlocked + unlimited daily spins |
| **Price** | **$9.99 USD / month** (Tier 10) |
| **Subscription Duration** | 1 Month |
| **Free Trial / Intro Offer** | None at launch |
| **Family Sharing** | Off |
| **Promotional Image** | `exports/iap-images/01-zen-pro-monthly.png` |

**Review Notes (paste into App Store Connect):**
> Unlocks all four brain-training games (Neural Challenge, Mind-Reader, EQ, Pattern Pulse), unlimited daily spins, exclusive Zen themes, and advanced progress analytics. Renews monthly via StoreKit. $3.00 of every subscription is committed to mental-health charities. Restore Purchases is available on the Shop tab and from Settings.

---

## 2 · Daily Pass (Non-Consumable, 24-Hour Unlock)

| Field | Value |
|---|---|
| **Type** | Non-Consumable |
| **Product ID** | `pro.neuroquestzen.app.daypass` |
| **Reference Name** | NeuroQuest Daily Pass |
| **Display Name** | Daily Pass |
| **Description (≤45 chars)** | 24 hours of Zen Pro + 50 spins, no commit |
| **Price** | **$5.99 USD** (Tier 6) |
| **Family Sharing** | Off |
| **Promotional Image** | `exports/iap-images/02-daily-pass.png` |

**Review Notes:**
> Grants 24 hours of full Zen Pro access (all games + 50 spins) for users who don't want a recurring subscription. Time-bound entitlement is enforced server-side based on first-redemption timestamp; no recurring charge. $1.80 of every Daily Pass is committed to mental-health charities. Marked Non-Consumable so the entitlement record stays available to Restore Purchases — server enforces the 24-hour window from first activation.

---

## 3 · Extra Spins · 5-Pack (Consumable)

| Field | Value |
|---|---|
| **Type** | Consumable |
| **Product ID** | `pro.neuroquestzen.app.spins.5` |
| **Reference Name** | NeuroQuest Extra Spins — 5 Pack |
| **Display Name** | 5 Extra Spins |
| **Description (≤45 chars)** | 5 bonus spins that never expire |
| **Price** | **$0.99 USD** (Tier 1) |
| **Family Sharing** | N/A (consumable) |
| **Promotional Image** | `exports/iap-images/03-spins-5.png` |

**Review Notes:**
> Smallest spin-pack tier. Adds 5 bonus spins to the user's persistent balance (server-tracked); spins never expire and roll over across sessions. $0.30 of every purchase is committed to charity. Consumable type — Restore Purchases does NOT re-deliver consumed spins, which is the standard Apple pattern for currency packs.

---

## 4 · Extra Spins · 15-Pack (Consumable, "POPULAR")

| Field | Value |
|---|---|
| **Type** | Consumable |
| **Product ID** | `pro.neuroquestzen.app.spins.15` |
| **Reference Name** | NeuroQuest Extra Spins — 15 Pack |
| **Display Name** | 15 Extra Spins |
| **Description (≤45 chars)** | Most popular: 15 bonus spins, never expire |
| **Price** | **$1.99 USD** (Tier 2) |
| **Family Sharing** | N/A (consumable) |
| **Promotional Image** | `exports/iap-images/04-spins-15.png` |

**Review Notes:**
> Mid-tier spin pack, displayed in-app with a "POPULAR" badge. Adds 15 bonus spins to the user's persistent server-tracked balance; spins never expire. $0.60 of every purchase is committed to charity. Consumable — same Restore Purchases behavior as the 5-pack.

---

## 5 · Extra Spins · 50-Pack (Consumable, "BEST VALUE")

| Field | Value |
|---|---|
| **Type** | Consumable |
| **Product ID** | `pro.neuroquestzen.app.spins.50` |
| **Reference Name** | NeuroQuest Extra Spins — 50 Pack |
| **Display Name** | 50 Extra Spins |
| **Description (≤45 chars)** | Best value: 50 bonus spins, never expire |
| **Price** | **$4.99 USD** (Tier 5) |
| **Family Sharing** | N/A (consumable) |
| **Promotional Image** | `exports/iap-images/05-spins-50.png` |

**Review Notes:**
> Largest spin pack, displayed in-app with a "BEST VALUE" badge. Adds 50 bonus spins to the user's persistent server-tracked balance; spins never expire. $1.50 of every purchase is committed to charity. Consumable — same Restore Purchases behavior as the smaller packs.

---

## Pricing Summary at a Glance

| Product | Type | Price | Tier | Charitable Donation |
|---|---|---|---|---|
| Zen Pro Monthly | Subscription | $9.99 / mo | 10 | $3.00 / mo |
| Daily Pass | Non-Consumable | $5.99 | 6 | $1.80 |
| 5 Extra Spins | Consumable | $0.99 | 1 | $0.30 |
| 15 Extra Spins | Consumable | $1.99 | 2 | $0.60 |
| 50 Extra Spins | Consumable | $4.99 | 5 | $1.50 |

All five products use **30%** of revenue as the charitable donation rate (rounded to the nearest cent), giving the user a single, easy-to-remember pledge across the entire IAP catalog.

---

## App Store Connect Submission Checklist

For each product:
- [ ] Create with the exact Product ID listed above (case-sensitive, no typos — these IDs are hardcoded in `lib/iap.ts`)
- [ ] Upload the matching 1024×1024 promotional image from `exports/iap-images/`
- [ ] Set the correct price tier (US base — App Store Connect auto-fills other regions)
- [ ] Paste the Review Notes block into the Review Information field
- [ ] Add a localized Display Name and Description for at least English (U.S.)
- [ ] Mark as "Ready to Submit" so it ships in the same review as the binary

Once all 5 are at "Ready to Submit", attach them to your build under **App Store** → **iOS App** → **In-App Purchases and Subscriptions** before tapping Submit for Review.

---

## Cross-References

- **In-app product wiring:** `artifacts/neuro-quest-mobile/lib/iap.ts` (PRODUCT_IDS), `artifacts/neuro-quest-mobile/app/(tabs)/shop.tsx` (PRODUCT_MAP)
- **Server-side entitlement validation:** `artifacts/api-server/src/routes/iap.ts`
- **Reviewer-facing notes:** `exports/Apple_Reviewer_Notes.txt` (already mentions all 5 products and the 30% donation pledge)
- **Submission workbook:** `exports/NeuroQuest_Apple_Submission_Workbook.pdf` (section 4.2.5 has the full pricing table)
