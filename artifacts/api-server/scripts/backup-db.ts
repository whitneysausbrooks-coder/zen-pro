import { runBackup } from "../src/lib/backupDb";

runBackup()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(
      `[backup-db] FAILED: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  });
