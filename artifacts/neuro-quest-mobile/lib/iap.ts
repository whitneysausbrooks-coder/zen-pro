import { Platform } from "react-native";
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  getAvailablePurchases,
} from "expo-iap";
import { signedFetch, getStoredUserId } from "./userAuth";

/**
 * Build the auth headers for an IAP server call.
 *
 * Mobile is identified to /api/iap/* by the per-device HMAC handshake
 * (X-Device-Id / X-Issued-At / X-Timestamp / X-Signature added by signedFetch)
 * plus an explicit X-User-Id naming the app_users.id the signature is bound
 * to. The server re-derives the device_secret from those inputs and verifies
 * the HMAC before accepting the request — same scheme as the rest of the
 * /api/app-user/* surface.
 *
 * The optional Bearer token path is preserved for any future Clerk-on-mobile
 * callers (see web Pro management) but is not used by the current mobile build.
 */
async function buildAuthHeaders(authToken?: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  try {
    const userId = await getStoredUserId();
    if (userId) headers["X-User-Id"] = userId;
  } catch {
    // best-effort — server will 401 cleanly if the user has no identity yet
  }
  return headers;
}

export const PRODUCT_IDS = {
  subscriptions: [
    "pro.neuroquestzen.app.zenpro.monthly",
    "pro.neuroquestzen.app.zenpro.annual",
  ],
  nonConsumables: [
    "pro.neuroquestzen.app.daypass",
    "pro.neuroquestzen.app.founder",
  ],
  consumables: [
    "pro.neuroquestzen.app.spins.5",
    "pro.neuroquestzen.app.spins.15",
    "pro.neuroquestzen.app.spins.50",
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
    await initConnection();
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
    await endConnection();
  } catch {}
  connected = false;
}

export async function getProducts() {
  await initIAP();
  try {
    const [subs, items] = await Promise.all([
      fetchProducts({ skus: PRODUCT_IDS.subscriptions, type: "subs" }),
      fetchProducts({
        skus: [...PRODUCT_IDS.nonConsumables, ...PRODUCT_IDS.consumables],
        type: "in-app",
      }),
    ]);
    return {
      subscriptions: Array.isArray(subs) ? subs : [],
      products: Array.isArray(items) ? items : [],
    };
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
  const authHeaders = await buildAuthHeaders(params.authToken);
  const res = await signedFetch(`${getApiBase()}/api/iap/validate`, {
    method: "POST",
    headers: authHeaders,
    jsonBody: {
      platform: "ios",
      productId: params.productId,
      transactionId: params.transactionId,
      receipt: params.receipt,
      purchaseTimeMs: params.purchaseTimeMs,
    },
  });
  if (!res.ok) throw new Error(`Validation failed (${res.status})`);
  return res.json();
}

function extractReceipt(p: any): string {
  return (
    p?.transactionReceipt ??
    p?.jwsRepresentationIos ??
    p?.jwsRepresentation ??
    p?.purchaseToken ??
    ""
  );
}

function extractTxnId(p: any): string {
  return p?.transactionId ?? p?.id ?? p?.originalTransactionIdentifierIos ?? "";
}

function extractTxnDate(p: any): number | undefined {
  return p?.transactionDate ?? p?.purchaseTime ?? undefined;
}

export async function purchaseProduct(
  productId: string,
  authToken?: string,
): Promise<{ ok: boolean; duplicate?: boolean; entitlement?: any }> {
  await initIAP();

  const isSubscription = PRODUCT_IDS.subscriptions.includes(productId);

  const result = isSubscription
    ? await requestPurchase({
        request: { ios: { sku: productId } },
        type: "subs",
      })
    : await requestPurchase({
        request: { ios: { sku: productId } },
        type: "in-app",
      });

  const purchase: any = Array.isArray(result) ? result[0] : result;
  if (!purchase) throw new Error("No purchase returned");

  const validation = await validateOnServer({
    productId,
    transactionId: extractTxnId(purchase),
    receipt: extractReceipt(purchase),
    purchaseTimeMs: extractTxnDate(purchase),
    authToken,
  });

  const isConsumable = PRODUCT_IDS.consumables.includes(productId);
  try {
    await finishTransaction({ purchase, isConsumable });
  } catch (e) {
    console.warn("finishTransaction failed:", e);
  }

  return validation;
}

export async function restorePurchases(
  authToken?: string,
): Promise<{ ok: boolean; restored: string[] }> {
  await initIAP();
  const purchases = await getAvailablePurchases();
  const latestReceipt = extractReceipt(purchases?.[0]);
  if (!latestReceipt) return { ok: true, restored: [] };

  const authHeaders = await buildAuthHeaders(authToken);
  const res = await signedFetch(`${getApiBase()}/api/iap/restore`, {
    method: "POST",
    headers: authHeaders,
    jsonBody: { receipt: latestReceipt },
  });
  if (!res.ok) throw new Error(`Restore failed (${res.status})`);
  return res.json();
}

export async function fetchEntitlements(authToken?: string) {
  const authHeaders = await buildAuthHeaders(authToken);
  const res = await signedFetch(`${getApiBase()}/api/iap/entitlements`, {
    headers: authHeaders,
  });
  if (!res.ok) throw new Error(`Entitlements fetch failed (${res.status})`);
  return res.json() as Promise<{
    entitlements: any[];
    spin_balance: number;
    pro_active: boolean;
  }>;
}
