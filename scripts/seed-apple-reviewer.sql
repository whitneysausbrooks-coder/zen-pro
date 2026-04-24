-- Seed Apple App Review credentials.
-- Idempotent: re-running this is safe; it cleans up and re-inserts.
--
-- DEV usage:
--   psql "$DATABASE_URL" -f scripts/seed-apple-reviewer.sql
--
-- PRODUCTION usage:
--   psql "$PROD_DATABASE_URL" -f scripts/seed-apple-reviewer.sql
--
-- Credentials this creates:
--   Email:        apple-review@neuroquestzen.pro
--   Invite code:  APPL2026
--   Pilot expires: 5 years from seed date (so it never expires during reviews)
--   Seats:        10 (plenty for the reviewer + any escalation testers)

DELETE FROM enterprise_users WHERE email = 'apple-review@neuroquestzen.pro';
DELETE FROM companies WHERE invite_code = 'APPL2026';

INSERT INTO companies (
  name, industry, seat_count, seat_cap, invite_code, admin_email,
  pilot_status, pilot_started_at, pilot_ends_at,
  subscription_status, billing_period_end,
  primary_color, welcome_message
) VALUES (
  'Apple App Review',
  'Technology',
  10, 10,
  'APPL2026',
  'apple-review@neuroquestzen.pro',
  'active',
  now(),
  now() + interval '5 years',
  'trialing',
  now() + interval '5 years',
  '#1a1830',
  'Welcome, Apple App Review team. This is a dedicated reviewer account.'
);

INSERT INTO enterprise_users (email, company_id, role, department)
SELECT 'apple-review@neuroquestzen.pro', id, 'admin', 'App Review'
FROM companies WHERE invite_code = 'APPL2026';

-- Verify
SELECT 'COMPANY' AS row_type, c.name, c.invite_code, c.pilot_status,
       c.pilot_ends_at::date AS pilot_ends, c.seat_count
FROM companies c WHERE invite_code = 'APPL2026';

SELECT 'USER' AS row_type, u.email, u.role, u.department, c.name AS company
FROM enterprise_users u JOIN companies c ON c.id = u.company_id
WHERE u.email = 'apple-review@neuroquestzen.pro';
