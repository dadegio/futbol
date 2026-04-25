"use client";

import { setAuthToken, useAuth } from "@/lib/client-auth";
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
      <div className="w-full max-w-[380px]">
        {/* Logo */}
        <div className="mb-8 text-center">
          <span className="text-3xl font-bold italic tracking-tight text-[var(--accent)]">
            FUTBOL
          </span>
          <p className="mt-2 text-sm text-[var(--foreground)]/45">
            Accedi per gestire il torneo
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm"
        >
          <h1 className="mb-5 text-xl font-semibold text-[var(--foreground)]">Accedi</h1>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]/50">
                Username
              </label>
              <input
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--foreground)]/30 focus:border-[var(--accent)]/50"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]/50">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--foreground)]/30 focus:border-[var(--accent)]/50"
              />
            </div>
          </div>

          {err && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-5 h-10 w-full rounded-xl bg-[var(--accent)] text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-2)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Accesso in corso..." : "Accedi"}
          </button>
        </form>
      </div>
    </div>
  );
}
