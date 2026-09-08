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

// ── legacy Bearer migration ────────────────────────────────────────────────
// New sessions live only in the HttpOnly cookie. These helpers are retained
// temporarily so clients with a pre-migration localStorage token can exchange
// it for the cookie without being logged out abruptly.
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
 * Same-origin fetch wrapper. Cookies are sent automatically; a legacy Bearer
 * token is attached only while an old session is being migrated.
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
      const res = await fetch("/api/auth/me", {
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.user) {
        clearAuthToken();
        setUser(null);
      } else {
        if (token) clearAuthToken();
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
  return user?.role === "ADMIN" || user?.role === "LEAGUE_ADMIN";
}

export function useIsSuperAdmin(): boolean {
  const { user } = useAuth();
  return user?.role === "ADMIN";
}

export function useCanAdminLeague(leagueId: string | undefined): boolean {
  const { user } = useAuth();
  if (!user || !leagueId) return false;
  return user.role === "ADMIN" ||
    (user.role === "LEAGUE_ADMIN" && user.leagueId === leagueId);
}

export function useIsCaptainOfTeam(teamId: string | undefined): boolean {
  const { user } = useAuth();
  return user?.role === "CAPTAIN" && user.teamId === teamId;
}

export function useCanEditTeam(teamId: string | undefined, leagueId?: string): boolean {
  const { user } = useAuth();
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  if (user.role === "LEAGUE_ADMIN" && leagueId && user.leagueId === leagueId) return true;
  return user.role === "CAPTAIN" && user.teamId === teamId;
}

export function useCanCreateMedia(leagueId: string | undefined): boolean {
  const { user } = useAuth();
  if (!user || !leagueId) return false;
  return user.role === "ADMIN" ||
    (user.role === "LEAGUE_ADMIN" && user.leagueId === leagueId) ||
    (user.role === "CREATOR" && user.leagueId === leagueId);
}
