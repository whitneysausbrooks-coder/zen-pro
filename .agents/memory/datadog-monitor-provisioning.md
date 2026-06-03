---
name: Datadog monitor & dashboard provisioning
description: How committed Datadog monitor/dashboard JSON gets applied to the live account, and the conventions for adding new ones.
---

# Datadog monitor provisioning

Committed monitor-as-code lives in `artifacts/api-server/docs/monitors/*.json`. It is
reconciled to the live Datadog account by `artifacts/api-server/scripts/provision-monitors.ts`,
which runs automatically as the **last step of the api-server production build**
(`pnpm --filter @workspace/api-server run build`). So a deploy = monitors reconciled.

**Idempotency key:** the script injects a `monitor_key:<file-stem>` tag and searches by it
(`GET /api/v1/monitor?monitor_tags=monitor_key:<stem>`). Found → PUT (update); not found → POST
(create). One file ↔ one live monitor. Do NOT hand-create these monitors in the Datadog UI — a
manual copy without the `monitor_key` tag becomes an un-reconciled duplicate.

**Why:** a committed JSON that nobody applies is not an alert; file and live monitor could drift
or the monitor could be missing in a fresh env. Provisioning from the file closes that gap.

**How to apply (adding a monitor):** drop a new `*.json` in `docs/monitors/`. It auto-provisions
on the next deploy build — no UI step. `_`-prefixed fields (e.g. `_runbook`) are stripped before
sending. Required: `name`, `type`, `query`; for log alerts also `options.thresholds`.

**Credentials (secrets, never printed):** `DATADOG_API_KEY` + `DATADOG_APP_KEY`
(aliases `DD_APP_KEY` / `DATADOG_APPLICATION_KEY`), `DATADOG_SITE` (prod is `us5.datadoghq.com`,
set in `.replit` userenv.shared). The Monitors API needs the **app key**, not just the API key the
logs intake in `errorMonitoring.ts` uses.

**Dev-safe / failure policy:** no creds → logs a skip and exits 0 (normal in dev). In provision
mode a Datadog API/network error is logged but does NOT fail the deploy build (monitoring outage
must not cascade); pass `--strict` to make failures exit non-zero.

**Drift detection:** `pnpm --filter @workspace/api-server run monitors:check` (or the script with
`--check`) is read-only and exits 1 if any live monitor is missing, duplicated, or differs from its
file in name/type/query/message/tags/declared options. Requires live creds, so it is a CI/manual
guard, not part of the build.

## Dashboards (same pattern, separate script)

Committed dashboard-as-code lives in `artifacts/api-server/docs/dashboards/*.json`, reconciled by
`scripts/provision-dashboards.ts`, also wired into the api-server build (`tsx ./scripts/provision-dashboards.ts`
after the monitor step). Same dev-safe skip, same non-strict/`--strict` failure policy, same `--check`
drift mode + `dashboards:check` / `dashboards:provision` package scripts, same `_`-prefix field strip.

**Key difference — idempotency:** the Dashboards API (`/api/v1/dashboard`) has no searchable tag field
like Monitors, so the key is a `[managed: dashboard_key:<stem>]` marker appended to the dashboard
**description**. List all dashboards, match the marker in description, PUT if found else POST. The marker
is stripped-then-reappended each run so it never stacks. Do NOT hand-edit the live description's marker.

**Drift compare is shallow by design:** Datadog backfills widget ids + many default fields, so a deep
equal would always report drift. `diffFields` only compares title/description/layout_type/reflow_type/
template_variables and a `widgetSignature` (ordered type:title of each widget, recursing into groups).
