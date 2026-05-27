export const ENGINE_VERSION = "2.1.0";

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

export interface PersonalBaseline {
  avg_wri: number;
  avg_nsb: number;
  avg_hrv: number;
  avg_sleep_hours: number;
  avg_sleep_score: number;
  data_points: number;
  established: boolean;
}

export function computeBaseline(
  wriHistory: number[],
  nsbHistory: number[],
  hrvHistory: number[],
  sleepHoursHistory: number[],
  sleepScoreHistory: number[]
): PersonalBaseline {
  const minPoints = 14;
  const dp = wriHistory.length;
  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  return {
    avg_wri: Math.round(avg(wriHistory) * 100) / 100,
    avg_nsb: Math.round(avg(nsbHistory) * 100) / 100,
    avg_hrv: Math.round(avg(hrvHistory) * 100) / 100,
    avg_sleep_hours: Math.round(avg(sleepHoursHistory) * 100) / 100,
    avg_sleep_score: Math.round(avg(sleepScoreHistory) * 100) / 100,
    data_points: dp,
    established: dp >= minPoints,
  };
}

export function linearRegression(values: number[]): { slope: number; intercept: number; r2: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] || 0, r2: 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
    sumY2 += values[i] * values[i];
  }

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  const ssTot = sumY2 - (sumY * sumY) / n;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * i;
    ssRes += (values[i] - predicted) ** 2;
  }
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  return {
    slope: Math.round(slope * 1000) / 1000,
    intercept: Math.round(intercept * 100) / 100,
    r2: Math.round(r2 * 1000) / 1000,
  };
}

export function projectValue(reg: { slope: number; intercept: number }, currentIndex: number, daysAhead: number): number {
  return Math.min(100, Math.max(0, Math.round((reg.intercept + reg.slope * (currentIndex + daysAhead)) * 100) / 100));
}

export interface BurnoutReason {
  factor: string;
  contribution: number;
  detail: string;
}

export interface BurnoutAnalysisV2 {
  risk: number;
  reasons: BurnoutReason[];
  severity: "low" | "moderate" | "high" | "critical";
  alert: string | null;
  projected_7d: number | null;
  projected_30d: number | null;
  trend_direction: "improving" | "stable" | "declining" | "critical_decline";
  engine_version: string;
  baseline_comparison: {
    wri_vs_baseline: number | null;
    hrv_vs_baseline: number | null;
    sleep_vs_baseline: number | null;
  } | null;
  // Build #14 — Data-quality disclosure so consumers (UI + clinicians)
  // can see HOW SURE the algorithm is, not just what it says. A "low"
  // confidence reading should be presented to the user as provisional
  // — we are not yet entitled to make a strong claim.
  data_quality?: {
    baseline_established: boolean;
    days_of_history: number;
    confidence: "low" | "moderate" | "high";
    notes: string[];
  };
}

export interface AnalyzeParams {
  wriHistory: number[];
  currentNSB?: number;
  currentHRV?: number;
  previousHRV?: number;
  currentSleepHours?: number;
  baseline?: PersonalBaseline | null;
}

export function analyzeBurnoutV2(params: AnalyzeParams): BurnoutAnalysisV2 {
  const {
    wriHistory,
    currentNSB,
    currentHRV,
    previousHRV,
    currentSleepHours,
    baseline,
  } = params;

  if (wriHistory.length === 0) {
    return {
      risk: 0,
      reasons: [],
      severity: "low",
      alert: null,
      projected_7d: null,
      projected_30d: null,
      trend_direction: "stable",
      engine_version: ENGINE_VERSION,
      baseline_comparison: null,
    };
  }

  const latest = wriHistory[wriHistory.length - 1];
  let risk = 100 - latest;
  const reasons: BurnoutReason[] = [];

  reasons.push({
    factor: "Base WRI inverse",
    contribution: Math.round(risk * 100) / 100,
    detail: `Current WRI ${latest.toFixed(1)} → base risk ${risk.toFixed(1)}%`,
  });

  const trendDown =
    wriHistory.length >= 3 &&
    wriHistory.slice(-3).every((v, i, arr) => i === 0 || v < arr[i - 1]);
  if (trendDown) {
    risk += 15;
    const drop = wriHistory[wriHistory.length - 3] - latest;
    reasons.push({
      factor: "3-day downward trend",
      contribution: 15,
      detail: `WRI declined ${drop.toFixed(1)} points over 3 consecutive days`,
    });
  }

  let anomaly = false;
  if (wriHistory.length >= 5) {
    const baselineArr = wriHistory.slice(0, -1);
    const avg = baselineArr.reduce((a, b) => a + b, 0) / baselineArr.length;
    const stdDev = Math.sqrt(baselineArr.reduce((sum, v) => sum + (v - avg) ** 2, 0) / baselineArr.length);
    if (stdDev > 0 && latest < avg - 2 * stdDev) {
      anomaly = true;
      risk += 10;
      reasons.push({
        factor: "Statistical anomaly (2σ)",
        contribution: 10,
        detail: `WRI ${latest.toFixed(1)} is >2 standard deviations below recent average ${avg.toFixed(1)}`,
      });
    }
  }

  if (baseline && baseline.established) {
    const wriDev = ((latest - baseline.avg_wri) / baseline.avg_wri) * 100;
    if (wriDev < -15) {
      const contrib = Math.min(15, Math.round(Math.abs(wriDev) / 2));
      risk += contrib;
      reasons.push({
        factor: "Personal baseline deviation",
        contribution: contrib,
        detail: `WRI ${wriDev.toFixed(1)}% below your personal baseline (${baseline.avg_wri.toFixed(1)})`,
      });
    }
  }

  if (currentHRV !== undefined && currentHRV > 0) {
    const hasEstablishedBaseline =
      baseline !== undefined && baseline !== null && baseline.established && baseline.avg_hrv > 0;

    // Build #14 — Baseline-relative HRV is the PRIMARY signal once a
    // 14-day personal baseline is established. Absolute thresholds
    // (<30ms / <50ms) are deliberately downgraded when baseline is
    // available because absolute HRV is age- and sex-dependent: a
    // healthy 58-year-old or female user can have resting HRV
    // legitimately in the 25-40ms range. Flagging them as "critical"
    // on absolute thresholds is a false positive. Personal-baseline
    // deviation captures the meaningful signal ("this user is X%
    // below where THEY normally are") without that demographic
    // false-flagging.
    if (hasEstablishedBaseline) {
      const hrvBaselineDev = ((currentHRV - baseline.avg_hrv) / baseline.avg_hrv) * 100;
      if (hrvBaselineDev < -20) {
        const contrib = Math.min(20, Math.round(Math.abs(hrvBaselineDev) / 2));
        risk += contrib;
        reasons.push({
          factor: "HRV below personal baseline",
          contribution: contrib,
          detail: `HRV ${hrvBaselineDev.toFixed(1)}% below your established baseline (${baseline.avg_hrv.toFixed(0)}ms)`,
        });
      }
    } else {
      // No baseline yet — fall back to provisional absolute thresholds.
      // Halved relative to v2.0.0 because they are known to over-flag
      // older and female users. Marked "(provisional)" so UI can show
      // a softer treatment until the baseline establishes.
      if (currentHRV < 30) {
        risk += 10;
        reasons.push({
          factor: "Very low HRV (provisional)",
          contribution: 10,
          detail: `HRV ${currentHRV}ms is low — provisional reading, refine once 14-day baseline establishes`,
        });
      } else if (currentHRV < 50) {
        risk += 5;
        reasons.push({
          factor: "Low HRV (provisional)",
          contribution: 5,
          detail: `HRV ${currentHRV}ms is reduced — provisional reading, refine once 14-day baseline establishes`,
        });
      }
    }

    // Sudden 24h drop is signal-agnostic to absolute level (any sharp
    // acute change indicates ANS shift) so it fires regardless of
    // baseline status.
    if (previousHRV !== undefined && previousHRV > 0) {
      const hrvDrop = ((previousHRV - currentHRV) / previousHRV) * 100;
      if (hrvDrop > 20) {
        const contrib = Math.min(15, Math.round(hrvDrop / 3));
        risk += contrib;
        reasons.push({
          factor: "Sudden HRV drop",
          contribution: contrib,
          detail: `HRV dropped ${hrvDrop.toFixed(1)}% in 24h (${previousHRV}ms → ${currentHRV}ms)`,
        });
      }
    }
  }

  if (currentNSB !== undefined && currentNSB < 40) {
    risk += 10;
    reasons.push({
      factor: "Low neuro-stress balance",
      contribution: 10,
      detail: `NSB score ${currentNSB.toFixed(1)} is below healthy threshold (40)`,
    });
  }

  if (currentSleepHours !== undefined && currentSleepHours < 5) {
    risk += 10;
    reasons.push({
      factor: "Critically low sleep",
      contribution: 10,
      detail: `${currentSleepHours.toFixed(1)}h sleep is well below recommended minimum (7h)`,
    });
  } else if (currentSleepHours !== undefined && currentSleepHours < 6) {
    risk += 5;
    reasons.push({
      factor: "Low sleep",
      contribution: 5,
      detail: `${currentSleepHours.toFixed(1)}h sleep is below recommended minimum (7h)`,
    });
  }

  if (currentSleepHours !== undefined && baseline && baseline.established && baseline.avg_sleep_hours > 0) {
    const sleepDev = ((currentSleepHours - baseline.avg_sleep_hours) / baseline.avg_sleep_hours) * 100;
    if (sleepDev < -20) {
      risk += 5;
      reasons.push({
        factor: "Sleep below personal baseline",
        contribution: 5,
        detail: `Sleep ${sleepDev.toFixed(1)}% below your baseline (${baseline.avg_sleep_hours.toFixed(1)}h)`,
      });
    }
  }

  risk = Math.min(100, Math.max(0, Math.round(risk * 100) / 100));

  reasons.sort((a, b) => b.contribution - a.contribution);

  let projected_7d: number | null = null;
  let projected_30d: number | null = null;
  let trend_direction: BurnoutAnalysisV2["trend_direction"] = "stable";

  if (wriHistory.length >= 3) {
    const riskHistory = wriHistory.map((w) => 100 - w);
    const reg = linearRegression(riskHistory);

    const lastIdx = riskHistory.length - 1;
    projected_7d = projectValue(reg, lastIdx, 7);
    projected_30d = projectValue(reg, lastIdx, 30);

    if (reg.slope > 2) {
      trend_direction = "critical_decline";
    } else if (reg.slope > 0.5) {
      trend_direction = "declining";
    } else if (reg.slope < -0.5) {
      trend_direction = "improving";
    }
  }

  const severity: BurnoutAnalysisV2["severity"] =
    risk > 80 ? "critical" : risk > 60 ? "high" : risk > 35 ? "moderate" : "low";

  let alert: string | null = null;
  if (severity === "critical") {
    alert = "Critical burnout risk detected. Immediate wellness intervention recommended.";
  } else if (severity === "high") {
    alert = "High burnout risk. Schedule recovery time and monitor closely.";
  } else if (trendDown && trend_direction === "critical_decline") {
    alert = "Accelerating decline detected. Proactive intervention strongly recommended.";
  } else if (trendDown) {
    alert = "Downward trend detected over 3+ data points. Consider proactive support.";
  }

  let baseline_comparison: BurnoutAnalysisV2["baseline_comparison"] = null;
  if (baseline && baseline.established) {
    baseline_comparison = {
      wri_vs_baseline: Math.round(((latest - baseline.avg_wri) / baseline.avg_wri) * 1000) / 10,
      hrv_vs_baseline: currentHRV !== undefined && baseline.avg_hrv > 0
        ? Math.round(((currentHRV - baseline.avg_hrv) / baseline.avg_hrv) * 1000) / 10
        : null,
      sleep_vs_baseline: currentSleepHours !== undefined && baseline.avg_sleep_hours > 0
        ? Math.round(((currentSleepHours - baseline.avg_sleep_hours) / baseline.avg_sleep_hours) * 1000) / 10
        : null,
    };
  }

  // Build #14 — Data-quality / confidence disclosure. The algorithm
  // should never claim more certainty than its inputs warrant. A user
  // with 3 days of history and no baseline gets "low" confidence even
  // if the score is dramatic. This field gives the UI a license to
  // soften wording ("possible early signal" vs "high risk detected").
  const dq_notes: string[] = [];
  const days = wriHistory.length;
  const baselineEstablished = !!(baseline && baseline.established);
  if (!baselineEstablished) {
    dq_notes.push(`Personal baseline not yet established (need 14+ days, have ${days})`);
  }
  if (days < 7) {
    dq_notes.push("Short observation window — trend detection is provisional");
  }
  if (currentHRV === undefined) dq_notes.push("No HRV signal in this reading");
  if (currentSleepHours === undefined) dq_notes.push("No sleep signal in this reading");

  let confidence: "low" | "moderate" | "high";
  if (baselineEstablished && days >= 21 && currentHRV !== undefined && currentSleepHours !== undefined) {
    confidence = "high";
  } else if (days >= 7 && (currentHRV !== undefined || currentSleepHours !== undefined)) {
    confidence = "moderate";
  } else {
    confidence = "low";
  }

  return {
    risk,
    reasons,
    severity,
    alert,
    projected_7d,
    projected_30d,
    trend_direction,
    engine_version: ENGINE_VERSION,
    baseline_comparison,
    data_quality: {
      baseline_established: baselineEstablished,
      days_of_history: days,
      confidence,
      notes: dq_notes,
    },
  };
}

export interface BurnoutAnalysis {
  risk: number;
  trendDown: boolean;
  anomaly: boolean;
  severity: "low" | "moderate" | "high" | "critical";
  alert: string | null;
}

export function analyzeBurnout(wriHistory: number[]): BurnoutAnalysis {
  const v2 = analyzeBurnoutV2({ wriHistory });
  return {
    risk: v2.risk,
    trendDown: v2.reasons.some((r) => r.factor.includes("trend")),
    anomaly: v2.reasons.some((r) => r.factor.includes("anomaly")),
    severity: v2.severity,
    alert: v2.alert,
  };
}

export function calculateCohesionDelta(currentCohesion: number, previousCohesion: number): number {
  if (previousCohesion === 0) return 0;
  return Math.round(((currentCohesion - previousCohesion) / previousCohesion) * 100 * 10) / 10;
}

export function calculateRetentionImpact(burnoutChange: number): number {
  return Math.round((burnoutChange / 10) * -4 * 10) / 10;
}

export interface OutcomeMetrics {
  burnout_change_30d: number | null;
  wri_change_30d: number | null;
  projected_retention_impact: number | null;
}

export function calculateOutcomes(
  recentAvgBurnout: number,
  historicAvgBurnout: number,
  recentAvgWri: number,
  historicAvgWri: number
): OutcomeMetrics {
  if (historicAvgBurnout === 0 && historicAvgWri === 0) {
    return { burnout_change_30d: null, wri_change_30d: null, projected_retention_impact: null };
  }

  const burnoutChange = historicAvgBurnout > 0
    ? Math.round(((recentAvgBurnout - historicAvgBurnout) / historicAvgBurnout) * 1000) / 10
    : null;

  const wriChange = historicAvgWri > 0
    ? Math.round(((recentAvgWri - historicAvgWri) / historicAvgWri) * 1000) / 10
    : null;

  const retentionImpact = burnoutChange !== null
    ? calculateRetentionImpact(burnoutChange)
    : null;

  return {
    burnout_change_30d: burnoutChange,
    wri_change_30d: wriChange,
    projected_retention_impact: retentionImpact,
  };
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
