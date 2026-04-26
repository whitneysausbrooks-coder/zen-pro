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
}
