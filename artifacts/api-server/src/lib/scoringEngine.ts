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

export interface BurnoutAnalysis {
  risk: number;
  trendDown: boolean;
  anomaly: boolean;
  severity: "low" | "moderate" | "high" | "critical";
  alert: string | null;
}

export function analyzeBurnout(wriHistory: number[]): BurnoutAnalysis {
  if (wriHistory.length === 0) {
    return { risk: 0, trendDown: false, anomaly: false, severity: "low", alert: null };
  }

  const latest = wriHistory[wriHistory.length - 1];
  let risk = 100 - latest;

  const trendDown =
    wriHistory.length >= 3 &&
    wriHistory.slice(-3).every((v, i, arr) => i === 0 || v < arr[i - 1]);
  if (trendDown) risk += 15;

  let anomaly = false;
  if (wriHistory.length >= 5) {
    const baseline = wriHistory.slice(0, -1);
    const avg = baseline.reduce((a, b) => a + b, 0) / baseline.length;
    const stdDev = Math.sqrt(baseline.reduce((sum, v) => sum + (v - avg) ** 2, 0) / baseline.length);
    if (stdDev > 0 && latest < avg - 2 * stdDev) {
      anomaly = true;
      risk += 10;
    }
  }

  risk = Math.min(100, Math.max(0, Math.round(risk * 100) / 100));

  const severity: BurnoutAnalysis["severity"] =
    risk > 80 ? "critical" : risk > 60 ? "high" : risk > 35 ? "moderate" : "low";

  let alert: string | null = null;
  if (severity === "critical") {
    alert = "Critical burnout risk. Immediate wellness intervention recommended.";
  } else if (severity === "high") {
    alert = "High burnout risk. Schedule recovery time and monitor closely.";
  } else if (trendDown) {
    alert = "Downward trend detected over 3+ data points. Consider proactive support.";
  }

  return { risk, trendDown, anomaly, severity, alert };
}

export function calculateCohesionDelta(currentCohesion: number, previousCohesion: number): number {
  if (previousCohesion === 0) return 0;
  return Math.round(((currentCohesion - previousCohesion) / previousCohesion) * 100 * 10) / 10;
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
