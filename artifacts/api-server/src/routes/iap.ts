import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { z } from "zod";
import { query, withTransaction } from "../lib/db";

const router: IRouter = Router();

const APPLE_VERIFY_PROD = "https://buy.itunes.apple.com/verifyReceipt";
const APPLE_VERIFY_SANDBOX = "https://sandbox.itunes.apple.com/verifyReceipt";

const KNOWN_PRODUCTS = new Set([
  "com.neuroquest.pro.monthly",
  "com.neuroquest.daypass",
  "com.neuroquest.spins.5",
  "com.neuroquest.spins.15",
  "com.neuroquest.spins.50",
]);

const CONSUMABLES: Record<string, number> = {
  "com.neuroquest.spins.5": 5,
  "com.neuroquest.spins.15": 15,
  "com.neuroquest.spins.50": 50,
};

const SUBSCRIPTIONS = new Set(["com.neuroquest.pro.monthly"]);
const NON_CONSUMABLES = new Set(["com.neuroquest.daypass"]);

function requireUserId(req: any, res: any): string | null {
  const auth = getAuth(req);
  const userId = (auth?.sessionClaims?.userId || auth?.userId) as string | undefined;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return userId;
}

async function verifyAppleReceipt(receiptData: string) {
  const sharedSecret = process.env.APPLE_IAP_SHARED_SECRET;
  const body = {
    "receipt-data": receiptData,
    password: sharedSecret,
    "exclude-old-transactions": true,
  };

  let resp = await fetch(APPLE_VERIFY_PROD, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let json: any = await resp.json();

  if (json.status === 21007) {
    resp = await fetch(APPLE_VERIFY_SANDBOX, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    json = await resp.json();
  }

  return json;
}

const ValidateSchema = z.object({
  platform: z.enum(["ios", "android"]),
  productId: z.string().min(1),
  transactionId: z.string().min(1),
  receipt: z.string().min(10),
  purchaseTimeMs: z.number().optional(),
});

router.post("/iap/validate", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const parsed = ValidateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
  }

  const { platform, productId, transactionId, receipt } = parsed.data;

  if (!KNOWN_PRODUCTS.has(productId)) {
    return res.status(400).json({ error: "Unknown productId" });
  }

  if (platform !== "ios") {
    return res.status(400).json({ error: "Only iOS supported at this time" });
  }

  const verification = await verifyAppleReceipt(receipt);

  if (verification.status !== 0) {
    return res.status(400).json({
      error: "Receipt invalid",
      apple_status: verification.status,
    });
  }

  const receiptInfo: any[] =
    verification.latest_receipt_info || verification.receipt?.in_app || [];
  const match = receiptInfo.find(
    (r: any) => r.transaction_id === transactionId || r.original_transaction_id === transactionId,
  );

  if (!match) {
    return res.status(400).json({ error: "Transaction not found in receipt" });
  }

  const result = await withTransaction(async (client) => {
    const existing = await client.query(
      "SELECT id FROM iap_transactions WHERE transaction_id = $1",
      [transactionId],
    );
    if (existing.rows.length > 0) {
      return { duplicate: true, entitlement: null };
    }

    await client.query(
      `INSERT INTO iap_transactions
         (user_id, platform, product_id, transaction_id, original_transaction_id, purchase_date, raw_receipt, validated_at)
       VALUES ($1, $2, $3, $4, $5, to_timestamp($6::bigint / 1000.0), $7, NOW())`,
      [
        userId,
        platform,
        productId,
        transactionId,
        match.original_transaction_id || transactionId,
        match.purchase_date_ms || Date.now(),
        JSON.stringify(match),
      ],
    );

    let entitlement: any = null;

    if (SUBSCRIPTIONS.has(productId)) {
      const expiresMs = parseInt(match.expires_date_ms || "0", 10);
      const active = expiresMs > Date.now();
      const upsert = await client.query(
        `INSERT INTO iap_entitlements (user_id, product_id, kind, status, expires_at, updated_at)
         VALUES ($1, $2, 'subscription', $3, to_timestamp($4::bigint / 1000.0), NOW())
         ON CONFLICT (user_id, product_id)
         DO UPDATE SET status = EXCLUDED.status, expires_at = EXCLUDED.expires_at, updated_at = NOW()
         RETURNING *`,
        [userId, productId, active ? "active" : "expired", expiresMs],
      );
      entitlement = upsert.rows[0];
    } else if (NON_CONSUMABLES.has(productId)) {
      const upsert = await client.query(
        `INSERT INTO iap_entitlements (user_id, product_id, kind, status, expires_at, updated_at)
         VALUES ($1, $2, 'non_consumable', 'active', NULL, NOW())
         ON CONFLICT (user_id, product_id)
         DO UPDATE SET status = 'active', updated_at = NOW()
         RETURNING *`,
        [userId, productId],
      );
      entitlement = upsert.rows[0];
    } else if (productId in CONSUMABLES) {
      const spins = CONSUMABLES[productId];
      await client.query(
        `INSERT INTO user_spin_balance (user_id, balance, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET balance = user_spin_balance.balance + EXCLUDED.balance, updated_at = NOW()`,
        [userId, spins],
      );
      entitlement = { kind: "consumable", product_id: productId, spins_added: spins };
    }

    return { duplicate: false, entitlement };
  });

  return res.json({ ok: true, ...result });
});

router.post("/iap/restore", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const parsed = z.object({ receipt: z.string().min(10) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body" });
  }

  const verification = await verifyAppleReceipt(parsed.data.receipt);
  if (verification.status !== 0) {
    return res.status(400).json({ error: "Receipt invalid", apple_status: verification.status });
  }

  const receiptInfo: any[] =
    verification.latest_receipt_info || verification.receipt?.in_app || [];
  const restored: string[] = [];

  for (const item of receiptInfo) {
    const productId = item.product_id;
    if (!KNOWN_PRODUCTS.has(productId)) continue;
    if (SUBSCRIPTIONS.has(productId)) {
      const expiresMs = parseInt(item.expires_date_ms || "0", 10);
      const active = expiresMs > Date.now();
      await query(
        `INSERT INTO iap_entitlements (user_id, product_id, kind, status, expires_at, updated_at)
         VALUES ($1, $2, 'subscription', $3, to_timestamp($4::bigint / 1000.0), NOW())
         ON CONFLICT (user_id, product_id)
         DO UPDATE SET status = EXCLUDED.status, expires_at = EXCLUDED.expires_at, updated_at = NOW()`,
        [userId, productId, active ? "active" : "expired", expiresMs],
      );
      if (active) restored.push(productId);
    } else if (NON_CONSUMABLES.has(productId)) {
      await query(
        `INSERT INTO iap_entitlements (user_id, product_id, kind, status, expires_at, updated_at)
         VALUES ($1, $2, 'non_consumable', 'active', NULL, NOW())
         ON CONFLICT (user_id, product_id)
         DO UPDATE SET status = 'active', updated_at = NOW()`,
        [userId, productId],
      );
      restored.push(productId);
    }
  }

  return res.json({ ok: true, restored });
});

router.get("/iap/entitlements", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const ents = await query(
    `SELECT product_id, kind, status, expires_at FROM iap_entitlements
     WHERE user_id = $1 AND (status = 'active' OR expires_at > NOW())`,
    [userId],
  );
  const spins = await query(
    `SELECT balance FROM user_spin_balance WHERE user_id = $1`,
    [userId],
  );

  return res.json({
    entitlements: ents.rows,
    spin_balance: spins.rows[0]?.balance || 0,
    pro_active: ents.rows.some(
      (r: any) => r.product_id === "com.neuroquest.pro.monthly" && r.status === "active",
    ),
  });
});

router.post("/iap/webhook", async (req, res) => {
  const notification = req.body;
  const signedPayload = notification?.signedPayload;
  if (!signedPayload) {
    return res.status(400).json({ error: "Missing signedPayload" });
  }
  try {
    const [, payloadB64] = signedPayload.split(".");
    const decoded = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8"));
    const notificationType = decoded.notificationType;
    const data = decoded.data;
    if (!data?.signedTransactionInfo) {
      return res.json({ ok: true, ignored: "no transaction" });
    }
    const [, txB64] = data.signedTransactionInfo.split(".");
    const tx = JSON.parse(Buffer.from(txB64, "base64").toString("utf8"));

    if (
      notificationType === "EXPIRED" ||
      notificationType === "REFUND" ||
      notificationType === "REVOKE"
    ) {
      await query(
        `UPDATE iap_entitlements SET status = 'expired', updated_at = NOW()
         WHERE product_id = $1 AND user_id IN
           (SELECT user_id FROM iap_transactions WHERE original_transaction_id = $2)`,
        [tx.productId, tx.originalTransactionId],
      );
    }
    if (
      notificationType === "DID_RENEW" ||
      notificationType === "SUBSCRIBED"
    ) {
      const expiresMs = tx.expiresDate;
      await query(
        `UPDATE iap_entitlements SET status = 'active', expires_at = to_timestamp($1::bigint / 1000.0), updated_at = NOW()
         WHERE product_id = $2 AND user_id IN
           (SELECT user_id FROM iap_transactions WHERE original_transaction_id = $3)`,
        [expiresMs, tx.productId, tx.originalTransactionId],
      );
    }
    return res.json({ ok: true, notificationType });
  } catch (e: any) {
    console.error("IAP webhook parse failed:", e.message);
    return res.status(400).json({ error: "Invalid payload" });
  }
});

export default router;
