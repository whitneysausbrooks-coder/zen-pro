import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { userProfilesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getStripeClient, isStripeConfigured } from "../stripeClient";

const router: IRouter = Router();

router.get("/stripe/status", async (req: any, res) => {
  const sessionId = req.cookies?.["nq_session"];
  if (!sessionId) return res.json({ is_pro: false });

  const [profile] = await db
    .select({ is_pro: userProfilesTable.is_pro })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.session_id, sessionId));

  return res.json({ is_pro: profile?.is_pro ?? false });
});

router.get("/stripe/zen-pro-price", async (_req, res) => {
  if (!isStripeConfigured()) {
    return res.json({ priceId: null, amount: 999, currency: "usd", interval: "month", configured: false });
  }
  try {
    const stripe = getStripeClient();
    const products = await stripe.products.search({
      query: "name:'Zen Pro' AND active:'true'",
    });

    if (products.data.length === 0) {
      return res.json({ priceId: null, amount: 999, currency: "usd", interval: "month", configured: true, noProduct: true });
    }

    const prices = await stripe.prices.list({
      product: products.data[0].id,
      active: true,
      type: "recurring",
      limit: 1,
    });

    const price = prices.data[0];
    return res.json({
      priceId: price?.id ?? null,
      amount: price?.unit_amount ?? 999,
      currency: price?.currency ?? "usd",
      interval: (price?.recurring?.interval ?? "month") as string,
      configured: true,
    });
  } catch (err: any) {
    console.error("zen-pro-price error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.post("/stripe/checkout", async (req: any, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ error: "Stripe is not configured. Add STRIPE_SECRET_KEY to enable payments." });
  }

  const sessionId = req.cookies?.["nq_session"];
  if (!sessionId) return res.status(401).json({ error: "No session found" });

  const { priceId } = req.body as { priceId: string };
  if (!priceId) return res.status(400).json({ error: "priceId is required" });

  try {
    const stripe = getStripeClient();

    const [profile] = await db
      .select({ stripe_customer_id: userProfilesTable.stripe_customer_id })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.session_id, sessionId));

    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { nq_session: sessionId },
      });
      customerId = customer.id;
      await db
        .update(userProfilesTable)
        .set({ stripe_customer_id: customerId })
        .where(eq(userProfilesTable.session_id, sessionId));
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${baseUrl}/subscribe?success=1`,
      cancel_url: `${baseUrl}/subscribe?canceled=1`,
    });

    return res.json({ url: session.url });
  } catch (err: any) {
    console.error("Checkout error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.post("/stripe/daily-pass-checkout", async (req: any, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ error: "Stripe is not configured." });
  }

  const sessionId = req.cookies?.["nq_session"];
  if (!sessionId) return res.status(401).json({ error: "No session found" });

  const hours = Number(req.body?.hours) || 24;

  try {
    const stripe = getStripeClient();

    const [profile] = await db
      .select({ stripe_customer_id: userProfilesTable.stripe_customer_id })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.session_id, sessionId));

    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { nq_session: sessionId },
      });
      customerId = customer.id;
      await db
        .update(userProfilesTable)
        .set({ stripe_customer_id: customerId })
        .where(eq(userProfilesTable.session_id, sessionId));
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "usd",
          unit_amount: 500,
          product_data: {
            name: "NeuroQuest Daily Pass",
            description: `${hours} hours of unlimited access to all games & Compassion Jackpot™`,
            images: [],
          },
        },
        quantity: 1,
      }],
      mode: "payment",
      metadata: { nq_session: sessionId, hours: String(hours), type: "daily_pass" },
      success_url: `${baseUrl}/subscribe?daily_success=1`,
      cancel_url: `${baseUrl}/subscribe?canceled=1`,
    });

    return res.json({ url: checkoutSession.url });
  } catch (err: any) {
    console.error("Daily pass checkout error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.post("/stripe/portal", async (req: any, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ error: "Stripe not configured" });
  }

  const sessionId = req.cookies?.["nq_session"];
  if (!sessionId) return res.status(401).json({ error: "No session" });

  const [profile] = await db
    .select({ stripe_customer_id: userProfilesTable.stripe_customer_id })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.session_id, sessionId));

  if (!profile?.stripe_customer_id) {
    return res.status(404).json({ error: "No Stripe customer found" });
  }

  const stripe = getStripeClient();
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${baseUrl}/subscribe`,
  });

  return res.json({ url: portalSession.url });
});

export default router;
