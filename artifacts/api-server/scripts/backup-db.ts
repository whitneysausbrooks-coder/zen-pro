import { spawn } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@replit/object-storage";

const PREFIX_BASE = "db-backups";

function resolveRetention(): number {
  const raw = process.env.DB_BACKUP_RETENTION;
  if (raw === undefined || raw.trim() === "") return 14;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    log(`Invalid DB_BACKUP_RETENTION="${raw}"; falling back to 14.`);
    return 14;
  }
  return parsed;
}

function log(message: string): void {
  console.log(`[backup-db] ${message}`);
}

const RETENTION = resolveRetention();

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

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    log("DATABASE_URL not set — skipping backup (no-op).");
    return;
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

    const listed = await client.list({ prefix });
    if (!listed.ok) {
      log(`WARN: could not list backups for retention: ${listed.error.message}`);
    } else {
      const names = listed.value
        .map((o) => o.name)
        .filter((n) => n.endsWith(".dump"))
        .sort();
      const excess = names.slice(0, Math.max(0, names.length - RETENTION));
      for (const name of excess) {
        const deleted = await client.delete(name, { ignoreNotFound: true });
        if (deleted.ok) log(`Pruned old backup: ${name}`);
        else log(`WARN: failed to prune ${name}: ${deleted.error.message}`);
      }
      log(
        `Retention: kept ${Math.min(names.length, RETENTION)} of ${names.length}, pruned ${excess.length}.`,
      );
    }
    log("Backup finished successfully.");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

main().catch((err: unknown) => {
  console.error(
    `[backup-db] FAILED: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
});
