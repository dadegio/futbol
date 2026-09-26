"use client";

import Link from "next/link";
import { useAuth } from "@/lib/client-auth";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
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

      await refresh();
      router.push("/");
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : "Errore login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-[var(--background)] text-[var(--foreground)] lg:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
      <section className="relative flex min-h-[42vh] flex-col justify-between overflow-hidden border-b border-[var(--border-strong)] px-5 py-6 sm:px-8 sm:py-8 lg:min-h-screen lg:border-b-0 lg:border-r lg:px-12 lg:py-10 xl:px-16">
        <div className="absolute inset-y-0 right-[18%] hidden w-px bg-[var(--border)] lg:block" />
        <div className="absolute right-[18%] top-1/2 hidden h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--border)] lg:block" />

        <div className="relative flex items-baseline justify-between gap-4">
          <Link href="/" className="scoreboard-figure text-3xl leading-none text-[var(--accent)]">
            FUTPOLI
          </Link>
          <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Area riservata
          </span>
        </div>

        <div className="relative my-12 max-w-3xl lg:my-0">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Staff / capitani / arbitri / coach
          </p>
          <h1 className="scoreboard-figure text-[clamp(4.8rem,10vw,10rem)] font-semibold leading-[0.7] tracking-[-0.02em]">
            DIETRO
            <br />
            LE QUINTE.
          </h1>
          <p className="mt-6 max-w-lg text-sm leading-relaxed text-[var(--muted)] sm:text-base">
            L&apos;area operativa del torneo: convocazioni, partite, risultati,
            prenotazioni e gestione quotidiana.
          </p>
        </div>

        <div className="relative flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--border)] pt-4 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          <span>Calendario</span>
          <span>Squadre</span>
          <span>Match center</span>
          <span>Statistiche</span>
        </div>
      </section>

      <section className="flex items-center px-5 py-10 sm:px-8 lg:px-12 xl:px-16">
        <div className="mx-auto w-full max-w-[430px]">
          <Link
            href="/"
            className="mb-12 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <span aria-hidden="true">←</span>
            Torna ai tornei
          </Link>

          <div className="mb-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
              Login
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
              Accedi al tuo ruolo.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
              Usa le credenziali assegnate dall&apos;organizzazione del torneo.
            </p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="space-y-6">
              <label className="block">
                <span className="mb-2 block text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  Username
                </span>
                <input
                  autoFocus
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  className="h-12 w-full border-b border-[var(--border-strong)] bg-transparent px-0 text-base text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  Password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  className="h-12 w-full border-b border-[var(--border-strong)] bg-transparent px-0 text-base text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
                />
              </label>
            </div>

            {err && (
              <div className="mt-6 border-l-2 border-[var(--danger)] py-1 pl-4 text-sm text-[var(--danger)]">
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-8 flex h-12 w-full items-center justify-between border border-[var(--accent-2)] bg-[var(--accent-2)] px-4 text-sm font-semibold text-[var(--foreground)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>{loading ? "Accesso in corso…" : "Accedi"}</span>
              <span aria-hidden="true">→</span>
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
