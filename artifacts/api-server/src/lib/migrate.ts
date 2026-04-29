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
}
