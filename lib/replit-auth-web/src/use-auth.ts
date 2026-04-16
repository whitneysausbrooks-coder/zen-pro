import { useState, useEffect, useCallback } from "react";

export interface AuthUser {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

function getApiBase(): string {
  if (typeof import.meta !== "undefined" && (import.meta as any).env?.BASE_URL) {
    return (import.meta as any).env.BASE_URL;
  }
  return "/";
}

let cachedAuthPromise: Promise<AuthUser | null> | null = null;

function fetchAuthUser(): Promise<AuthUser | null> {
  if (cachedAuthPromise) return cachedAuthPromise;
  const base = getApiBase().replace(/\/$/, "");
  cachedAuthPromise = fetch(`${base}/api/auth/user`, { credentials: "include" })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<{ user: AuthUser | null }>;
    })
    .then((data) => data.user ?? null)
    .catch(() => null);
  return cachedAuthPromise;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchAuthUser().then((resolvedUser) => {
      if (!cancelled) {
        setUser(resolvedUser);
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(() => {
    const base = getApiBase().replace(/\/$/, "");
    const returnTo = window.location.pathname || "/";
    window.location.href = `${base}/api/login?returnTo=${encodeURIComponent(returnTo)}`;
  }, []);

  const logout = useCallback(() => {
    const base = getApiBase().replace(/\/$/, "");
    cachedAuthPromise = null;
    window.location.href = `${base}/api/logout`;
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
  };
}
