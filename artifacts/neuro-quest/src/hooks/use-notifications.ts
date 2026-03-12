import { useState, useEffect, useCallback } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export type NotifPermission = "default" | "granted" | "denied" | "unsupported";

export interface UseNotificationsReturn {
  permission: NotifPermission;
  subscribed: boolean;
  loading: boolean;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<void>;
  supported: boolean;
}

export function useNotifications(): UseNotificationsReturn {
  const [permission, setPermission] = useState<NotifPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

  // Register SW once
  useEffect(() => {
    if (!supported) { setLoading(false); return; }
    setPermission(Notification.permission as NotifPermission);
    navigator.serviceWorker.register(`${BASE}/sw.js`, { scope: `${BASE}/` })
      .catch(console.error);
    // Check server subscription status
    fetch(`${BASE}/api/notifications/status`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setSubscribed(d.subscribed))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [supported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!supported) return false;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm as NotifPermission);
      if (perm !== "granted") { setLoading(false); return false; }

      // Fetch VAPID public key
      const keyRes = await fetch(`${BASE}/api/notifications/vapid-public-key`, { credentials: "include" });
      if (!keyRes.ok) throw new Error("No VAPID key");
      const { publicKey } = await keyRes.json();

      const reg = await navigator.serviceWorker.ready;
      const pushSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const subJson = pushSub.toJSON();
      await fetch(`${BASE}/api/notifications/subscribe`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        }),
      });

      setSubscribed(true);
      return true;
    } catch (err) {
      console.error("Subscribe error:", err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [supported]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch(`${BASE}/api/notifications/unsubscribe`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    setSubscribed(false);
  }, [supported]);

  return { permission, subscribed, loading, subscribe, unsubscribe, supported };
}
