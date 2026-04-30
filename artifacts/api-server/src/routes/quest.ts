import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  userProfilesTable,
  activitiesTable,
  globalSettingsTable,
  taskCompletionsTable,
} from "@workspace/db/schema";
import {
  EarnEnergyBody,
  EarnCompassionBody,
  GetProfileResponse,
  GetActivitiesResponse,
} from "@workspace/api-zod";
import { eq, desc, and, gte, count, sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { randomUUID } from "crypto";
import { resolveClerkIdentity } from "../lib/clerkUser";

async function getRaidMultiplier(): Promise<number> {
  try {
    const rows = await db.select({ raid_mode_active: globalSettingsTable.raid_mode_active })
      .from(globalSettingsTable).limit(1);
    return rows[0]?.raid_mode_active ? 2 : 1;
  } catch {
    return 1;
  }
}

const router: IRouter = Router();

function getOrCreateSessionId(req: any, res: any): string {
  let sessionId = req.cookies?.["nq_session"];
  if (!sessionId) {
    sessionId = randomUUID();
    res.cookie("nq_session", sessionId, {
      httpOnly: true,
      maxAge: 365 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
    });
  }
  return sessionId;
}

function computeLevel(neuralEnergy: number, compassionPoints: number): { level: number; title: string } {
  const total = neuralEnergy + compassionPoints;
  if (total < 200) return { level: 1, title: "Seeker" };
  if (total < 500) return { level: 2, title: "Apprentice" };
  if (total < 1000) return { level: 3, title: "Adept" };
  if (total < 2000) return { level: 4, title: "Luminary" };
  if (total < 4000) return { level: 5, title: "Sage" };
  return { level: 6, title: "Zenith Master" };
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayUTC(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function computeStreakInfo(streakCount: number, lastGameDate: string | null) {
  const today = todayUTC();
  const yesterday = yesterdayUTC();
  // Determine if streak is still alive
  const isAlive = lastGameDate === today || lastGameDate === yesterday;
  const active = isAlive ? streakCount : 0;
  const multiplier = active > 0 ? Math.min(Math.pow(1.1, active), 2.0) : 1.0;
  return {
    streak_count: active,
    multiplier: Math.round(multiplier * 100) / 100,
    is_lucky_gold: active >= 1 && active < 3,
    is_electric_blue: active >= 3,
  };
}

async function getOrCreateProfile(sessionId: string) {
  const existing = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.session_id, sessionId))
    .limit(1);

  if (existing.length > 0) return existing[0];

  const [created] = await db
    .insert(userProfilesTable)
    .values({ session_id: sessionId })
    .returning();
  return created;
}

router.get("/profile", async (req, res) => {
  const sessionId = getOrCreateSessionId(req, res);
  const profile = await getOrCreateProfile(sessionId);
  res.json(GetProfileResponse.parse(profile));
});

router.get("/streak", async (req, res) => {
  const sessionId = req.cookies?.["nq_session"];
  if (!sessionId) {
    return void res.json({ streak_count: 0, multiplier: 1, is_lucky_gold: false, is_electric_blue: false });
  }
  const [profile] = await db
    .select({ streak_count: userProfilesTable.streak_count, last_game_date: userProfilesTable.last_game_date })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.session_id, sessionId))
    .limit(1);

  if (!profile) {
    return void res.json({ streak_count: 0, multiplier: 1, is_lucky_gold: false, is_electric_blue: false });
  }
  return void res.json(computeStreakInfo(profile.streak_count, profile.last_game_date));
});

// Called when a brain game is completed — awards energy and updates streak
router.post("/game-complete", async (req, res) => {
  const sessionId = getOrCreateSessionId(req, res);
  const profile = await getOrCreateProfile(sessionId);

  const today = todayUTC();
  const yesterday = yesterdayUTC();
  const lastDate = profile.last_game_date;

  const previousStreak = profile.streak_count;
  const previousLevel = profile.level;
  let newStreak: number;
  const alreadyPlayedToday = lastDate === today;
  const streakBroken = !alreadyPlayedToday && lastDate !== yesterday && previousStreak > 1;

  if (alreadyPlayedToday) {
    newStreak = profile.streak_count;
  } else if (lastDate === yesterday) {
    newStreak = profile.streak_count + 1;
  } else {
    newStreak = 1;
  }

  const energyReward = 50;
  const newEnergy = profile.neural_energy + energyReward;
  const { level, title } = computeLevel(newEnergy, profile.compassion_points);

  const [updated] = await db
    .update(userProfilesTable)
    .set({
      neural_energy: newEnergy,
      streak_count: newStreak,
      last_game_date: today,
      level,
      title,
      updated_at: new Date(),
    })
    .where(eq(userProfilesTable.session_id, sessionId))
    .returning();

  await db.insert(activitiesTable).values({
    session_id: sessionId,
    type: "neural_energy",
    activity: "Memory Match",
    amount: energyReward,
  });

  const streakInfo = computeStreakInfo(newStreak, today);
  const streakChanged = !alreadyPlayedToday;

  return void res.json({
    profile: GetProfileResponse.parse(updated),
    streak: streakInfo,
    streak_changed: streakChanged,
    streak_extended: !alreadyPlayedToday && lastDate === yesterday,
    streak_broken: streakBroken,
    previous_streak: previousStreak,
    level_changed: level !== previousLevel,
    new_level: level,
    new_title: title,
  });
});

router.post("/earn-energy", async (req, res): Promise<void> => {
  const sessionId = getOrCreateSessionId(req, res);
  const body = EarnEnergyBody.parse(req.body);

  if (DASHBOARD_TASK_LABELS.has(body.activity)) {
    res.status(400).json({ error: "Dashboard tasks must be completed through the reflection flow." });
    return;
  }

  const profile = await getOrCreateProfile(sessionId);
  const newEnergy = profile.neural_energy + body.amount;
  const { level, title } = computeLevel(newEnergy, profile.compassion_points);

  const [updated] = await db
    .update(userProfilesTable)
    .set({ neural_energy: newEnergy, level, title, updated_at: new Date() })
    .where(eq(userProfilesTable.session_id, sessionId))
    .returning();

  await db.insert(activitiesTable).values({
    session_id: sessionId,
    type: "neural_energy",
    activity: body.activity,
    amount: body.amount,
  });

  res.json(GetProfileResponse.parse(updated));
});

router.post("/earn-compassion", async (req, res) => {
  const sessionId = getOrCreateSessionId(req, res);
  const body = EarnCompassionBody.parse(req.body);

  if (DASHBOARD_TASK_LABELS.has(body.activity)) {
    return void res.status(400).json({ error: "Dashboard tasks must be completed through the reflection flow." });
  }

  const profile = await getOrCreateProfile(sessionId);
  const raidMultiplier = await getRaidMultiplier();
  const effectiveAmount = body.amount * raidMultiplier;
  const newCompassion = profile.compassion_points + effectiveAmount;
  const { level, title } = computeLevel(profile.neural_energy, newCompassion);

  const [updated] = await db
    .update(userProfilesTable)
    .set({ compassion_points: newCompassion, level, title, updated_at: new Date() })
    .where(eq(userProfilesTable.session_id, sessionId))
    .returning();

  await db.insert(activitiesTable).values({
    session_id: sessionId,
    type: "compassion_points",
    activity: body.activity,
    amount: effectiveAmount,
  });

  res.json({ ...(GetProfileResponse.parse(updated)), raid_multiplier: raidMultiplier });
});

router.post("/gratitude", async (req, res) => {
  const sessionId = getOrCreateSessionId(req, res);
  const { text } = req.body;
  if (!text || String(text).trim().split(/\s+/).filter(Boolean).length < 3) {
    return void res.status(400).json({ error: "At least 3 words required" });
  }
  const profile = await getOrCreateProfile(sessionId);
  const today = todayUTC();

  if (profile.last_gratitude_date === today) {
    return void res.json({ already_done: true, bonus: 0 });
  }

  const bonus = 20;
  const newEnergy = profile.neural_energy + bonus;
  const { level, title } = computeLevel(newEnergy, profile.compassion_points);

  await db.update(userProfilesTable)
    .set({ neural_energy: newEnergy, last_gratitude_date: today, level, title, updated_at: new Date() })
    .where(eq(userProfilesTable.session_id, sessionId));

  await db.insert(activitiesTable).values({
    session_id: sessionId,
    type: "neural_energy",
    activity: "Morning Bloom Gratitude",
    amount: bonus,
  });

  return void res.json({ already_done: false, bonus });
});

router.get("/gratitude-status", async (req, res) => {
  const sessionId = req.cookies?.["nq_session"];
  if (!sessionId) return void res.json({ done_today: false });
  const [profile] = await db
    .select({ last_gratitude_date: userProfilesTable.last_gratitude_date })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.session_id, sessionId))
    .limit(1);
  const done_today = profile?.last_gratitude_date === todayUTC();
  return void res.json({ done_today });
});

router.get("/activities", async (req, res) => {
  const sessionId = getOrCreateSessionId(req, res);
  const activities = await db
    .select()
    .from(activitiesTable)
    .where(eq(activitiesTable.session_id, sessionId))
    .orderBy(desc(activitiesTable.created_at))
    .limit(50);

  res.json(GetActivitiesResponse.parse(activities));
});

/* ── Growth Stats — last 7 days ──────────────────────────────────────────── */
router.get("/growth-stats", async (req, res) => {
  const sessionId = req.cookies?.["nq_session"];
  if (!sessionId) return void res.json({ days: [] });

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const activities = await db.select()
    .from(activitiesTable)
    .where(and(
      eq(activitiesTable.session_id, sessionId),
      gte(activitiesTable.created_at, sevenDaysAgo)
    ));

  // Build a map of the last 7 dates
  const dayMap: Record<string, { neural_energy: number; compassion_points: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    dayMap[d.toISOString().slice(0, 10)] = { neural_energy: 0, compassion_points: 0 };
  }
  for (const act of activities) {
    const key = act.created_at.toISOString().slice(0, 10);
    if (!(key in dayMap)) continue;
    if (act.type === "neural_energy" && act.amount > 0) dayMap[key].neural_energy += act.amount;
    if (act.type === "compassion_points" && act.amount > 0) dayMap[key].compassion_points += act.amount;
  }
  const days = Object.entries(dayMap).map(([date, vals]) => ({ date, ...vals }));
  return void res.json({ days });
});

/* ── Global Leaderboard ──────────────────────────────────────────────────── */
router.get("/leaderboard", async (_req, res) => {
  const JACKPOT_AMT = 500;
  const [{ value: lives }] = await db
    .select({ value: count() })
    .from(activitiesTable)
    .where(and(
      eq(activitiesTable.type, "compassion_points"),
      gte(activitiesTable.amount, JACKPOT_AMT)
    ));
  return void res.json({ lives_impacted: Number(lives) });
});

router.get("/access-status", async (req, res) => {
  // Enterprise pilot grant: any signed-in member of an active pilot/paid company
  // gets full premium access for the duration of the pilot/subscription.
  try {
    const { clerkId, email } = await resolveClerkIdentity(req);
    if (clerkId || email) {
      const r: any = await db.execute(sql`
        SELECT 1
        FROM enterprise_users eu
        JOIN companies c ON c.id = eu.company_id
        WHERE (
          ${clerkId ? sql`eu.idp_subject = ${clerkId}` : sql`FALSE`}
          OR ${email ? sql`LOWER(eu.email) = ${email}` : sql`FALSE`}
        )
          AND c.suspended_at IS NULL
          AND (
            (c.pilot_status = 'active'
              AND c.pilot_ends_at IS NOT NULL
              AND c.pilot_ends_at > NOW())
            OR c.subscription_status IN ('trialing', 'active')
          )
        LIMIT 1
      `);
      const rows = r.rows ?? r;
      if (rows && rows.length > 0) {
        return void res.json({ has_access: true, access_type: "pro", daily_pass_expires: null });
      }
    }
  } catch {
    // fall through to consumer logic
  }

  const sessionId = req.cookies?.["nq_session"];
  if (!sessionId) {
    return void res.json({ has_access: false, access_type: null, daily_pass_expires: null });
  }
  const [profile] = await db
    .select({ is_pro: userProfilesTable.is_pro, daily_pass_expires: userProfilesTable.daily_pass_expires })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.session_id, sessionId))
    .limit(1);

  if (!profile) {
    return void res.json({ has_access: false, access_type: null, daily_pass_expires: null });
  }
  if (profile.is_pro) {
    return void res.json({ has_access: true, access_type: "pro", daily_pass_expires: null });
  }
  if (profile.daily_pass_expires && new Date(profile.daily_pass_expires) > new Date()) {
    return void res.json({ has_access: true, access_type: "daily_pass", daily_pass_expires: profile.daily_pass_expires });
  }
  return void res.json({ has_access: false, access_type: null, daily_pass_expires: null });
});

const VALID_TASKS: Record<string, { type: "energy" | "compassion"; amount: number; label: string }> = {
  "deep-work":        { type: "energy",     amount: 50, label: "Deep Work (1 hr)" },
  "meditation":       { type: "energy",     amount: 20, label: "Meditation (15 min)" },
  "read-chapter":     { type: "energy",     amount: 15, label: "Read a Chapter" },
  "help-colleague":   { type: "compassion", amount: 30, label: "Help a Colleague" },
  "active-listening": { type: "compassion", amount: 20, label: "Active Listening" },
  "express-gratitude":{ type: "compassion", amount: 10, label: "Express Gratitude" },
};

const DASHBOARD_TASK_LABELS = new Set(Object.values(VALID_TASKS).map(t => t.label));

router.get("/task-status", async (req, res) => {
  const sessionId = req.cookies?.["nq_session"];
  if (!sessionId) return void res.json({ completions: {} });

  const today = todayUTC();
  const rows = await db
    .select({
      task_id: taskCompletionsTable.task_id,
      user_response: taskCompletionsTable.user_response,
    })
    .from(taskCompletionsTable)
    .where(
      and(
        eq(taskCompletionsTable.session_id, sessionId),
        eq(taskCompletionsTable.completion_date, today)
      )
    );

  const completions: Record<string, { done: boolean; response: string }> = {};
  for (const row of rows) {
    completions[row.task_id] = { done: true, response: row.user_response };
  }
  return void res.json({ completions });
});

router.post("/complete-task", async (req, res) => {
  const sessionId = getOrCreateSessionId(req, res);
  const { task_id, response } = req.body;

  if (!task_id || typeof task_id !== "string" || !VALID_TASKS[task_id]) {
    return void res.status(400).json({ error: "Invalid task" });
  }
  if (!response || typeof response !== "string" || response.trim().length < 15) {
    return void res.status(400).json({ error: "Please describe your session (at least 15 characters)" });
  }

  const today = todayUTC();
  const task = VALID_TASKS[task_id];

  try {
    await db.insert(taskCompletionsTable).values({
      session_id: sessionId,
      task_id,
      completion_date: today,
      user_response: response.trim(),
      amount: task.amount,
      type: task.type === "energy" ? "neural_energy" : "compassion_points",
    });
  } catch (err: any) {
    if (err?.code === "23505" || err?.constraint?.includes("task_completions_unique_daily")) {
      return void res.status(409).json({ error: "Already completed today", already_done: true });
    }
    throw err;
  }

  const profile = await getOrCreateProfile(sessionId);

  let updated;
  let awardedAmount = task.amount;
  if (task.type === "energy") {
    const newEnergy = profile.neural_energy + task.amount;
    const { level, title } = computeLevel(newEnergy, profile.compassion_points);
    [updated] = await db
      .update(userProfilesTable)
      .set({ neural_energy: newEnergy, level, title, updated_at: new Date() })
      .where(eq(userProfilesTable.session_id, sessionId))
      .returning();
  } else {
    const raidMultiplier = await getRaidMultiplier();
    awardedAmount = task.amount * raidMultiplier;
    const newCompassion = profile.compassion_points + awardedAmount;
    const { level, title } = computeLevel(profile.neural_energy, newCompassion);
    [updated] = await db
      .update(userProfilesTable)
      .set({ compassion_points: newCompassion, level, title, updated_at: new Date() })
      .where(eq(userProfilesTable.session_id, sessionId))
      .returning();
  }

  await db.insert(activitiesTable).values({
    session_id: sessionId,
    type: task.type === "energy" ? "neural_energy" : "compassion_points",
    activity: task.label,
    amount: awardedAmount,
  });

  const previousLevel = profile.level;
  const levelChanged = updated.level !== previousLevel;
  const mealsFromCompassion = task.type === "compassion" ? Math.round(awardedAmount * 0.01 * 100) / 100 : 0;

  return void res.json({
    profile: GetProfileResponse.parse(updated),
    task_id,
    completed: true,
    awarded_amount: awardedAmount,
    task_type: task.type,
    level_changed: levelChanged,
    new_level: updated.level,
    new_title: updated.title,
    meals_contributed: mealsFromCompassion,
    total_compassion: updated.compassion_points,
  });
});

router.post("/reset", async (req, res) => {
  const sessionId = getOrCreateSessionId(req, res);
  await getOrCreateProfile(sessionId);

  const { level, title } = computeLevel(100, 50);

  const [updated] = await db
    .update(userProfilesTable)
    .set({ neural_energy: 100, compassion_points: 50, level, title, streak_count: 0, last_game_date: null, updated_at: new Date() })
    .where(eq(userProfilesTable.session_id, sessionId))
    .returning();

  res.json(GetProfileResponse.parse(updated));
});

export default router;
