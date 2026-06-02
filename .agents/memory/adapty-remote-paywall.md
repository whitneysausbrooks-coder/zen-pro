---
name: Adapty remote paywall (shop screen)
description: How the mobile shop screen renders from the Adapty remote paywall, and the Remote Config copy convention
---

# Remote paywall rendering (mobile shop screen)

The shop screen renders plan cards from the Adapty "zenpro" placement paywall,
not purely from static local data. Merge order per field:
- **title** ← product `localizedTitle` → Remote Config `title` → static.
- **price** ← product `price.localizedString` → static.
- **period / badge / features / cta / donationNote / highlight** ← Remote Config
  override → static.
Static `PLANS` (+ `PRODUCT_MAP` vendor ids) remain the fallback and the source of
card order/structure; remote data only overrides individual fields. So if the
Adapty fetch fails (offline / Expo Go / web) the screen still renders the static
cards.

## Remote Config JSON shape (paywall → Remote Config in the dashboard)
The paywall `remoteConfig.data` is parsed for per-plan copy overrides, keyed by
the local plan id (`founder` / `annual` / `pro` / `daily`):
```json
{ "plans": { "<planId>": { "title": "...", "badge": "...", "period": "...",
  "cta": "...", "donationNote": "...", "highlight": true,
  "features": ["...", "..."] } } }
```
All fields optional; parsing is defensive (wrong types are ignored).

**Why:** lets pricing (App Store/Adapty) AND marketing copy change from the
dashboard without an app release — the whole point of the remote paywall.
**How to apply:** keep `PRODUCT_MAP` vendor ids in sync with App Store Connect
ids; if you add a card field that should be remotely editable, extend both
`PlanCopyOverride` and `parseRemoteCopy` in `app/(tabs)/shop.tsx`.

## Dashboard config is a manual prerequisite (not code)
Configuring the Adapty dashboard (products, "zenpro" placement, "premium" access
level, and the paywall Remote Config JSON) is done in the Adapty web dashboard,
not from this repo. The code reads whatever the dashboard serves.
