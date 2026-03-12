import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  userProfilesTable,
  activitiesTable,
} from "@workspace/db/schema";
import {
  EarnEnergyBody,
  EarnCompassionBody,
  GetProfileResponse,
  GetActivitiesResponse,
} from "@workspace/api-zod";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

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

  const newCompassion = profile.compassion_points + body.amount;
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
    amount: body.amount,
  });

  res.json(GetProfileResponse.parse(updated));
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
    .set({ neural_energy: 100, compassion_points: 50, level, title, updated_at: new Date() })
    .where(eq(userProfilesTable.session_id, sessionId))
    .returning();

  res.json(GetProfileResponse.parse(updated));
});

export default router;
