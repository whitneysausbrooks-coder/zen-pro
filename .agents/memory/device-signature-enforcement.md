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

**Production validation (observed):** after enforcement went live, a prod-log
check found ZERO `device_signature:*` rejection messages from active installs
(no `missing`/`invalid`/`expired`/`id_mismatch`/`replayed`) — i.e. no
wrongful lockouts, observed pass rate effectively 100%. Note the signal is
*absence of non-ok verdicts*, not a count of `ok`: **`ok` is never logged**;
only non-ok verdicts emit `device_signature:<status>`. So the validation
criterion is "no spike of non-ok rejections from active installs", and the
emergency rollback trigger is such a spike. First check ran over a short,
low-traffic post-deploy window — keep watching after higher-volume traffic
before declaring enforcement fully battle-tested.

**Wrongful-lockout alerting:** non-ok captures carry `extra.active_install`
(`isActiveInstall` = request sent >=1 of the four device-auth headers). The
lockout monitor (`artifacts/api-server/docs/monitors/device-signature-lockout.json`,
a Datadog log-alert-as-code; the live monitor is provisioned in the Datadog tool)
fires on `device_signature:missing|invalid|id_mismatch` with
`@extra.active_install:true`. **Why active_install:** old/pre-handshake installs
send NO headers → always `missing` → a normal steady tail that must NOT page;
device-aware clients send headers, so a rejection there is a real member locked
out. `expired`/`issued_at_too_old`/`replayed`/`no_server_key` are deliberately
EXCLUDED (not wrongful lockouts). Baseline ~0, so threshold is low (warn 5 /
crit 15 over 15m); the alert body points to the `DEVICE_AUTH_SOFT_MODE=1`
rollback. At higher volume convert to a ratio using sampled `device_signature:ok`
as denominator.

**Replay protection (accept-once):** a valid signature must also be a FIRST
use. `consumeRequestNonce` records `SHA256(user_id:signature)` in
`device_request_nonces` after a verified `ok`; a reused nonce → `replayed` →
401. The nonce IS the signature (a replay is byte-identical, so it collides),
so the mobile client needed no change. It runs in hard-reject paths and in the
soft-tolerant middleware only when HARD_MODE (soft mode rejects nothing,
including replays). **Fails OPEN** (`skipped`) on a missing signature header or
any DB error — a nonce-store outage must not lock everyone out; the 5-min skew
window still bounds exposure. Nonces older than the window are pruned
opportunistically (the timestamp check already rejects them).
**Why:** the skew window alone allowed unlimited replays inside 5 min.
