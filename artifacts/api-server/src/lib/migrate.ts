import { query } from "./db";

/**
 * Idempotent schema bootstrap for tables this server owns directly.
 *
 * NOTE: We use raw `CREATE TABLE IF NOT EXISTS` rather than drizzle-kit push
 * because the existing production database has many tables (enterprise_users,
 * biometrics, wearable_data, companies, etc.) that pre-date the drizzle schema
 * in lib/db. Running drizzle push --force would drop them. Once the full
 * schema is mapped into drizzle, this file can be retired.
 *
 * Tables created here support the individual (non-enterprise) account flow
 * needed for the AI personalization engine.
 */
export async function runMigrations(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id varchar PRIMARY KEY,
      email varchar NOT NULL,
      name varchar NOT NULL,
      account_type varchar NOT NULL DEFAULT 'individual',
      created_at timestamptz NOT NULL DEFAULT now(),
      last_login timestamptz NOT NULL DEFAULT now(),
      onboarding_complete boolean NOT NULL DEFAULT false,
      wearable_connected boolean NOT NULL DEFAULT false,
      wearable_type varchar
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email)`);

  await query(`
    CREATE TABLE IF NOT EXISTS app_user_biometrics (
      id serial PRIMARY KEY,
      app_user_id varchar NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      hrv double precision,
      sleep_hours double precision,
      steps integer,
      strain_score double precision,
      neuro_resilience_score double precision,
      ema_7day double precision,
      data_source varchar NOT NULL DEFAULT 'manual',
      recorded_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_app_user_biometrics_user_recorded
    ON app_user_biometrics(app_user_id, recorded_at DESC)
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS app_user_ai_personalization (
      id serial PRIMARY KEY,
      app_user_id varchar NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      suggestion_type varchar NOT NULL,
      suggestion_payload jsonb,
      triggered_score double precision,
      triggered_at timestamptz NOT NULL DEFAULT now(),
      accepted boolean,
      feedback_rating integer,
      responded_at timestamptz
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_app_user_ai_personalization_user
    ON app_user_ai_personalization(app_user_id, triggered_at DESC)
  `);

  // ---- ZenPro Sprint Checklist additions (April 2026) ----

  // G19 — Terms / Privacy acceptance. Versioned so we can re-prompt when
  // legal terms change. Logged with timestamp for HIPAA / App Store compliance.
  await query(`
    CREATE TABLE IF NOT EXISTS app_user_tos_acceptances (
      id serial PRIMARY KEY,
      app_user_id varchar NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      tos_version varchar NOT NULL,
      privacy_version varchar NOT NULL,
      accepted_at timestamptz NOT NULL DEFAULT now(),
      ip_address text,
      user_agent text
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_tos_acceptances_user
    ON app_user_tos_acceptances(app_user_id, accepted_at DESC)
  `);
  // DB-level idempotency: a duplicate acceptance on the same versions is a
  // no-op via ON CONFLICT DO NOTHING in the route handler. Without this
  // unique index, a SELECT-then-INSERT race could store duplicate rows.
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_tos_acceptances_user_versions
    ON app_user_tos_acceptances(app_user_id, tos_version, privacy_version)
  `);

  // 1.7 / G6 — Auth event log for app_users (login / logout / heartbeat /
  // token refresh). Kept separate from `audit_logs` because that table's
  // `user_id` is uuid and FKs to enterprise users; app_users uses varchar.
  await query(`
    CREATE TABLE IF NOT EXISTS app_user_auth_events (
      id serial PRIMARY KEY,
      app_user_id varchar REFERENCES app_users(id) ON DELETE SET NULL,
      event_type varchar NOT NULL,
      device_id varchar,
      device_platform varchar,
      app_version varchar,
      ip_address text,
      user_agent text,
      occurred_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_app_user_auth_events_user_time
    ON app_user_auth_events(app_user_id, occurred_at DESC)
  `);

  // G12 / 2.9 — Wearable sync error log. Surfaces silent SDK failures
  // (Garmin/Fitbit/HealthKit) to the admin dashboard.
  await query(`
    CREATE TABLE IF NOT EXISTS wearable_sync_errors (
      id serial PRIMARY KEY,
      app_user_id varchar REFERENCES app_users(id) ON DELETE SET NULL,
      device_source varchar NOT NULL,
      error_code varchar,
      error_message text NOT NULL,
      payload_excerpt text,
      occurred_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_wearable_sync_errors_user_time
    ON wearable_sync_errors(app_user_id, occurred_at DESC)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_wearable_sync_errors_device
    ON wearable_sync_errors(device_source, occurred_at DESC)
  `);

  // 2.8 / 4.3 — AI outcome feedback. Each row links one AI recommendation
  // to the user's downstream biometric delta so the model can learn what
  // actually moves resilience for THIS user.
  await query(`
    CREATE TABLE IF NOT EXISTS ai_outcome_feedback (
      id serial PRIMARY KEY,
      app_user_id varchar NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      personalization_id integer REFERENCES app_user_ai_personalization(id) ON DELETE SET NULL,
      action_taken varchar NOT NULL,
      pre_score double precision,
      post_score double precision,
      score_delta double precision,
      observed_window_hours integer,
      model_version varchar,
      recorded_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_ai_outcome_feedback_user_time
    ON ai_outcome_feedback(app_user_id, recorded_at DESC)
  `);

  // ---- Build #8 (April 30, 2026) — Enterprise profile fields ----
  // Additive ALTERs only. Existing columns (`name`, `onboarding_complete`,
  // `wearable_connected`) are preserved; new explicit status columns are added
  // alongside per the Build #8 spec so downstream consumers can query state
  // without inferring it from booleans. All defaults are safe — pre-existing
  // rows are unaffected.
  await query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS display_name varchar`);
  await query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS auth_provider varchar NOT NULL DEFAULT 'local'`);
  await query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS onboarding_status varchar NOT NULL DEFAULT 'pending'`);
  await query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS baseline_status varchar NOT NULL DEFAULT 'pending'`);
  await query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS health_consent_status varchar NOT NULL DEFAULT 'not_granted'`);
  await query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS watch_connected_status varchar NOT NULL DEFAULT 'not_connected'`);
  await query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`);

  // ---- Build #14 (May 27, 2026) — Copenhagen Burnout Inventory (CBI) ----
  // Validation harness for the Triple-Weight Algorithm. CBI Personal Burnout
  // subscale (Kristensen et al. 2005, Creative Commons): 6 items, each
  // 0/25/50/75/100, total = mean (0-100, higher = more burnout). Stored
  // alongside the algorithm's burnout-risk score at the time of completion
  // so we can compute a Pearson correlation per-user and population-wide.
  // This is the ground-truth dataset that converts "wellness app heuristic"
  // into "instrument-correlated screening tool." DO NOT remove columns.
  await query(`
    CREATE TABLE IF NOT EXISTS cbi_responses (
      id serial PRIMARY KEY,
      app_user_id varchar NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      q1 integer NOT NULL CHECK (q1 IN (0,25,50,75,100)),
      q2 integer NOT NULL CHECK (q2 IN (0,25,50,75,100)),
      q3 integer NOT NULL CHECK (q3 IN (0,25,50,75,100)),
      q4 integer NOT NULL CHECK (q4 IN (0,25,50,75,100)),
      q5 integer NOT NULL CHECK (q5 IN (0,25,50,75,100)),
      q6 integer NOT NULL CHECK (q6 IN (0,25,50,75,100)),
      total_score numeric(5,2) NOT NULL,
      subscale varchar NOT NULL DEFAULT 'personal_burnout',
      algorithm_risk_at_time numeric(5,2),
      engine_version varchar,
      taken_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_cbi_responses_user_time
    ON cbi_responses(app_user_id, taken_at DESC)
  `);
}
