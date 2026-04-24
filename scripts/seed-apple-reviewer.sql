-- Seed Apple App Review credentials (DEV mirror of production seed).
--
-- Production was seeded via:
--   POST https://neuroquestzen.pro/api/enterprise/onboard-pilot
-- which auto-generated invite_code = SQVU453X.
--
-- This script keeps the dev database in sync with that production value.
--
-- Usage (idempotent):
--   psql "$DATABASE_URL" -f scripts/seed-apple-reviewer.sql
--
-- Credentials this creates:
--   Email:        apple-review@neuroquestzen.pro
--   Invite code:  SQVU453X  (matches production)
--   Pilot expires: 1 year (max allowed by /onboard-pilot endpoint)
--   Seats:        10

DELETE FROM enterprise_users WHERE email = 'apple-review@neuroquestzen.pro';
DELETE FROM companies WHERE invite_code IN ('APPL2026', 'SQVU453X');

INSERT INTO companies (
  name, industry, seat_count, seat_cap, invite_code, admin_email,
  pilot_status, pilot_started_at, pilot_ends_at,
  subscription_status, billing_period_end,
  primary_color, welcome_message
) VALUES (
  'Apple App Review',
  'Technology',
  10, 10,
  'SQVU453X',
  'apple-review@neuroquestzen.pro',
  'active',
  now(),
  now() + interval '1 year',
  'trialing',
  now() + interval '1 year',
  '#1a1830',
  'Welcome, Apple App Review team. This is a dedicated reviewer account.'
);

INSERT INTO enterprise_users (email, company_id, role, department)
SELECT 'apple-review@neuroquestzen.pro', id, 'admin', 'App Review'
FROM companies WHERE invite_code = 'SQVU453X';

-- Verify
SELECT 'COMPANY' AS row_type, c.name, c.invite_code, c.pilot_status,
       c.pilot_ends_at::date AS pilot_ends, c.seat_count
FROM companies c WHERE invite_code = 'SQVU453X';

SELECT 'USER' AS row_type, u.email, u.role, u.department, c.name AS company
FROM enterprise_users u JOIN companies c ON c.id = u.company_id
WHERE u.email = 'apple-review@neuroquestzen.pro';
