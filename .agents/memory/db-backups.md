---
name: DB backups
description: How automated Postgres backups work and why they run via an admin HTTP trigger hit by an external cron, not a Replit Scheduled Deployment.
---

# Automated database backups

Core logic lives in `src/lib/backupDb.ts` (`runBackup()`): `pg_dump` (custom
format) → uploads to Replit object storage under `db-backups/<env>/` → prunes to
`DB_BACKUP_RETENTION` (default 14, invalid values fall back to 14). Two callers:
- CLI: `pnpm --filter @workspace/api-server run backup:db` (script delegates to `runBackup()`).
- HTTP: `POST /api/admin/db-backup`, gated by `ADMIN_MASTER_KEY` via `x-admin-key`
  header (same pattern as `/admin/donations/settle`).

**Why an HTTP trigger + external cron, NOT a Scheduled Deployment:** Replit
publishes the whole project as ONE deployment (here: autoscale). You cannot run a
separate Scheduled Deployment alongside the live app — switching the deployment
type to Scheduled would take the live API/site offline. So automation is: an
external cron service (cron-job.org, GitHub Actions, etc.) POSTs to the endpoint
daily with the admin key. Autoscale also rules out an in-process timer (sleeps
when idle, may run multiple instances).

**Routing gotcha:** `backupRouter` MUST be mounted before `adminRouter` in
`routes/index.ts`. `adminRouter` does `router.use("/admin", requireAdmin)` where
`requireAdmin` checks `ADMIN_SECRET` (unset in this project) and 403s
"Admin access is not configured" — so any `/admin/*` path it sees first is
blocked. Mounting backupRouter earlier lets `/admin/db-backup` resolve first.

**How to apply:**
- Production runs (real data) require hitting the endpoint on the deployed
  (production) URL so it uses the production `DATABASE_URL`. Dev/prod each have
  their own DB; the object-storage bucket is shared per-repl.
- `pg_dump` is available in prod because `postgresql-16` is a declared module in
  `.replit`.
- Dev-safe: no `DATABASE_URL` → `{skipped:true}` no-op; any real failure throws
  (CLI exit 1 / HTTP 500).
- Caveat: backup runs synchronously in the request. Fine while the DB is small;
  if it grows, watch for request/cron timeouts and consider a concurrency guard.
