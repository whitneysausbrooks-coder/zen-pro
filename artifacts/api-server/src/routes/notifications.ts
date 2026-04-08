import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  globalSettingsTable,
  pushSubscriptionsTable,
  userProfilesTable,
  activitiesTable,
} from "@workspace/db/schema";
import { eq, lt, and, not, inArray, count } from "drizzle-orm";
import webpush from "web-push";
import { requireAdmin } from "../middlewares/adminMiddleware";

const router: IRouter = Router();

/* ── VAPID bootstrap ─────────────────────────────────────────────────────── */
const VAPID_SUBJECT = "mailto:admin@neuroquest.app";

async function getVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const rows = await db.select().from(globalSettingsTable).limit(1);
  const settings = rows[0];

  if (settings?.vapid_public_key && settings?.vapid_private_key) {
    return { publicKey: settings.vapid_public_key, privateKey: settings.vapid_private_key };
  }

  // Generate fresh keys
  const keys = webpush.generateVAPIDKeys();
  if (settings) {
    await db.update(globalSettingsTable)
      .set({ vapid_public_key: keys.publicKey, vapid_private_key: keys.privateKey, updated_at: new Date() })
      .where(eq(globalSettingsTable.id, settings.id));
  } else {
    await db.insert(globalSettingsTable).values({
      vapid_public_key: keys.publicKey,
      vapid_private_key: keys.privateKey,
    });
  }
  return keys;
}

let vapidInitialized = false;
async function ensureVapid() {
  if (vapidInitialized) return;
  const keys = await getVapidKeys();
  webpush.setVapidDetails(VAPID_SUBJECT, keys.publicKey, keys.privateKey);
  vapidInitialized = true;
}

// Initialize on server start
ensureVapid().catch(console.error);

/* ── Level helpers ───────────────────────────────────────────────────────── */
const LEVEL_THRESHOLDS = [0, 200, 500, 1000, 2000, 4000];
const LEVEL_TITLES = ["Seeker", "Apprentice", "Adept", "Luminary", "Sage", "Zenith Master"];

function getLevelInfo(total: number) {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (total >= LEVEL_THRESHOLDS[i]) { level = i + 1; break; }
  }
  level = Math.min(level, 6);
  const title = LEVEL_TITLES[level - 1];
  const currentThresh = LEVEL_THRESHOLDS[level - 1];
  const nextThresh = level < 6 ? LEVEL_THRESHOLDS[level] : null;
  const pctToNext = nextThresh
    ? Math.round(((total - currentThresh) / (nextThresh - currentThresh)) * 100)
    : 100;
  const nextTitle = level < 6 ? LEVEL_TITLES[level] : null;
  return { level, title, nextTitle, pctToNext, pctRemaining: nextThresh ? 100 - pctToNext : 0 };
}

export function buildNudgePayload(
  profile: { neural_energy: number; compassion_points: number; title: string; last_game_date: string | null },
  appUrl: string
): { title: string; body: string; url: string } {
  const total = profile.neural_energy + profile.compassion_points;
  const { title, nextTitle, pctRemaining } = getLevelInfo(total);

  const daysSince = profile.last_game_date
    ? Math.floor((Date.now() - new Date(profile.last_game_date + "T00:00:00Z").getTime()) / 86_400_000)
    : null;

  if (nextTitle && pctRemaining <= 10) {
    return {
      title: `Almost ${nextTitle}, ${title}!`,
      body: `Your focus score is ${pctRemaining}% away from a new personal best. Ready to hit the floor?`,
      url: appUrl,
    };
  }
  if (daysSince !== null && daysSince >= 3) {
    return {
      title: `${title}, your edge is cooling`,
      body: `${daysSince} days since your last session. One game today keeps the streak alive.`,
      url: appUrl,
    };
  }
  return {
    title: `Time to train, ${title}`,
    body: `24 hours without a session. Your Brain Health Level is waiting to grow.`,
    url: appUrl,
  };
}

/* ── Routes ──────────────────────────────────────────────────────────────── */
router.get("/notifications/vapid-public-key", async (_req, res) => {
  try {
    await ensureVapid();
    const keys = await getVapidKeys();
    res.json({ publicKey: keys.publicKey });
  } catch (err) {
    console.error("VAPID key error:", err);
    res.status(500).json({ error: "Push not configured" });
  }
});

router.post("/notifications/subscribe", async (req, res) => {
  const sessionId = req.cookies?.["nq_session"];
  if (!sessionId) return res.status(400).json({ error: "No session" });

  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: "Invalid subscription" });
  }

  await db.insert(pushSubscriptionsTable)
    .values({ session_id: sessionId, endpoint, p256dh: keys.p256dh, auth: keys.auth })
    .onConflictDoUpdate({
      target: pushSubscriptionsTable.endpoint,
      set: { session_id: sessionId, p256dh: keys.p256dh, auth: keys.auth },
    });

  return res.json({ ok: true });
});

router.delete("/notifications/unsubscribe", async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: "No endpoint" });
  await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, endpoint));
  return res.json({ ok: true });
});

router.get("/notifications/status", async (req, res) => {
  const sessionId = req.cookies?.["nq_session"];
  if (!sessionId) return res.json({ subscribed: false });
  const subs = await db.select({ id: pushSubscriptionsTable.id })
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.session_id, sessionId))
    .limit(1);
  return res.json({ subscribed: subs.length > 0 });
});

/* ── Nudge status (in-app) ───────────────────────────────────────────────── */
router.get("/quest/nudge-status", async (req, res) => {
  const sessionId = req.cookies?.["nq_session"];
  if (!sessionId) return res.json({ should_nudge: false });

  const [profile] = await db.select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.session_id, sessionId))
    .limit(1);

  if (!profile) return res.json({ should_nudge: false });

  const total = profile.neural_energy + profile.compassion_points;
  const { title, nextTitle, pctToNext, pctRemaining } = getLevelInfo(total);

  const hoursSince = profile.last_game_date
    ? Math.floor((Date.now() - new Date(profile.last_game_date + "T00:00:00Z").getTime()) / 3_600_000)
    : null;

  const should_nudge = hoursSince !== null && hoursSince >= 24;

  const nudgeMsg = !nextTitle ? `You've reached ${title}. Every session from here deepens your mastery.` :
    pctRemaining <= 10
      ? `You're ${pctRemaining}% away from ${nextTitle}. You're so close — one more session could do it.`
      : hoursSince && hoursSince >= 48
        ? `Welcome back, ${title}. Your neural pathways remember you. Pick up right where you left off.`
        : `You're building toward ${nextTitle}. Your next session adds to everything you've already built.`;

  return res.json({
    should_nudge,
    hours_since_play: hoursSince,
    level_title: title,
    next_level_title: nextTitle,
    pct_to_next: pctToNext,
    pct_remaining: pctRemaining,
    nudge_message: nudgeMsg,
  });
});

/* ── Admin: send nudge campaign ──────────────────────────────────────────── */
router.post("/admin/send-nudge", requireAdmin, async (req, res) => {
  try {
    await ensureVapid();
    // Re-init webpush with current keys
    const keys = await getVapidKeys();
    webpush.setVapidDetails(VAPID_SUBJECT, keys.publicKey, keys.privateKey);

    // Find all subscriptions where user hasn't played in 24h+
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

    // Get all subscriptions
    const subs = await db.select().from(pushSubscriptionsTable);
    if (subs.length === 0) return res.json({ sent: 0, failed: 0, message: "No subscribers" });

    const sessionIds = subs.map(s => s.session_id);
    // Get profiles for these sessions that haven't played recently
    const inactiveProfiles = await db.select()
      .from(userProfilesTable)
      .where(
        and(
          inArray(userProfilesTable.session_id, sessionIds),
        )
      );

    const appUrl = req.body?.app_url || `${req.protocol}://${req.get("host")}`;
    let sent = 0, failed = 0;

    for (const profile of inactiveProfiles) {
      // Only nudge if 24h+ since last play
      if (profile.last_game_date && profile.last_game_date >= yesterday) continue;

      const sub = subs.find(s => s.session_id === profile.session_id);
      if (!sub) continue;

      const payload = buildNudgePayload(profile, appUrl);
      const pushSub = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };

      try {
        await webpush.sendNotification(pushSub, JSON.stringify({ ...payload, icon: "/favicon.ico" }));
        sent++;
      } catch (err: any) {
        console.error("Push send error:", err?.statusCode, err?.body);
        // Remove expired subscriptions (410 Gone)
        if (err?.statusCode === 410) {
          await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, sub.endpoint));
        }
        failed++;
      }
    }

    return res.json({ sent, failed, total_subs: subs.length });
  } catch (err) {
    console.error("Send-nudge error:", err);
    return res.status(500).json({ error: "Failed to send nudges" });
  }
});

export default router;
