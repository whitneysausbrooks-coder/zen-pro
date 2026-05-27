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

/**
 * Returns the full Zen Pro pricing matrix (Monthly / Annual / Founder Tier).
 *
 * Resolution strategy:
 *   1. Search Stripe for products with names "Zen Pro Monthly", "Zen Pro Annual",
 *      "Zen Pro Founder" (exact match — Whitney creates them in the dashboard).
 *   2. Fall back to the legacy "Zen Pro" product for the Monthly slot so existing
 *      installs keep working without any Stripe-dashboard re-config.
 *   3. For each product, pick the first active price (recurring for sub tiers,
 *      one-time for Founder).
 *
 * The client uses this to render a 3-tier picker on /subscribe. Tiers that
 * are not yet configured in Stripe are returned with priceId:null and the UI
 * disables that card so we never offer a checkout that would 400.
 */
router.get("/stripe/zen-pro-prices", async (_req, res) => {
  if (!isStripeConfigured()) {
    return res.json({
      configured: false,
      tiers: [
        { tier: "monthly", label: "Monthly",  priceId: null, amount: 999,  currency: "usd", interval: "month", mode: "subscription" },
        { tier: "annual",  label: "Annual",   priceId: null, amount: 7900, currency: "usd", interval: "year",  mode: "subscription" },
        { tier: "founder", label: "Founder",  priceId: null, amount: 19900, currency: "usd", interval: null,   mode: "payment" },
      ],
    });
  }

  try {
    const stripe = getStripeClient();

    async function findProductByName(name: string) {
      try {
        const r = await stripe.products.search({ query: `name:'${name}' AND active:'true'` });
        return r.data[0] ?? null;
      } catch { return null; }
    }
    async function firstActivePrice(productId: string, recurring: boolean) {
      const list = await stripe.prices.list({
        product: productId,
        active: true,
        type: recurring ? "recurring" : "one_time",
        limit: 1,
      });
      return list.data[0] ?? null;
    }

    const [pMonthly, pAnnual, pFounder, pLegacy] = await Promise.all([
      findProductByName("Zen Pro Monthly"),
      findProductByName("Zen Pro Annual"),
      findProductByName("Zen Pro Founder"),
      findProductByName("Zen Pro"),
    ]);

    const monthlyProduct = pMonthly ?? pLegacy;
    const monthlyPrice = monthlyProduct ? await firstActivePrice(monthlyProduct.id, true) : null;
    const annualPrice  = pAnnual       ? await firstActivePrice(pAnnual.id,       true) : null;
    const founderPrice = pFounder      ? await firstActivePrice(pFounder.id,      false) : null;

    return res.json({
      configured: true,
      tiers: [
        {
          tier: "monthly",
          label: "Monthly",
          priceId: monthlyPrice?.id ?? null,
          amount: monthlyPrice?.unit_amount ?? 999,
          currency: monthlyPrice?.currency ?? "usd",
          interval: (monthlyPrice?.recurring?.interval ?? "month") as string,
          mode: "subscription" as const,
        },
        {
          tier: "annual",
          label: "Annual",
          priceId: annualPrice?.id ?? null,
          amount: annualPrice?.unit_amount ?? 7900,
          currency: annualPrice?.currency ?? "usd",
          interval: (annualPrice?.recurring?.interval ?? "year") as string,
          mode: "subscription" as const,
        },
        {
          tier: "founder",
          label: "Founder",
          priceId: founderPrice?.id ?? null,
          amount: founderPrice?.unit_amount ?? 19900,
          currency: founderPrice?.currency ?? "usd",
          interval: null,
          mode: "payment" as const,
        },
      ],
    });
  } catch (err: any) {
    console.error("zen-pro-prices error:", err.message);
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

    // Auto-detect subscription vs one-time payment from the price itself —
    // required so the Founder Tier (one-time $199) works through the same
    // /checkout endpoint as the recurring Monthly/Annual tiers without the
    // client having to know about Stripe's mode/type pairing rules.
    const priceObj = await stripe.prices.retrieve(priceId);
    const isRecurring = !!priceObj.recurring;

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: isRecurring ? "subscription" : "payment",
      metadata: { nq_session: sessionId, tier: isRecurring ? "subscription" : "founder" },
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
            description: `${hours} hours of unlimited access to all games & Compassion Impact™`,
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

router.post("/stripe/extra-spins-checkout", async (req: any, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ error: "Stripe is not configured." });
  }

  const sessionId = req.cookies?.["nq_session"];
  if (!sessionId) return res.status(401).json({ error: "No session found" });

  const spins = Math.max(1, Math.min(100, Number(req.body?.spins) || 10));
  const energy = spins * 10;

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
          unit_amount: 299,
          product_data: {
            name: `NeuroQuest — ${spins} Extra Plays`,
            description: `Adds ${energy} Neural Energy to your account (${spins} plays at 10 energy each)`,
          },
        },
        quantity: 1,
      }],
      mode: "payment",
      metadata: { nq_session: sessionId, spins: String(spins), energy: String(energy), type: "extra_spins" },
      success_url: `${baseUrl}/wellness?spins_success=1`,
      cancel_url: `${baseUrl}/wellness`,
    });

    return res.json({ url: checkoutSession.url });
  } catch (err: any) {
    console.error("Extra spins checkout error:", err.message);
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
