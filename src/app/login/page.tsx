"use client";

import { useAuth, setAuthToken } from "@/lib/client-auth";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Errore login");

      setAuthToken(data.token);
      await refresh();
      router.push("/");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <span className="text-[32px] font-extrabold italic tracking-tight text-[var(--accent)]">
            FUTBOL
          </span>
          <p className="mt-2 text-sm text-[var(--foreground)]/50">
            Accedi per gestire il torneo
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="rounded-[28px] border border-[var(--border)] bg-[var(--card)]/95 p-7 shadow-2xl shadow-black/20"
        >
          <h1 className="mb-6 text-2xl font-extrabold text-[var(--foreground)]">
            Accedi
          </h1>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--foreground)]/50">
                Username
              </label>
              <input
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="h-14 w-full rounded-2xl border border-[var(--border)] bg-white/5 px-4 text-[var(--foreground)] outline-none placeholder:text-[var(--foreground)]/30 focus:border-[var(--accent)]/60"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--foreground)]/50">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="h-14 w-full rounded-2xl border border-[var(--border)] bg-white/5 px-4 text-[var(--foreground)] outline-none placeholder:text-[var(--foreground)]/30 focus:border-[var(--accent)]/60"
              />
            </div>
          </div>

          {err && (
            <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 h-14 w-full rounded-2xl bg-[var(--accent)] font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Accesso in corso..." : "Accedi"}
          </button>

          <p className="mt-5 text-center text-xs text-[var(--foreground)]/35">
            Il sito è pubblico — solo admin e capitani effettuano il login.
          </p>
        </form>
      </div>
    </div>
  );
}
