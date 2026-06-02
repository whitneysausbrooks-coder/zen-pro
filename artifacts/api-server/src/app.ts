import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import router from "./routes";
import { WebhookHandlers } from "./webhookHandlers";
import { applySecurity, JSON_BODY_LIMIT } from "./middlewares/security";
import {
  errorMonitoringErrorHandler,
  errorMonitoringRequestHandler,
} from "./lib/errorMonitoring";

const app: Express = express();

applySecurity(app);
app.use(errorMonitoringRequestHandler);

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) return res.status(400).json({ error: "Missing stripe-signature" });
    const sig = Array.isArray(signature) ? signature[0] : signature;
    try {
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      return res.json({ received: true });
    } catch (err: any) {
      console.error("Webhook error:", err.message);
      return res.status(400).json({ error: "Webhook error" });
    }
  }
);

app.post(
  "/api/webhooks/every-org",
  express.raw({ type: "application/json" }),
  async (req, res): Promise<void> => {
    try {
      const { handleEveryOrgWebhook } = await import("./lib/everyOrg");
      const token =
        (req.header("x-webhook-token") as string | undefined) ||
        (typeof req.query.webhook_token === "string" ? req.query.webhook_token : undefined);
      const result = await handleEveryOrgWebhook(req.body as Buffer, token);
      if (!result.ok) {
        res.status(result.reason === "invalid_token" ? 403 : 400).json({ error: result.reason });
        return;
      }
      res.json({ received: true, settled: result.settled });
    } catch (err: any) {
      console.error("every.org webhook error:", err?.message);
      res.status(400).json({ error: "Webhook error" });
    }
  }
);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));

app.use("/api", router);

app.use(errorMonitoringErrorHandler);

if (process.env.NODE_ENV === "production") {
  const distPath = path.resolve(path.dirname(process.argv[1] ?? "."), "public");
  app.use(express.static(distPath));
  app.get(/^(?!\/api(\/|$)).*$/, (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

export default app;
