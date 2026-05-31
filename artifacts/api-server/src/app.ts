import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { WebhookHandlers } from "./webhookHandlers";
import { processEnterpriseWebhook } from "./lib/enterpriseWebhook";
import { applySecurity, JSON_BODY_LIMIT } from "./middlewares/security";
import {
  errorMonitoringErrorHandler,
  errorMonitoringRequestHandler,
} from "./lib/errorMonitoring";

const app: Express = express();

// Apply security headers + rate limiting + body-size guard FIRST so every
// route (including Stripe webhooks) gets the protective headers.
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

app.post(
  "/api/stripe-enterprise/webhook",
  express.raw({ type: "application/json" }),
  async (req, res): Promise<void> => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature" });
      return;
    }
    const sig = Array.isArray(signature) ? signature[0] : signature;

    const webhookSecret = process.env.STRIPE_ENTERPRISE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("CRITICAL: No webhook secret configured");
      res.status(500).json({ error: "Server misconfiguration" });
      return;
    }

    try {
      const { getStripeClient } = await import("./stripeClient");
      const stripe = getStripeClient();
      stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    res.status(200).json({ received: true });

    setImmediate(async () => {
      try {
        await processEnterpriseWebhook(req.body as Buffer, sig);
      } catch (err: any) {
        console.error("[Webhook Async] Processing error:", err.message);
      }
    });
  }
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));
app.use(clerkMiddleware());

app.use("/api", router);

// Error-monitoring middleware MUST be mounted last so it sees errors
// from any route or middleware mounted above.
app.use(errorMonitoringErrorHandler);

if (process.env.NODE_ENV === "production") {
  const distPath = path.resolve(path.dirname(process.argv[1] ?? "."), "public");
  app.use(express.static(distPath));
  app.get(/^(?!\/api(\/|$)).*$/, (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

export default app;
