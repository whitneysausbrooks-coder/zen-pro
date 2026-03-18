import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { authMiddleware } from "./middlewares/authMiddleware";
import router from "./routes";
import { WebhookHandlers } from "./webhookHandlers";

const app: Express = express();

// ⚠️ Stripe webhook MUST be registered before express.json() — it needs the raw Buffer
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

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(authMiddleware);

app.use("/api", router);

if (process.env.NODE_ENV === "production") {
  // process.argv[1] is the path to the running script (dist/index.cjs).
  // dirname of that gives us the dist/ directory, where dist/public/ lives.
  const distPath = path.resolve(path.dirname(process.argv[1] ?? "."), "public");
  app.use(express.static(distPath));
  // SPA fallback: serve index.html for all non-API routes so client-side routing works.
  // Explicitly excludes /api and /api/* so unmatched API paths return a proper 404.
  app.get(/^(?!\/api(\/|$)).*$/, (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

export default app;
