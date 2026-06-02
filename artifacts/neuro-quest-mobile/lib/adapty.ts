import { Platform } from "react-native";
import Constants from "expo-constants";
import type {
  AdaptyPaywall,
  AdaptyPaywallProduct,
  AdaptyProfile,
} from "react-native-adapty";

/**
 * Adapty is the single source of truth for purchases + entitlements on iOS.
 *
 * react-native-adapty ships a native module that does NOT exist in Expo Go or
 * on web, so importing/using it there throws. Every call in this module is
 * therefore guarded by `supported` and degrades to a no-op, and the SDK is
 * lazily `require`d so the native binding is only touched on a real (EAS) build.
 * Real purchase testing happens on a dev client / TestFlight, never in Expo Go.
 */

const ADAPTY_SDK_KEY = process.env.EXPO_PUBLIC_ADAPTY_SDK_KEY ?? "";

// Adapty access level that grants "Pro". Configured in the Adapty dashboard;
// defaults to Adapty's conventional "premium" id.
export const ADAPTY_ACCESS_LEVEL =
  process.env.EXPO_PUBLIC_ADAPTY_ACCESS_LEVEL ?? "premium";

// Adapty placement id whose remote paywall lists the Pro products. Configured
// in the Adapty dashboard; this is what powers paywall A/B testing.
export const PRO_PLACEMENT_ID =
  process.env.EXPO_PUBLIC_ADAPTY_PLACEMENT ?? "zenpro";

// Expo Go reports appOwnership === "expo"; dev clients / standalone do not.
const isExpoGo = Constants.appOwnership === "expo";
const supported =
  Platform.OS !== "web" && !isExpoGo && ADAPTY_SDK_KEY.length > 0;

let activated = false;

type AdaptyClient = typeof import("react-native-adapty").adapty;

function getAdapty(): AdaptyClient {
  // Lazy require: keeps the native module off the import graph in Expo Go/web.
  return (require("react-native-adapty") as typeof import("react-native-adapty"))
    .adapty;
}

/** True only on a native build with an SDK key configured. */
export function isAdaptySupported(): boolean {
  return supported;
}

export async function activateAdapty(): Promise<boolean> {
  if (!supported || activated) return activated;
  try {
    await getAdapty().activate(ADAPTY_SDK_KEY);
    activated = true;
  } catch (e) {
    console.warn("Adapty activate failed:", e);
  }
  return activated;
}

/**
 * Bind the Adapty profile to our app user id so server webhooks arrive with
 * `customer_user_id` set to the same id the API stores entitlements against.
 */
export async function identifyAdapty(customerUserId: string): Promise<void> {
  if (!supported || !customerUserId) return;
  try {
    if (!activated) await activateAdapty();
    if (activated) await getAdapty().identify(customerUserId);
  } catch (e) {
    console.warn("Adapty identify failed:", e);
  }
}

export type ProPlacement = {
  paywall: AdaptyPaywall;
  products: AdaptyPaywallProduct[];
};

/**
 * Fetch the remote paywall + its products for the Pro placement and log the
 * paywall view so Adapty's funnel / A-B analytics populate.
 */
export async function getProPlacement(
  placementId: string = PRO_PLACEMENT_ID,
): Promise<ProPlacement | null> {
  if (!supported) return null;
  try {
    if (!activated) await activateAdapty();
    if (!activated) return null;
    const adapty = getAdapty();
    const paywall = await adapty.getPaywall(placementId);
    const products = await adapty.getPaywallProducts(paywall);
    adapty.logShowPaywall(paywall).catch(() => {});
    return { paywall, products };
  } catch (e) {
    console.warn("Adapty getPaywall failed:", e);
    return null;
  }
}

export async function purchaseProduct(
  product: AdaptyPaywallProduct,
): Promise<{ ok: boolean; proActive: boolean }> {
  if (!supported) return { ok: false, proActive: false };
  if (!activated) await activateAdapty();
  await getAdapty().makePurchase(product);
  return { ok: true, proActive: await isProActive() };
}

export async function restorePurchases(): Promise<{
  ok: boolean;
  proActive: boolean;
}> {
  if (!supported) return { ok: false, proActive: false };
  try {
    if (!activated) await activateAdapty();
    if (!activated) return { ok: false, proActive: false };
    await getAdapty().restorePurchases();
    return { ok: true, proActive: await isProActive() };
  } catch (e) {
    console.warn("Adapty restore failed:", e);
    return { ok: false, proActive: false };
  }
}

/** Whether the user currently holds the Pro access level (Adapty profile). */
export async function isProActive(): Promise<boolean> {
  if (!supported) return false;
  try {
    if (!activated) await activateAdapty();
    if (!activated) return false;
    const profile = await getAdapty().getProfile();
    return profile.accessLevels?.[ADAPTY_ACCESS_LEVEL]?.isActive === true;
  } catch (e) {
    console.warn("Adapty getProfile failed:", e);
    return false;
  }
}

export async function getAdaptyProfile(): Promise<AdaptyProfile | null> {
  if (!supported) return null;
  try {
    if (!activated) await activateAdapty();
    if (!activated) return null;
    return await getAdapty().getProfile();
  } catch {
    return null;
  }
}
