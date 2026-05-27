import { Router, type IRouter } from "express";
import { z } from "zod";
import { query } from "../lib/db";
import { ENGINE_VERSION } from "../lib/scoringEngine";

const router: IRouter = Router();

const cbiItem = z.union([
  z.literal(0),
  z.literal(25),
  z.literal(50),
  z.literal(75),
  z.literal(100),
]);

const submitSchema = z.object({
  user_id: z.string().min(1),
  q1: cbiItem,
  q2: cbiItem,
  q3: cbiItem,
  q4: cbiItem,
  q5: cbiItem,
  q6: cbiItem,
});

router.post("/cbi/responses", async (req, res) => {
  const parse = submitSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid CBI submission", issues: parse.error.issues });
  }

  const { user_id, q1, q2, q3, q4, q5, q6 } = parse.data;
  const total = Math.round(((q1 + q2 + q3 + q4 + q5 + q6) / 6) * 100) / 100;

  const userCheck = await query<{ id: string }>(`SELECT id FROM app_users WHERE id = $1`, [user_id]);
  if (userCheck.rows.length === 0) {
    return res.status(404).json({ error: "User not found" });
  }

  // Capture the algorithm's burnout-risk reading at the time the CBI is
  // submitted so we can correlate algo-vs-instrument per-user and at the
  // population level. We use (100 - neuro_resilience_score) as the burnout
  // risk proxy because high resilience = low burnout. CBI and burnout risk
  // should correlate POSITIVELY (high CBI = high burnout = high algo risk).
  let algorithmRiskAtTime: number | null = null;
  try {
    const recent = await query<{ neuro_resilience_score: number | null }>(
      `SELECT neuro_resilience_score
       FROM app_user_biometrics
       WHERE app_user_id = $1 AND neuro_resilience_score IS NOT NULL
       ORDER BY recorded_at DESC
       LIMIT 1`,
      [user_id],
    );
    if (recent.rows.length > 0 && recent.rows[0].neuro_resilience_score != null) {
      const nrs = Number(recent.rows[0].neuro_resilience_score);
      algorithmRiskAtTime = Math.round((100 - nrs) * 100) / 100;
    }
  } catch {
    // Silent — biometrics table missing on a partial deploy just means
    // this row's correlation field stays null.
  }

  const inserted = await query<{ id: number; taken_at: string }>(
    `INSERT INTO cbi_responses
       (app_user_id, q1, q2, q3, q4, q5, q6, total_score, subscale,
        algorithm_risk_at_time, engine_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'personal_burnout', $9, $10)
     RETURNING id, taken_at`,
    [user_id, q1, q2, q3, q4, q5, q6, total, algorithmRiskAtTime, ENGINE_VERSION],
  );

  const cbiSeverity =
    total >= 75 ? "severe" : total >= 50 ? "moderate" : total >= 25 ? "mild" : "low";

  return res.json({
    id: inserted.rows[0].id,
    total_score: total,
    severity: cbiSeverity,
    algorithm_risk_at_time: algorithmRiskAtTime,
    taken_at: inserted.rows[0].taken_at,
    interpretation: cbiInterpretation(total),
  });
});

function cbiInterpretation(score: number): string {
  if (score >= 75) {
    return "Severe burnout symptoms. Consider speaking with a healthcare provider.";
  }
  if (score >= 50) {
    return "Moderate burnout symptoms. Prioritize recovery and reduce stressors where possible.";
  }
  if (score >= 25) {
    return "Mild burnout symptoms. Watch for trends — repeat in 2 weeks.";
  }
  return "Low burnout symptoms. Maintain current recovery practices.";
}

router.get("/cbi/:userId/history", async (req, res) => {
  const userId = req.params.userId;
  const rows = await query<{
    id: number;
    total_score: number;
    algorithm_risk_at_time: number | null;
    taken_at: string;
  }>(
    `SELECT id, total_score, algorithm_risk_at_time, taken_at
     FROM cbi_responses
     WHERE app_user_id = $1
     ORDER BY taken_at DESC
     LIMIT 50`,
    [userId],
  );
  return res.json({ responses: rows.rows });
});

router.get("/cbi/:userId/correlation", async (req, res) => {
  const userId = req.params.userId;
  const rows = await query<{ total_score: number; algorithm_risk_at_time: number | null }>(
    `SELECT total_score, algorithm_risk_at_time
     FROM cbi_responses
     WHERE app_user_id = $1
       AND algorithm_risk_at_time IS NOT NULL`,
    [userId],
  );

  const pairs = rows.rows
    .map((r) => ({ cbi: Number(r.total_score), algo: Number(r.algorithm_risk_at_time) }))
    .filter((p) => Number.isFinite(p.cbi) && Number.isFinite(p.algo));

  if (pairs.length < 3) {
    return res.json({
      n: pairs.length,
      pearson_r: null,
      interpretation: "Insufficient paired observations (need 3+).",
    });
  }

  const n = pairs.length;
  const meanX = pairs.reduce((s, p) => s + p.cbi, 0) / n;
  const meanY = pairs.reduce((s, p) => s + p.algo, 0) / n;
  let num = 0,
    denX = 0,
    denY = 0;
  for (const p of pairs) {
    const dx = p.cbi - meanX;
    const dy = p.algo - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const r = denX > 0 && denY > 0 ? num / Math.sqrt(denX * denY) : 0;
  const rRounded = Math.round(r * 1000) / 1000;

  let interp: string;
  const absR = Math.abs(rRounded);
  if (n < 10) interp = `Provisional (n=${n}, need 10+ for stable estimate).`;
  else if (absR >= 0.7) interp = "Strong correlation between algorithm and CBI.";
  else if (absR >= 0.5) interp = "Moderate correlation between algorithm and CBI.";
  else if (absR >= 0.3) interp = "Weak correlation between algorithm and CBI.";
  else interp = "No meaningful correlation — algorithm needs recalibration.";

  return res.json({ n, pearson_r: rRounded, interpretation: interp });
});

router.get("/cbi/population/correlation", async (_req, res) => {
  const rows = await query<{ total_score: number; algorithm_risk_at_time: number | null }>(
    `SELECT total_score, algorithm_risk_at_time
     FROM cbi_responses
     WHERE algorithm_risk_at_time IS NOT NULL`,
  );

  const pairs = rows.rows
    .map((r) => ({ cbi: Number(r.total_score), algo: Number(r.algorithm_risk_at_time) }))
    .filter((p) => Number.isFinite(p.cbi) && Number.isFinite(p.algo));

  if (pairs.length < 10) {
    return res.json({
      n: pairs.length,
      pearson_r: null,
      interpretation: `Population dataset still small (n=${pairs.length}). Validation report unlocks at n≥10.`,
    });
  }

  const n = pairs.length;
  const meanX = pairs.reduce((s, p) => s + p.cbi, 0) / n;
  const meanY = pairs.reduce((s, p) => s + p.algo, 0) / n;
  let num = 0,
    denX = 0,
    denY = 0;
  for (const p of pairs) {
    const dx = p.cbi - meanX;
    const dy = p.algo - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const r = denX > 0 && denY > 0 ? num / Math.sqrt(denX * denY) : 0;
  const rRounded = Math.round(r * 1000) / 1000;

  const absR = Math.abs(rRounded);
  let interp: string;
  if (absR >= 0.7) interp = `Strong population correlation (r=${rRounded}, n=${n}).`;
  else if (absR >= 0.5) interp = `Moderate population correlation (r=${rRounded}, n=${n}).`;
  else if (absR >= 0.3) interp = `Weak population correlation (r=${rRounded}, n=${n}).`;
  else interp = `No meaningful population correlation (r=${rRounded}, n=${n}). Algorithm needs recalibration.`;

  return res.json({ n, pearson_r: rRounded, interpretation: interp });
});

export default router;
