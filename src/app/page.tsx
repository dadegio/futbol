"use client";

import { useEffect, useState } from "react";
import DashboardShell from "src/app/_components/dashboard-shell";
import HeroBanner from "src/app/_components//hero-banner";
import HomeLeagueCard from "src/app/_components/home-league-card";

type League = { id: string; name: string };

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error ?? "Errore");
  return data as T;
}

async function postJSON<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error ?? "Errore");
  return data as T;
}

export default function HomePage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreateLeague, setShowCreateLeague] = useState(false);

  async function load() {
    const ls = await getJSON<League[]>("/api/leagues");
    setLeagues(ls);
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function create() {
    setErr(null);
    const n = name.trim();
    if (!n) {
      setErr("Inserisci un nome torneo");
      return;
    }

    try {
      setLoading(true);
      await postJSON("/api/leagues", { name: n });
      setName("");
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function removeLeague(id: string, leagueName: string) {
    setErr(null);

    const ok = window.confirm(
      `Eliminare il torneo "${leagueName}"?\n\nVerranno cancellati anche squadre, giocatori, partite e statistiche.`
    );
    if (!ok) return;

    try {
      const res = await fetch(`/api/leagues/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error ?? "Errore eliminazione");
      await load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
      <div className="mx-auto max-w-[1400px] space-y-6 p-6">
        <HeroBanner />

        <section className="rounded-[28px] border border-white/8 bg-[#121214]/95 p-5 shadow-2xl shadow-black/20">
          <div className="mb-4 flex items-center justify-between gap-4">
  <div>
    <div className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
      Dashboard
    </div>
    <h2 className="mt-1 text-2xl font-extrabold text-white">
      Crea e gestisci i tuoi tornei
    </h2>
  </div>

  <div className="flex items-center gap-3">
    <div className="rounded-full bg-white/6 px-4 py-2 text-sm text-white/60">
      {leagues.length} tornei salvati
    </div>

    <button
      onClick={() => setShowCreateLeague((v) => !v)}
      className="rounded-2xl bg-[var(--accent)] px-4 py-2 text-sm font-bold text-black"
    >
      {showCreateLeague ? "Chiudi" : "Nuovo torneo"}
    </button>
  </div>
</div>

          {showCreateLeague ? (
          <div className="rounded-[24px] border border-white/8 bg-[#17171a] p-4">
            <div className="mb-3 text-lg font-bold text-white">Nuovo torneo</div>

            <div className="flex flex-col gap-3 md:flex-row">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome torneo"
                className="h-14 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-white outline-none placeholder:text-white/35 focus:border-[var(--accent)]/40"
              />

              <button
                onClick={create}
                disabled={loading}
                className="h-14 rounded-2xl bg-[var(--accent)] px-6 font-bold text-black transition hover:bg-[var(--accent-2)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Creazione..." : "Crea torneo"}
              </button>
            </div>

            {err ? (
              <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {err}
              </div>
            ) : null}
  </div>
) : null}
        </section>

        <section className="rounded-[28px] border border-white/8 bg-[#121214]/95 p-5 shadow-2xl shadow-black/20">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
                Saved Leagues
              </div>
              <h2 className="mt-1 text-2xl font-extrabold text-white">
                Tornei disponibili
              </h2>
            </div>
          </div>

          {leagues.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] px-5 py-12 text-center text-white/55">
              Nessun torneo salvato. Crea il primo per iniziare.
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {leagues.map((league) => (
                <HomeLeagueCard
                  key={league.id}
                  id={league.id}
                  name={league.name}
                  onDelete={() => removeLeague(league.id, league.name)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
  );
}