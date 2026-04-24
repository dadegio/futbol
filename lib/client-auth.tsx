"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Role, SessionUser } from "./session";

export type { Role, SessionUser };

// ── localStorage key ────────────────────────────────────────────────────────
const STORAGE_KEY = "futbol-token";

// ── token helpers (browser-only) ─────────────────────────────────────────────
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Drop-in replacement for fetch() that automatically attaches
 * Authorization: Bearer <token> when a token is in localStorage.
 */
export function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}

// ── Auth context ─────────────────────────────────────────────────────────────
type AuthState = {
  user: SessionUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        setUser(null);
        return;
      }
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.user) {
        clearAuthToken(); // token expired / invalid
        setUser(null);
      } else {
        setUser(data.user);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── hooks ─────────────────────────────────────────────────────────────────────
export function useAuth(): AuthState {
  return useContext(AuthContext);
}

export function useIsAdmin(): boolean {
  const { user } = useAuth();
  return user?.role === "ADMIN";
}

export function useIsCaptainOfTeam(teamId: string | undefined): boolean {
  const { user } = useAuth();
  return user?.role === "CAPTAIN" && user.teamId === teamId;
}

export function useCanEditTeam(teamId: string | undefined): boolean {
  const { user } = useAuth();
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return user.role === "CAPTAIN" && user.teamId === teamId;
}
