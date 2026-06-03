import { Router, type IRouter } from "express";
import { runBackup } from "../lib/backupDb";

const router: IRouter = Router();

/**
 * Admin: trigger a database backup (pg_dump -> object storage + retention).
 * Guarded by the ADMIN_MASTER_KEY secret (x-admin-key header). Designed to be
 * called on a schedule by an external cron service, since Replit deploys the
 * whole project as a single (autoscale) deployment and cannot run a separate
 * scheduled deployment alongside it.
 */
router.post("/admin/db-backup", async (req, res) => {
  const masterKey = process.env.ADMIN_MASTER_KEY;
  const provided = req.header("x-admin-key");
  if (!masterKey || provided !== masterKey) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const result = await runBackup({ log: (m) => console.log(`[backup-db] ${m}`) });
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("DB backup error:", err);
    return res.status(500).json({ error: "Backup failed" });
  }
});

export default router;
