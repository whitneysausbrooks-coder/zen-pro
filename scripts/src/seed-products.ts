import Stripe from "stripe";

async function seedProducts() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("❌ STRIPE_SECRET_KEY is not set. Add it as a secret first.");
    process.exit(1);
  }

  const stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia" });

  console.log("Checking for existing Zen Pro product...");
  const existing = await stripe.products.search({ query: "name:'Zen Pro' AND active:'true'" });

  if (existing.data.length > 0) {
    const product = existing.data[0];
    console.log(`✓ Zen Pro already exists: ${product.id}`);
    const prices = await stripe.prices.list({ product: product.id, active: true, type: "recurring" });
    if (prices.data.length > 0) {
      console.log(`✓ Price: $${(prices.data[0].unit_amount! / 100).toFixed(2)}/${prices.data[0].recurring?.interval} (${prices.data[0].id})`);
    }
    return;
  }

  console.log("Creating Zen Pro product...");
  const product = await stripe.products.create({
    name: "Zen Pro",
    description: "Unlimited neuroplasticity games, 2× Neural Energy generation, and exclusive Gold slot skins.",
    metadata: {
      tier: "zen_pro",
      energy_multiplier: "2",
      slot_skin: "gold",
    },
  });
  console.log(`✓ Created product: ${product.id}`);

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 999,
    currency: "usd",
    recurring: { interval: "month" },
  });
  console.log(`✓ Created price: $9.99/month (${price.id})`);
  console.log("\n🎉 Zen Pro is ready in Stripe Sandbox.");
  console.log("   Run the app and navigate to /subscribe to see the pricing page.");
}

seedProducts().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
