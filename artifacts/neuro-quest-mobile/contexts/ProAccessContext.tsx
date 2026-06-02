import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { isProActive } from "@/lib/adapty";
import { getServerEntitlements } from "@/lib/userAuth";

/**
 * App-wide source of truth for "does this user hold the Pro access level?".
 *
 * Premium gates (unlimited plays, themes, ad-free, etc.) read `isPro` from this
 * context instead of each calling Adapty directly, so a single successful
 * purchase/restore unlocks everything at once.
 *
 * Resolution order:
 *  - The on-device Adapty profile (`isProActive`) is authoritative for the
 *    device that made the purchase — it reflects the unlock immediately.
 *  - The server mirror (`getServerEntitlements` → GET /iap/entitlements) is the
 *    cross-device fallback so a second device / fresh reinstall sees Pro too.
 *  - A cached flag in AsyncStorage seeds `isPro` instantly on cold start so the
 *    UI doesn't flash "locked" for a paying member before the async checks land.
 */

const PRO_CACHE_KEY = "nq_pro_active_cache";

interface ProAccessValue {
  /** Whether the user currently holds the Pro access level. */
  isPro: boolean;
  /** True until the first Adapty + server reconciliation completes. */
  loading: boolean;
  /** Re-check Adapty + server and update state. Resolves to the new value. */
  refresh: () => Promise<boolean>;
  /** Optimistically set Pro (e.g. right after a confirmed purchase). */
  setProActive: (active: boolean) => void;
}

const ProAccessContext = createContext<ProAccessValue | undefined>(undefined);

export function ProAccessProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const persist = useCallback((active: boolean) => {
    AsyncStorage.setItem(PRO_CACHE_KEY, active ? "1" : "0").catch(() => {});
  }, []);

  // Seed from the cached flag so Pro features are available instantly on boot,
  // before the (async) authoritative checks resolve.
  useEffect(() => {
    AsyncStorage.getItem(PRO_CACHE_KEY)
      .then((v) => {
        if (mounted.current && v === "1") setIsPro(true);
      })
      .catch(() => {});
  }, []);

  const refresh = useCallback(async (): Promise<boolean> => {
    const [adaptyActive, server] = await Promise.all([
      isProActive().catch(() => false),
      getServerEntitlements().catch(() => null),
    ]);
    const active = adaptyActive || (server?.proActive ?? false);
    if (mounted.current) {
      setIsPro(active);
      setLoading(false);
    }
    persist(active);
    return active;
  }, [persist]);

  useEffect(() => {
    refresh().catch(() => {
      if (mounted.current) setLoading(false);
    });
  }, [refresh]);

  const setProActive = useCallback(
    (active: boolean) => {
      if (mounted.current) setIsPro(active);
      persist(active);
    },
    [persist],
  );

  const value = useMemo<ProAccessValue>(
    () => ({ isPro, loading, refresh, setProActive }),
    [isPro, loading, refresh, setProActive],
  );

  return (
    <ProAccessContext.Provider value={value}>
      {children}
    </ProAccessContext.Provider>
  );
}

export function useProAccess(): ProAccessValue {
  const ctx = useContext(ProAccessContext);
  if (!ctx) {
    throw new Error("useProAccess must be used within a ProAccessProvider");
  }
  return ctx;
}
