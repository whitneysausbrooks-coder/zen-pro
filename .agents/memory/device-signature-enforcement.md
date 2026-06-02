---
name: Device signature enforcement
description: The device HMAC handshake on per-:id endpoints runs in hard mode by default; how to revert.
---

The device HMAC signature handshake (`artifacts/api-server/src/lib/deviceAuth.ts`,
`requireDeviceSignature`) enforces by default — invalid / unsigned / spoofed
requests to per-`:id` app-user endpoints get 401. The earlier soft-mode rollout
(verify + log, never reject) is over.

**Default behavior:** `HARD_MODE` is computed as `!SOFT_MODE_OVERRIDE`, so no env
var is needed to enforce. `no_server_key` (SERVER_DEVICE_KEY unset/<32 chars) is
still allowed through to avoid locking everyone out on misconfiguration.

**Emergency rollback only:** set `DEVICE_AUTH_SOFT_MODE=1` to return to
verify-and-log-without-reject. `DEVICE_AUTH_HARD_MODE=1` is still honored and
takes precedence over the soft-mode escape hatch.

**Why:** enforcement-by-default in code (not by an env var that must be set in
every environment) means prod can't silently fall back to soft mode if a flag is
forgotten. The escape hatch exists so a regression can be mitigated without a
redeploy.

**How to apply:** GDPR export/erasure (`requireDeviceSignatureStrict`) and the
IAP entitlements path (`requireUserOrDevice`) already hard-reject independently
and ignore both flags — don't route them through the soft-mode escape hatch.
Non-ok verdicts are logged as `device_signature:<status>` for monitoring.
