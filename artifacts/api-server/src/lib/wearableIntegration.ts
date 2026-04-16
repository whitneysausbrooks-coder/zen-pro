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
  hrv_component: number;
  sleep_component: number;
  activity_component: number;
  sleep_floor_applied: boolean;
  sleep_floor_penalty: number;
  strain_recovery_state: "growth" | "functional_overreach" | "burnout_risk" | "recovery" | "neutral";
  strain_modifier: number;
  weights: { hrv: number; sleep: number; activity: number };
  raw_score: number;
}

export interface NeuroResilienceResult {
  neuro_resilience_score: number;
  breakdown: NeuroResilienceBreakdown;
  classification: "critical" | "low" | "moderate" | "good" | "excellent";
  recommendations: string[];
  ema_applied: boolean;
  ema_window: number;
}

const WEIGHTS = { hrv: 0.50, sleep: 0.35, activity: 0.15 };

const EMA_ALPHA = 2 / (7 + 1);

function normalizeHRV(rmssd: number): number {
  if (rmssd <= 0) return 0;
  const lnRmssd = Math.log(rmssd);
  const minLn = Math.log(5);
  const maxLn = Math.log(150);
  const normalized = ((lnRmssd - minLn) / (maxLn - minLn)) * 100;
  return Math.max(0, Math.min(100, normalized));
}

function normalizeSleep(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes < 180) return (minutes / 180) * 10;
  if (minutes < 300) return 10 + ((minutes - 180) / 120) * 20;
  if (minutes < 360) return 30 + ((minutes - 300) / 60) * 15;
  if (minutes < 420) return 45 + ((minutes - 360) / 60) * 20;
  if (minutes < 480) return 65 + ((minutes - 420) / 60) * 20;
  if (minutes < 540) return 85 + ((minutes - 480) / 60) * 15;
  if (minutes <= 600) return 95 + ((minutes - 540) / 60) * 5;
  return Math.max(70, 100 - ((minutes - 600) / 60) * 10);
}

function normalizeSteps(steps: number): number {
  if (steps <= 0) return 0;
  if (steps < 2000) return (steps / 2000) * 15;
  if (steps < 5000) return 15 + ((steps - 2000) / 3000) * 25;
  if (steps < 7500) return 40 + ((steps - 5000) / 2500) * 20;
  if (steps < 10000) return 60 + ((steps - 7500) / 2500) * 15;
  if (steps < 12500) return 75 + ((steps - 10000) / 2500) * 10;
  if (steps < 15000) return 85 + ((steps - 12500) / 2500) * 8;
  if (steps < 20000) return 93 + ((steps - 15000) / 5000) * 5;
  return 98;
}

function computeSleepFloorPenalty(sleepComponent: number): { penalty: number; applied: boolean } {
  const SLEEP_FLOOR_THRESHOLD = 35;
  if (sleepComponent >= SLEEP_FLOOR_THRESHOLD) return { penalty: 0, applied: false };
  const severity = (SLEEP_FLOOR_THRESHOLD - sleepComponent) / SLEEP_FLOOR_THRESHOLD;
  const penalty = severity * 25;
  return { penalty, applied: true };
}

function computeStrainRecoveryInteraction(
  hrvComponent: number,
  sleepComponent: number,
  activityComponent: number
): { state: NeuroResilienceBreakdown["strain_recovery_state"]; modifier: number } {
  const recoveryIndex = (hrvComponent * 0.6 + sleepComponent * 0.4);
  const strainLevel = activityComponent;

  if (strainLevel > 70 && recoveryIndex > 65) {
    return { state: "growth", modifier: 5 };
  }
  if (strainLevel > 70 && recoveryIndex >= 40 && recoveryIndex <= 65) {
    return { state: "functional_overreach", modifier: -3 };
  }
  if (strainLevel > 70 && recoveryIndex < 40) {
    return { state: "burnout_risk", modifier: -12 };
  }
  if (strainLevel < 30 && recoveryIndex > 65) {
    return { state: "recovery", modifier: 2 };
  }
  return { state: "neutral", modifier: 0 };
}

export function computeNeuroResilienceScore(
  hrv: number,
  sleepMinutes: number,
  steps: number,
  historicalScores?: number[]
): NeuroResilienceResult {
  const hrvComponent = normalizeHRV(hrv);
  const sleepComponent = normalizeSleep(sleepMinutes);
  const activityComponent = normalizeSteps(steps);

  let weightedScore =
    WEIGHTS.hrv * hrvComponent +
    WEIGHTS.sleep * sleepComponent +
    WEIGHTS.activity * activityComponent;

  const sleepFloor = computeSleepFloorPenalty(sleepComponent);
  weightedScore -= sleepFloor.penalty;

  const strainRecovery = computeStrainRecoveryInteraction(hrvComponent, sleepComponent, activityComponent);
  weightedScore += strainRecovery.modifier;

  const rawScore = Math.max(0, Math.min(100, weightedScore));

  let finalScore = rawScore;
  let emaApplied = false;

  if (historicalScores && historicalScores.length > 0) {
    let ema = historicalScores[0];
    for (let i = 1; i < historicalScores.length; i++) {
      ema = EMA_ALPHA * historicalScores[i] + (1 - EMA_ALPHA) * ema;
    }
    finalScore = EMA_ALPHA * rawScore + (1 - EMA_ALPHA) * ema;
    finalScore = Math.max(0, Math.min(100, finalScore));
    emaApplied = true;
  }

  const neuro_resilience_score = Math.round(finalScore);

  let classification: NeuroResilienceResult["classification"];
  if (neuro_resilience_score < 20) classification = "critical";
  else if (neuro_resilience_score < 40) classification = "low";
  else if (neuro_resilience_score < 60) classification = "moderate";
  else if (neuro_resilience_score < 80) classification = "good";
  else classification = "excellent";

  const recommendations: string[] = [];

  if (strainRecovery.state === "burnout_risk") {
    recommendations.push("ALERT: High strain with low recovery detected — reduce intensity and prioritize rest. This pattern precedes burnout.");
  }
  if (strainRecovery.state === "functional_overreach") {
    recommendations.push("Caution: Activity levels are high relative to recovery. Monitor closely — schedule a rest day.");
  }
  if (sleepFloor.applied) {
    recommendations.push("Sleep floor breach: insufficient sleep is capping your resilience. No amount of high HRV can compensate long-term. Prioritize 7-9 hours.");
  }
  if (hrvComponent < 30) {
    recommendations.push("HRV indicates sympathetic dominance (Fight-or-Flight). Try box breathing (4-4-4-4) or a 10-minute body scan meditation.");
  } else if (hrvComponent < 50) {
    recommendations.push("HRV is below optimal — your autonomic nervous system shows moderate stress. Consider reducing caffeine and screen time before bed.");
  }
  if (sleepComponent < 40 && !sleepFloor.applied) {
    recommendations.push("Sleep quality is low — focus on deep and REM sleep by maintaining consistent sleep/wake times.");
  }
  if (strainRecovery.state === "growth") {
    recommendations.push("Excellent: High activity with strong recovery — your body is adapting positively. You're in a growth state.");
  }
  if (strainRecovery.state === "recovery") {
    recommendations.push("Recovery day detected: HRV and sleep are strong while activity is low. Good time for gentle movement or stretching.");
  }
  if (recommendations.length === 0) {
    recommendations.push("Your neuro-resilience is on track. Maintain your current balance of activity and recovery.");
  }

  return {
    neuro_resilience_score,
    breakdown: {
      hrv_component: Math.round(hrvComponent * 10) / 10,
      sleep_component: Math.round(sleepComponent * 10) / 10,
      activity_component: Math.round(activityComponent * 10) / 10,
      sleep_floor_applied: sleepFloor.applied,
      sleep_floor_penalty: Math.round(sleepFloor.penalty * 10) / 10,
      strain_recovery_state: strainRecovery.state,
      strain_modifier: strainRecovery.modifier,
      weights: WEIGHTS,
      raw_score: Math.round(rawScore * 10) / 10,
    },
    classification,
    recommendations,
    ema_applied: emaApplied,
    ema_window: 7,
  };
}

export async function ingestWearableData(data: WearableData): Promise<{
  id: string;
  neuro_resilience: NeuroResilienceResult;
}> {
  const historyResult = await query(
    `SELECT neuro_resilience_score FROM wearable_data
     WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 6`,
    [data.user_id]
  );
  const historicalScores = historyResult.rows
    .map((r: any) => parseInt(r.neuro_resilience_score))
    .reverse();

  const resilience = computeNeuroResilienceScore(
    data.hrv,
    data.sleep_duration,
    data.steps,
    historicalScores.length > 0 ? historicalScores : undefined
  );

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
    strain_recovery_state: resilience.breakdown.strain_recovery_state,
    sleep_floor_applied: resilience.breakdown.sleep_floor_applied,
    ema_applied: resilience.ema_applied,
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
  ema_score: number | null;
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

  let ema_score: number | null = null;
  if (data_points >= 2) {
    let ema = daily_scores[0].score;
    for (let i = 1; i < data_points; i++) {
      ema = EMA_ALPHA * daily_scores[i].score + (1 - EMA_ALPHA) * ema;
    }
    ema_score = Math.round(ema * 10) / 10;
  }

  let trend_direction: "improving" | "declining" | "stable" = "stable";
  if (data_points >= 4) {
    const halfIdx = Math.floor(data_points / 2);
    const recent = daily_scores.slice(halfIdx).reduce((s, d) => s + d.score, 0) / (data_points - halfIdx);
    const earlier = daily_scores.slice(0, halfIdx).reduce((s, d) => s + d.score, 0) / halfIdx;
    if (recent - earlier > 5) trend_direction = "improving";
    else if (earlier - recent > 5) trend_direction = "declining";
  }

  return { avg_score, trend_direction, data_points, daily_scores, ema_score };
}
