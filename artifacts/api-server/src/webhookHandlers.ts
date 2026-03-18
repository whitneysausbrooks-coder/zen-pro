import Stripe from "stripe";
import { getStripeClient } from "./stripeClient";
import { db } from "@workspace/db";
import { userProfilesTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error("Webhook payload must be a Buffer — ensure webhook route is before express.json()");
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.warn("STRIPE_WEBHOOK_SECRET not set — skipping signature verification");
      return;
    }

    const stripe = getStripeClient();
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const isActive = sub.status === "active" || sub.status === "trialing";
        console.log(`Subscription ${event.type}: customer=${customerId} active=${isActive}`);
        await db
          .update(userProfilesTable)
          .set({ is_pro: isActive })
          .where(eq(userProfilesTable.stripe_customer_id, customerId));
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        console.log(`Subscription deleted: customer=${customerId}`);
        await db
          .update(userProfilesTable)
          .set({ is_pro: false })
          .where(eq(userProfilesTable.stripe_customer_id, customerId));
        break;
      }
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const meta = session.metadata ?? {};

        if (meta.type === "daily_pass" && meta.nq_session) {
          const hours = Math.max(1, Math.min(720, Number(meta.hours) || 24));
          const expires = new Date(Date.now() + hours * 3600 * 1000);
          console.log(`Daily Pass purchased via Stripe: session=${meta.nq_session} expires=${expires.toISOString()}`);
          await db
            .update(userProfilesTable)
            .set({ daily_pass_expires: expires })
            .where(eq(userProfilesTable.session_id, meta.nq_session));
        }

        if (meta.type === "extra_spins" && meta.nq_session) {
          const energy = Math.max(10, Math.min(1000, Number(meta.energy) || 100));
          console.log(`Extra spins purchased via Stripe: session=${meta.nq_session} +${energy} neural energy`);
          await db
            .update(userProfilesTable)
            .set({ neural_energy: sql`${userProfilesTable.neural_energy} + ${energy}` })
            .where(eq(userProfilesTable.session_id, meta.nq_session));
        }

        break;
      }
      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }
  }
}
