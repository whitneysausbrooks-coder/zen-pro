import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { WebhookHandlers } from "./webhookHandlers";
import { processEnterpriseWebhook } from "./lib/enterpriseWebhook";

const app: Express = express();

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
  "/api/stripe-enterprise/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) return res.status(400).json({ error: "Missing stripe-signature" });
    const sig = Array.isArray(signature) ? signature[0] : signature;

    const webhookSecret = process.env.STRIPE_ENTERPRISE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("CRITICAL: No webhook secret configured");
      return res.status(500).json({ error: "Server misconfiguration" });
    }

    try {
      const { getStripeClient } = await import("./stripeClient");
      const stripe = getStripeClient();
      stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).json({ error: "Invalid signature" });
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(clerkMiddleware());

app.use("/api", router);

if (process.env.NODE_ENV === "production") {
  const distPath = path.resolve(path.dirname(process.argv[1] ?? "."), "public");
  app.use(express.static(distPath));
  app.get(/^(?!\/api(\/|$)).*$/, (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

export default app;
