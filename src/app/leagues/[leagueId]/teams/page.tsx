"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import DashboardShell from "src/app/_components/dashboard-shell";

type TeamRow = {
  id: string;
  name: string;
  badgeUrl?: string | null;
  players?: Array<{ id: string }>;
  _count?: { players: number };
};

export default function TeamsPage() {
  const { leagueId } = useParams<{ leagueId: string }>();

  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [name, setName] = useState("");
  const [badgeUrl, setBadgeUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateTeam, setShowCreateTeam] = useState(false);

  async function load() {
    setErr(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/leagues/${leagueId}/teams`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error ?? "Errore caricamento squadre");
      setTeams(data);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!leagueId) return;
    load();
  }, [leagueId]);

  async function createTeam() {
    setErr(null);
    setMsg(null);

    const teamName = name.trim();
    if (!teamName) {
      setErr("Inserisci il nome squadra");
      return;
    }

    try {
      const res = await fetch(`/api/leagues/${leagueId}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: teamName,
          badgeUrl: badgeUrl.trim() ? badgeUrl.trim() : null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error ?? "Errore creazione squadra");

      setName("");
      setBadgeUrl("");
      setMsg("Squadra creata ✅");
      setShowCreateTeam(false);
      await load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  if (!leagueId) return <div>Caricamento…</div>;

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="space-y-6">
        <section className="rounded-[28px] border border-white/8 bg-[var(--card)]/95 p-5 md:p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
                Teams
              </div>
              <h1 className="mt-2 text-2xl md:text-3xl font-black text-[var(--foreground)]">
                Squadre
              </h1>
              <p className="mt-2 text-sm text-[var(--foreground)]/60">
                Visualizza e gestisci le squadre del torneo.
              </p>
            </div>

            <button
              onClick={() => setShowCreateTeam((v) => !v)}
              className="w-full sm:w-auto rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-[var(--foreground)]/80 hover:bg-white/10"
            >
              {showCreateTeam ? "Nascondi creazione squadra" : "Crea nuova squadra"}
            </button>
          </div>
        </section>

        {msg ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {msg}
          </div>
        ) : null}

        {err ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        ) : null}

        {showCreateTeam ? (
          <section className="rounded-[28px] border border-white/8 bg-[var(--card)]/95 p-5 shadow-2xl shadow-black/20">
            <div className="mb-4 text-xl font-black text-[var(--foreground)]">Crea nuova squadra</div>

            <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome squadra"
                className="h-14 rounded-2xl border border-white/10 bg-white/5 px-4 text-[var(--foreground)] outline-none placeholder:text-[var(--foreground)]/35 focus:border-[var(--accent)]/40"
              />

              <input
                value={badgeUrl}
                onChange={(e) => setBadgeUrl(e.target.value)}
                placeholder="Stemma (URL) opzionale"
                className="h-14 rounded-2xl border border-white/10 bg-white/5 px-4 text-[var(--foreground)] outline-none placeholder:text-[var(--foreground)]/35 focus:border-[var(--accent)]/40"
              />

              <button
                onClick={createTeam}
                className="h-14 rounded-2xl bg-[var(--accent)] px-6 font-bold text-black transition hover:bg-[var(--accent-2)]"
              >
                Crea squadra
              </button>
            </div>
          </section>
        ) : null}

        <section className="rounded-[28px] border border-white/8 bg-[var(--card)]/95 p-4 md:p-5 shadow-2xl shadow-black/20">
          <div className="mb-5 text-xl font-black text-[var(--foreground)]">Elenco squadre</div>

          {loading ? <div className="text-[var(--foreground)]/60">Caricamento…</div> : null}

          {!loading && teams.length === 0 ? (
            <div className="rounded-2xl bg-white/[0.04] px-4 py-4 text-[var(--foreground)]/55">
              Nessuna squadra presente.
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            {teams.map((t) => (
              <Link
                key={t.id}
                href={`/leagues/${leagueId}/teams/${t.id}`}
                className="flex items-center justify-between gap-4 rounded-[24px] border border-white/8 bg-[var(--card-2)] p-4 md:p-5 transition hover:-translate-y-0.5 hover:border-[var(--accent)]/30"
              >
                <div className="min-w-0">
                  <div className="text-lg md:text-xl font-bold text-[var(--foreground)] break-words">
                    {t.name}
                  </div>
                  <div className="mt-2 text-sm text-[var(--foreground)]/50">
                    Rosa: {t.players?.length ?? t._count?.players ?? 0}/16
                  </div>
                </div>

                {t.badgeUrl ? (
                  <img
                    src={t.badgeUrl}
                    alt=""
                    className="h-12 w-12 md:h-14 md:w-14 rounded-2xl border border-white/10 object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-2xl bg-white/5 text-xs font-bold text-[var(--foreground)]/35">
                    N/A
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}