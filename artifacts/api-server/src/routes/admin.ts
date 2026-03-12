import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { globalSettingsTable, activitiesTable } from "@workspace/db/schema";
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

export default router;
