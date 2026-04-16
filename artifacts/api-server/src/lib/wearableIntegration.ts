import { z } from "zod";
import { query, auditLog } from "./db";

export const wearableDataSchema = z.object({
  user_id: z.string().uuid(),
  hrv: z.number().min(0).max(300),
  sleep_duration: z.number().min(0).max(1440),
  steps: z.number().int().min(0).max(200000),
  source: z.enum(["apple_health", "google_fit", "fitbit", "garmin", "whoop", "oura", "manual"]).default("manual"),
  recorded_at: z.string().datetime().optional(),
});

export type WearableData = z.infer<typeof wearableDataSchema>;

export interface NeuroResilienceBreakdown {
  hrv_score: number;
  sleep_score: number;
  activity_score: number;
  weights: { hrv: number; sleep: number; activity: number };
}

export interface NeuroResilienceResult {
  neuro_resilience_score: number;
  breakdown: NeuroResilienceBreakdown;
  classification: "critical" | "low" | "moderate" | "good" | "excellent";
  recommendations: string[];
}

const WEIGHTS = { hrv: 0.45, sleep: 0.30, activity: 0.25 };

const HRV_BANDS = [
  { max: 20, score: 10 },
  { max: 30, score: 25 },
  { max: 40, score: 40 },
  { max: 50, score: 55 },
  { max: 60, score: 65 },
  { max: 70, score: 75 },
  { max: 85, score: 85 },
  { max: 100, score: 92 },
  { max: Infinity, score: 98 },
];

const SLEEP_BANDS = [
  { max: 180, score: 5 },
  { max: 300, score: 20 },
  { max: 360, score: 40 },
  { max: 420, score: 60 },
  { max: 480, score: 80 },
  { max: 540, score: 92 },
  { max: 600, score: 85 },
  { max: Infinity, score: 70 },
];

const STEPS_BANDS = [
  { max: 1000, score: 10 },
  { max: 3000, score: 25 },
  { max: 5000, score: 45 },
  { max: 7500, score: 65 },
  { max: 10000, score: 80 },
  { max: 12500, score: 90 },
  { max: 15000, score: 95 },
  { max: Infinity, score: 98 },
];

function bandScore(value: number, bands: { max: number; score: number }[]): number {
  for (const b of bands) {
    if (value <= b.max) return b.score;
  }
  return bands[bands.length - 1].score;
}

export function computeNeuroResilienceScore(hrv: number, sleepMinutes: number, steps: number): NeuroResilienceResult {
  const hrv_score = bandScore(hrv, HRV_BANDS);
  const sleep_score = bandScore(sleepMinutes, SLEEP_BANDS);
  const activity_score = bandScore(steps, STEPS_BANDS);

  const raw = WEIGHTS.hrv * hrv_score + WEIGHTS.sleep * sleep_score + WEIGHTS.activity * activity_score;
  const neuro_resilience_score = Math.round(Math.max(0, Math.min(100, raw)));

  let classification: NeuroResilienceResult["classification"];
  if (neuro_resilience_score < 20) classification = "critical";
  else if (neuro_resilience_score < 40) classification = "low";
  else if (neuro_resilience_score < 60) classification = "moderate";
  else if (neuro_resilience_score < 80) classification = "good";
  else classification = "excellent";

  const recommendations: string[] = [];
  if (hrv_score < 40) recommendations.push("HRV is low — try 4-7-8 breathing exercises or a guided meditation session.");
  if (sleep_score < 40) recommendations.push("Sleep duration is below optimal — aim for 7-9 hours and maintain a consistent bedtime.");
  if (activity_score < 40) recommendations.push("Step count is low — a 20-minute walk can significantly boost resilience.");
  if (hrv_score >= 80 && sleep_score >= 80 && activity_score >= 80) recommendations.push("All metrics are excellent — maintain your routine!");
  if (recommendations.length === 0) recommendations.push("Your resilience is on track. Keep it up!");

  return {
    neuro_resilience_score,
    breakdown: { hrv_score, sleep_score, activity_score, weights: WEIGHTS },
    classification,
    recommendations,
  };
}

export async function ingestWearableData(data: WearableData): Promise<{
  id: string;
  neuro_resilience: NeuroResilienceResult;
}> {
  const resilience = computeNeuroResilienceScore(data.hrv, data.sleep_duration, data.steps);

  const result = await query(
    `INSERT INTO wearable_data
       (user_id, hrv, sleep_duration_minutes, steps, source, neuro_resilience_score, recorded_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      data.user_id,
      data.hrv,
      data.sleep_duration,
      data.steps,
      data.source,
      resilience.neuro_resilience_score,
      data.recorded_at || new Date().toISOString(),
    ]
  );

  await auditLog(data.user_id, "wearable_data_ingested", "wearable_data", {
    source: data.source,
    neuro_resilience_score: resilience.neuro_resilience_score,
    classification: resilience.classification,
  });

  return { id: result.rows[0].id, neuro_resilience: resilience };
}

export async function getWearableHistory(userId: string, limit = 30): Promise<any[]> {
  const result = await query(
    `SELECT id, hrv, sleep_duration_minutes, steps, source,
            neuro_resilience_score, recorded_at, created_at
     FROM wearable_data
     WHERE user_id = $1
     ORDER BY recorded_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

export async function getWearableTrend(userId: string, days = 7): Promise<{
  avg_score: number;
  trend_direction: "improving" | "declining" | "stable";
  data_points: number;
  daily_scores: { date: string; score: number }[];
}> {
  const result = await query(
    `SELECT DATE(recorded_at) as day,
            ROUND(AVG(neuro_resilience_score)::numeric, 1) as avg_score,
            COUNT(*) as readings
     FROM wearable_data
     WHERE user_id = $1 AND recorded_at >= NOW() - ($2 || ' days')::INTERVAL
     GROUP BY DATE(recorded_at)
     ORDER BY day ASC`,
    [userId, days]
  );

  const daily_scores = result.rows.map((r: any) => ({
    date: r.day.toISOString().slice(0, 10),
    score: parseFloat(r.avg_score),
  }));

  const data_points = daily_scores.length;
  const avg_score = data_points > 0
    ? Math.round(daily_scores.reduce((s, d) => s + d.score, 0) / data_points * 10) / 10
    : 0;

  let trend_direction: "improving" | "declining" | "stable" = "stable";
  if (data_points >= 4) {
    const halfIdx = Math.floor(data_points / 2);
    const recent = daily_scores.slice(halfIdx).reduce((s, d) => s + d.score, 0) / (data_points - halfIdx);
    const earlier = daily_scores.slice(0, halfIdx).reduce((s, d) => s + d.score, 0) / halfIdx;
    if (recent - earlier > 5) trend_direction = "improving";
    else if (earlier - recent > 5) trend_direction = "declining";
  }

  return { avg_score, trend_direction, data_points, daily_scores };
}
