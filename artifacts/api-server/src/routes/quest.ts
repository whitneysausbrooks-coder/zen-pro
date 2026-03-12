import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  userProfilesTable,
  activitiesTable,
  globalSettingsTable,
} from "@workspace/db/schema";
import {
  EarnEnergyBody,
  EarnCompassionBody,
  GetProfileResponse,
  GetActivitiesResponse,
} from "@workspace/api-zod";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

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
    return res.json({ streak_count: 0, multiplier: 1, is_lucky_gold: false, is_electric_blue: false });
  }
  const [profile] = await db
    .select({ streak_count: userProfilesTable.streak_count, last_game_date: userProfilesTable.last_game_date })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.session_id, sessionId))
    .limit(1);

  if (!profile) {
    return res.json({ streak_count: 0, multiplier: 1, is_lucky_gold: false, is_electric_blue: false });
  }
  return res.json(computeStreakInfo(profile.streak_count, profile.last_game_date));
});

// Called when a brain game is completed — awards energy and updates streak
router.post("/game-complete", async (req, res) => {
  const sessionId = getOrCreateSessionId(req, res);
  const profile = await getOrCreateProfile(sessionId);

  const today = todayUTC();
  const yesterday = yesterdayUTC();
  const lastDate = profile.last_game_date;

  let newStreak: number;
  const alreadyPlayedToday = lastDate === today;

  if (alreadyPlayedToday) {
    // Played again today — keep streak, still award energy
    newStreak = profile.streak_count;
  } else if (lastDate === yesterday) {
    // Consecutive day — extend streak!
    newStreak = profile.streak_count + 1;
  } else {
    // First game or streak broken
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

  return res.json({
    profile: GetProfileResponse.parse(updated),
    streak: streakInfo,
    streak_changed: streakChanged,
    streak_extended: !alreadyPlayedToday && lastDate === yesterday,
  });
});

router.post("/earn-energy", async (req, res) => {
  const sessionId = getOrCreateSessionId(req, res);
  const body = EarnEnergyBody.parse(req.body);
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
    return res.status(400).json({ error: "At least 3 words required" });
  }
  const profile = await getOrCreateProfile(sessionId);
  const today = todayUTC();

  if (profile.last_gratitude_date === today) {
    return res.json({ already_done: true, bonus: 0 });
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

  return res.json({ already_done: false, bonus });
});

router.get("/gratitude-status", async (req, res) => {
  const sessionId = req.cookies?.["nq_session"];
  if (!sessionId) return res.json({ done_today: false });
  const [profile] = await db
    .select({ last_gratitude_date: userProfilesTable.last_gratitude_date })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.session_id, sessionId))
    .limit(1);
  const done_today = profile?.last_gratitude_date === todayUTC();
  return res.json({ done_today });
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
