export function normalize(value: number, min: number, max: number): number {
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

export function calculateNSB(hrv: number, restingHR: number): number {
  const hrvScore = normalize(hrv, 20, 120);
  const hrPenalty = normalize(80 - restingHR, 0, 40);
  return Math.round((hrvScore * 0.7 + hrPenalty * 0.3) * 100) / 100;
}

export function calculateERI(mood: number, engagement: number): number {
  const clamped_mood = Math.max(1, Math.min(10, mood));
  const clamped_engagement = Math.max(0, Math.min(100, engagement));
  return Math.round((clamped_mood * 10 * 0.6 + clamped_engagement * 0.4) * 100) / 100;
}

export function calculateCPS(sleepHours: number, sleepScore: number): number {
  const clamped_score = Math.max(0, Math.min(100, sleepScore));
  return Math.round((normalize(sleepHours, 4, 9) * 0.5 + clamped_score * 0.5) * 100) / 100;
}

export function calculateWRI(
  eri: number,
  cps: number,
  nsb: number,
  cohesion: number
): number {
  const base = Math.cbrt(eri * cps * nsb);
  const adjusted = base * (1 + 0.2 * (cohesion / 100));
  return Math.round(Math.min(100, Math.max(0, adjusted)) * 100) / 100;
}

export function calculateBurnoutRisk(
  wri: number,
  nsb: number,
  sleepHours: number
): number {
  let risk = 100 - wri;
  if (nsb < 40) risk += 10;
  if (sleepHours < 5) risk += 10;
  return Math.round(Math.min(100, Math.max(0, risk)) * 100) / 100;
}

export function detectBurnoutTrend(scores: number[]): boolean {
  if (scores.length < 3) return false;
  const recent = scores.slice(-3);
  return recent[0] > recent[1] && recent[1] > recent[2];
}

export interface ResilienceResult {
  eri: number;
  cps: number;
  nsb: number;
  cohesion: number;
  wri: number;
  burnoutRisk: number;
}

export function calculateFullResilience(
  hrv: number,
  restingHR: number,
  mood: number,
  engagement: number,
  sleepHours: number,
  sleepScore: number,
  cohesion: number
): ResilienceResult {
  const nsb = calculateNSB(hrv, restingHR);
  const eri = calculateERI(mood, engagement);
  const cps = calculateCPS(sleepHours, sleepScore);
  const wri = calculateWRI(eri, cps, nsb, cohesion);
  const burnoutRisk = calculateBurnoutRisk(wri, nsb, sleepHours);
  return { eri, cps, nsb, cohesion, wri, burnoutRisk };
}

export function runResetProtocol(): {
  type: string;
  duration: number;
  reward: number;
} {
  return {
    type: "breathing",
    duration: 120,
    reward: 10,
  };
}
