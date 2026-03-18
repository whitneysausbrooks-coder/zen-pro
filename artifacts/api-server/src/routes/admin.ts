import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { globalSettingsTable, activitiesTable, userProfilesTable } from "@workspace/db/schema";
import { count, eq } from "drizzle-orm";

const router: IRouter = Router();

async function getOrCreateSettings() {
  const rows = await db.select().from(globalSettingsTable).limit(1);
  if (rows.length > 0) return rows[0];
  const [created] = await db.insert(globalSettingsTable).values({}).returning();
  return created;
}

router.get("/admin/status", async (_req, res) => {
  const settings = await getOrCreateSettings();
  const [{ value: communityWins }] = await db
    .select({ value: count() })
    .from(activitiesTable)
    .where(eq(activitiesTable.type, "compassion_points"));
  res.json({
    raid_mode_active: settings.raid_mode_active,
    raid_mode_target: settings.raid_mode_target,
    raid_started_at: settings.raid_started_at,
    community_wins: Number(communityWins),
  });
});

router.post("/admin/raid-mode", async (req, res) => {
  const settings = await getOrCreateSettings();
  const activate = req.body?.activate ?? !settings.raid_mode_active;
  const target = req.body?.target ? Number(req.body.target) : settings.raid_mode_target;
  const [updated] = await db
    .update(globalSettingsTable)
    .set({
      raid_mode_active: activate,
      raid_mode_target: target,
      raid_started_at: activate ? new Date() : null,
      updated_at: new Date(),
    })
    .where(eq(globalSettingsTable.id, settings.id))
    .returning();
  res.json({
    raid_mode_active: updated.raid_mode_active,
    raid_mode_target: updated.raid_mode_target,
    raid_started_at: updated.raid_started_at,
  });
});

router.get("/quest/event", async (_req, res) => {
  const settings = await getOrCreateSettings();
  const [{ value: communityWins }] = await db
    .select({ value: count() })
    .from(activitiesTable)
    .where(eq(activitiesTable.type, "compassion_points"));
  res.json({
    raid_mode_active: settings.raid_mode_active,
    raid_mode_target: settings.raid_mode_target,
    raid_started_at: settings.raid_started_at,
    community_wins: Number(communityWins),
  });
});

router.post("/admin/grant-daily-pass", async (req, res) => {
  const { session_id, hours = 24 } = req.body ?? {};
  if (!session_id) return res.status(400).json({ error: "session_id required" });

  const expires = new Date();
  expires.setHours(expires.getHours() + Number(hours));

  const [updated] = await db
    .update(userProfilesTable)
    .set({ daily_pass_expires: expires, updated_at: new Date() })
    .where(eq(userProfilesTable.session_id, session_id))
    .returning({ session_id: userProfilesTable.session_id, daily_pass_expires: userProfilesTable.daily_pass_expires });

  if (!updated) return res.status(404).json({ error: "Profile not found for that session_id" });
  return res.json({ success: true, daily_pass_expires: updated.daily_pass_expires });
});

router.post("/admin/grant-pro", async (req, res) => {
  const { session_id } = req.body ?? {};
  if (!session_id) return res.status(400).json({ error: "session_id required" });

  const [updated] = await db
    .update(userProfilesTable)
    .set({ is_pro: true, updated_at: new Date() })
    .where(eq(userProfilesTable.session_id, session_id))
    .returning({ session_id: userProfilesTable.session_id, is_pro: userProfilesTable.is_pro });

  if (!updated) return res.status(404).json({ error: "Profile not found" });
  return res.json({ success: true, is_pro: updated.is_pro });
});

export default router;
