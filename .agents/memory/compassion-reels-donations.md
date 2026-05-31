---
name: Compassion Reels donations (every.org)
description: Architecture + constraints for the business-funded micro-donation feature in the NeuroQuest mobile Play tab.
---

# Compassion Reels — business-funded micro-donations

The Play-tab game accrues a REAL, business-funded micro-donation on each "Compassion
Milestone" (a win/boost during play). The user NEVER pays. Donations go to a nonprofit
via every.org.

## Architecture: ACCRUE-then-SETTLE (decided, keep consistent)
- Per-event/per-spin transfers to a charity are economically impossible — processor
  fees dwarf a few cents. So each milestone only **accrues** a committed micro-donation
  row (`compassion_donations`), capped by a hard monthly budget (`compassion_budget`).
- The aggregate is **settled** in batches by the BUSINESS via an every.org donate link
  (admin-triggered). every.org fires a webhook that flips the batch rows to `settled`.
- **Why:** lets the company honestly fund giving without paying card fees on every cent,
  and keeps the user out of any payment flow (Apple-submission-safe; not gambling, not IAP).

## Hard rules
- **Cap enforcement** lives in `POST /donations/compassion-milestone`: `withTransaction`
  + `SELECT ... FOR UPDATE` on the month budget row before insert/increment. This is the
  ONLY real spend control — the milestone endpoint is public, so the cap is what stops a
  bot draining the budget. Treat the cap as authoritative, not the client.
- **Settle must be a single atomic statement**: `UPDATE ... WHERE status='accrued'
  RETURNING amount_cents`, then sum the returned rows. Never SELECT-sum-then-UPDATE — the
  donate-link total must equal the exact rows claimed into the batch, even under concurrent
  settle/milestone races.
- **Webhook is fail-closed in production**: if no `EVERY_ORG_WEBHOOK_TOKEN` is configured,
  refuse webhooks when `NODE_ENV==='production'` (allowed in dev). Prefer header
  `x-webhook-token`; query `webhook_token` is only accepted for every.org's echo mechanism.
  **Why low-risk:** the webhook only flips a status label — it moves no money and does not
  touch the cap (cap is on `accrued`), so a forged webhook's blast radius is tiny.

## every.org integration notes
- every.org has **no Replit integration**. The public donate link works WITHOUT an API key,
  so the whole feature functions with no secret. `EVERY_ORG_API_KEY` only improves nonprofit
  validation; `EVERY_ORG_WEBHOOK_TOKEN` only enables webhook auth.
- Config env w/ code fallbacks: `COMPASSION_NONPROFIT_SLUG=feeding-america`,
  `COMPASSION_MONTHLY_BUDGET_CENTS=5000`, `COMPASSION_MILESTONE_CENTS=10`.
- The API process caches env at boot — restart the API workflow after changing any of these.

## Apple-submission copy constraint
- All user-facing slot/casino/jackpot/"win money" wording must be reframed. Reframe only
  USER-FACING strings + casino emoji (🎰💰🎲🃏7️⃣🍒 → wellness emoji); internal identifiers
  (file/component/type names like `DiamondJackpotSlot`, outcome `"mega"`) can stay.
- **Why:** the original tied random outcomes to real money ("win money"), which reads as
  real-money gambling. Business-funded + de-gambled copy keeps it review-safe.
