import { spawn } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@replit/object-storage";

const PREFIX_BASE = "db-backups";

export interface BackupResult {
  skipped: boolean;
  objectName?: string;
  sizeBytes?: number;
  kept?: number;
  pruned?: number;
}

type Logger = (message: string) => void;

const defaultLog: Logger = (message) => console.log(`[backup-db] ${message}`);

function resolveRetention(log: Logger): number {
  const raw = process.env.DB_BACKUP_RETENTION;
  if (raw === undefined || raw.trim() === "") return 14;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    log(`Invalid DB_BACKUP_RETENTION="${raw}"; falling back to 14.`);
    return 14;
  }
  return parsed;
}

function runPgDump(databaseUrl: string, outPath: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(
      "pg_dump",
      [
        "--format=custom",
        "--no-owner",
        "--no-privileges",
        "--file",
        outPath,
        databaseUrl,
      ],
      { stdio: ["ignore", "inherit", "inherit"] },
    );
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pg_dump exited with code ${code ?? "unknown"}`));
    });
  });
}

/**
 * Dumps the database referenced by DATABASE_URL with pg_dump (custom format),
 * uploads it to object storage under db-backups/<env>/, and prunes the bucket
 * to the most recent DB_BACKUP_RETENTION backups (default 14).
 *
 * No-op (skipped: true) when DATABASE_URL is unset. Throws on any real failure
 * so callers (CLI exit code / HTTP 500) can surface it.
 */
export async function runBackup(opts?: { log?: Logger }): Promise<BackupResult> {
  const log = opts?.log ?? defaultLog;
  const retention = resolveRetention(log);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    log("DATABASE_URL not set — skipping backup (no-op).");
    return { skipped: true };
  }

  const env =
    process.env.NODE_ENV === "production" ? "production" : "development";
  const prefix = `${PREFIX_BASE}/${env}/`;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const objectName = `${prefix}neuroquest-${stamp}.dump`;

  const dir = await mkdtemp(join(tmpdir(), "nq-backup-"));
  const localPath = join(dir, "dump.pgcustom");

  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  const client = bucketId ? new Client({ bucketId }) : new Client();

  try {
    log(`Running pg_dump (env=${env})...`);
    await runPgDump(databaseUrl, localPath);
    const { size } = await stat(localPath);
    log(`Dump complete: ${(size / 1024 / 1024).toFixed(2)} MB`);

    log(`Uploading to ${objectName} ...`);
    const uploaded = await client.uploadFromFilename(objectName, localPath, {
      compress: false,
    });
    if (!uploaded.ok) {
      throw new Error(`upload failed: ${uploaded.error.message}`);
    }
    log("Upload complete.");

    let kept = 0;
    let pruned = 0;
    const listed = await client.list({ prefix });
    if (!listed.ok) {
      log(`WARN: could not list backups for retention: ${listed.error.message}`);
    } else {
      const names = listed.value
        .map((o) => o.name)
        .filter((n) => n.endsWith(".dump"))
        .sort();
      const excess = names.slice(0, Math.max(0, names.length - retention));
      for (const name of excess) {
        const deleted = await client.delete(name, { ignoreNotFound: true });
        if (deleted.ok) log(`Pruned old backup: ${name}`);
        else log(`WARN: failed to prune ${name}: ${deleted.error.message}`);
      }
      kept = Math.min(names.length, retention);
      pruned = excess.length;
      log(`Retention: kept ${kept} of ${names.length}, pruned ${pruned}.`);
    }
    log("Backup finished successfully.");
    return { skipped: false, objectName, sizeBytes: size, kept, pruned };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
