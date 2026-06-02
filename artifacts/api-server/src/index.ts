import app from "./app";
import { runMigrations } from "./lib/migrate";
import { initErrorMonitoring } from "./lib/errorMonitoring";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  initErrorMonitoring();
  try {
    await runMigrations();
    console.log("Migrations applied");
  } catch (err) {
    console.error("Migration failed — refusing to start:", err);
    process.exit(1);
  }
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

void start();
