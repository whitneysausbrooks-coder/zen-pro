import { Platform } from "react-native";
import * as RNIap from "react-native-iap";

export const PRODUCT_IDS = {
  subscriptions: ["com.neuroquest.pro.monthly"],
  nonConsumables: ["com.neuroquest.daypass"],
  consumables: [
    "com.neuroquest.spins.5",
    "com.neuroquest.spins.15",
    "com.neuroquest.spins.50",
  ],
};

export const ALL_PRODUCT_IDS = [
  ...PRODUCT_IDS.subscriptions,
  ...PRODUCT_IDS.nonConsumables,
  ...PRODUCT_IDS.consumables,
];

let connected = false;

export async function initIAP(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  if (connected) return true;
  try {
    await RNIap.initConnection();
    connected = true;
    return true;
  } catch (e) {
    console.warn("IAP init failed:", e);
    return false;
  }
}

export async function endIAP() {
  if (!connected) return;
  try {
    await RNIap.endConnection();
  } catch {}
  connected = false;
}

export async function getProducts() {
  await initIAP();
  try {
    const [subs, items] = await Promise.all([
      RNIap.getSubscriptions({ skus: PRODUCT_IDS.subscriptions }),
      RNIap.getProducts({
        skus: [...PRODUCT_IDS.nonConsumables, ...PRODUCT_IDS.consumables],
      }),
    ]);
    return { subscriptions: subs, products: items };
  } catch (e) {
    console.warn("getProducts failed:", e);
    return { subscriptions: [], products: [] };
  }
}

function getApiBase(): string {
  return Platform.OS === "web"
    ? ""
    : `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
}

async function validateOnServer(params: {
  productId: string;
  transactionId: string;
  receipt: string;
  purchaseTimeMs?: number;
  authToken?: string;
}) {
  const res = await fetch(`${getApiBase()}/api/iap/validate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(params.authToken ? { Authorization: `Bearer ${params.authToken}` } : {}),
    },
    body: JSON.stringify({
      platform: "ios",
      productId: params.productId,
      transactionId: params.transactionId,
      receipt: params.receipt,
      purchaseTimeMs: params.purchaseTimeMs,
    }),
  });
  if (!res.ok) throw new Error(`Validation failed (${res.status})`);
  return res.json();
}

export async function purchaseProduct(
  productId: string,
  authToken?: string,
): Promise<{ ok: boolean; duplicate?: boolean; entitlement?: any }> {
  await initIAP();

  const isSubscription = PRODUCT_IDS.subscriptions.includes(productId);

  let purchase: any;
  if (isSubscription) {
    purchase = await RNIap.requestSubscription({ sku: productId });
  } else {
    purchase = await RNIap.requestPurchase({ sku: productId });
  }

  const p = Array.isArray(purchase) ? purchase[0] : purchase;
  if (!p) throw new Error("No purchase returned");

  const receipt = p.transactionReceipt;
  const transactionId = p.transactionId;

  const result = await validateOnServer({
    productId,
    transactionId,
    receipt,
    purchaseTimeMs: p.transactionDate,
    authToken,
  });

  const isConsumable = PRODUCT_IDS.consumables.includes(productId);
  try {
    await RNIap.finishTransaction({ purchase: p, isConsumable });
  } catch (e) {
    console.warn("finishTransaction failed:", e);
  }

  return result;
}

export async function restorePurchases(
  authToken?: string,
): Promise<{ ok: boolean; restored: string[] }> {
  await initIAP();
  const purchases = await RNIap.getAvailablePurchases();
  const latestReceipt = purchases[0]?.transactionReceipt;
  if (!latestReceipt) return { ok: true, restored: [] };

  const res = await fetch(`${getApiBase()}/api/iap/restore`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({ receipt: latestReceipt }),
  });
  if (!res.ok) throw new Error(`Restore failed (${res.status})`);
  return res.json();
}

export async function fetchEntitlements(authToken?: string) {
  const res = await fetch(`${getApiBase()}/api/iap/entitlements`, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
  });
  if (!res.ok) throw new Error(`Entitlements fetch failed (${res.status})`);
  return res.json() as Promise<{
    entitlements: any[];
    spin_balance: number;
    pro_active: boolean;
  }>;
}
