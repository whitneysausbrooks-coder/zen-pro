import Stripe from "stripe";
import { getStripeClient } from "./stripeClient";
import { db } from "@workspace/db";
import { userProfilesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

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
      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }
  }
}
