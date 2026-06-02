---
name: Adapty monetization
description: How Adapty is wired as the single iOS purchase/entitlement source, and the webhook gotcha
---

# Adapty integration (iOS monetization)

Adapty is the single source of truth for iOS subscriptions + remote paywalls (A/B
+ revenue analytics via the dashboard). The old custom expo-iap client and the
server-side Apple receipt validation were fully removed.

## Native-module guarding (mobile)
- The Adapty native module does NOT exist in Expo Go or on web — touching it
  there crashes. `lib/adapty.ts` must keep every call gated by Platform.OS, key
  presence, AND `Constants.appOwnership` (Expo Go reports `"expo"`), and the SDK
  must be **lazily `require`d** inside a helper, never statically imported at top
  level (top level may use `import type` only).
- Real purchase/restore/identify testing only works on an EAS dev-client /
  TestFlight build, never in this environment.

## Server webhook — directional events only
**Rule:** the `POST /iap/adapty-webhook` handler must only mutate the
`iap_entitlements` mirror on events that are *unambiguously directional*
(subscription_started/initial_purchase/renewed/recovered, trial_started/converted,
non_subscription_purchase = activate; subscription_expired/refunded = deactivate).
**Why:** a generic, non-directional event like `access_level_updated` can mean
EITHER activation or deactivation; treating it as a blanket grant corrupts the
mirror (wrongly grants Pro). An architect review caught this.
**How to apply:** if you add a new event type to the activating/deactivating
sets, confirm it always implies one direction; otherwise inspect payload state
before mutating, or ignore it.

## Identity + auth
- `app_users.id` (varchar) is used as Adapty `customer_user_id` via
  `adapty.identify(userId)`, so webhooks arrive with the same id the server
  stores entitlements against.
- Webhook auth = constant-time compare of the `Authorization` header against
  `ADAPTY_WEBHOOK_SECRET` (a value the developer invents and also sets in the
  Adapty dashboard webhook config). `GET /iap/entitlements` keeps device-HMAC auth.
- `EXPO_PUBLIC_ADAPTY_SDK_KEY` is the Adapty **public** SDK key (safe to embed);
  for real EAS builds it must ALSO be added as an EAS secret to be embedded at
  build time.
