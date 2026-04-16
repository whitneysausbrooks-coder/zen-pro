import app from "./app";
import { startReconciliationScheduler } from "./lib/billingReconciliation";
import { startDailyRecognitionScheduler } from "./lib/revenueRecognition";

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

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  startReconciliationScheduler();
  startDailyRecognitionScheduler();
});
