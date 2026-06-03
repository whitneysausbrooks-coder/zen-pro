---
name: DB backups
description: How automated Postgres backups work and why they must run as a scheduled deployment, not in-process.
---

# Automated database backups

`pnpm --filter @workspace/api-server run backup:db` runs `pg_dump` (custom
format) → uploads to Replit object storage under `db-backups/<env>/` → prunes
to `DB_BACKUP_RETENTION` (default 14, invalid values fall back to 14).

**Why a scheduled deployment, not in-process cron:** the api-server deploys as
**autoscale**, which spins down when idle and can run multiple instances — an
in-process timer would fire unreliably or multiple times. Backups must be a
separate **Scheduled Deployment** running the `backup:db` command.

**How to apply:**
- The job must run in the **production** environment so it sees the production
  `DATABASE_URL` and the production object-storage bucket (dev and prod each
  have their own, separate). Running it in dev backs up the dev DB.
- `pg_dump` is available in prod because `postgresql-16` is a declared module in
  `.replit` (not an ambient dev-only binary).
- Dev-safe by design: no `DATABASE_URL` → clean no-op exit 0; any real failure
  (pg_dump/upload) → exit 1 for scheduled-job observability.
