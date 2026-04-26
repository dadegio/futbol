"use client";

import { useEffect, useMemo, useState } from "react";
import HeroBanner from "src/app/_components//hero-banner";
import HomeLeagueCard from "src/app/_components/home-league-card";
import Card from "src/app/_components/ui/card";
import Button from "src/app/_components/ui/button";
import Input from "src/app/_components/ui/input";
import Badge from "src/app/_components/ui/badge";
import { useIsAdmin, authFetch } from "@/lib/client-auth";

type League = { id: string; name: string };

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error ?? "Errore");
  return data as T;
}

async function postJSON<T>(url: string, body: any): Promise<T> {
  const res = await authFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error ?? "Errore");
  return data as T;
}

export default function HomePage() {
  const isAdmin = useIsAdmin();

  const [leagues, setLeagues] = useState<League[]>([]);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const [showCreateLeague, setShowCreateLeague] = useState(false);

  async function load() {
    setLoadingLeagues(true);
    try {
      const ls = await getJSON<League[]>("/api/leagues");
      setLeagues(ls);
    } finally {
      setLoadingLeagues(false);
    }
  }

  useEffect(() => {
    load().catch((e: any) => {
      setErr(e.message ?? "Errore caricamento tornei");
    });
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
      setShowCreateLeague(false);
      await load();
    } catch (e: any) {
      setErr(e.message ?? "Errore creazione torneo");
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
      const res = await authFetch(`/api/leagues/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error ?? "Errore eliminazione");
      await load();
    } catch (e: any) {
      setErr(e.message ?? "Errore eliminazione torneo");
    }
  }

  const subtitle = useMemo(() => {
    if (loadingLeagues) return "Caricamento tornei…";
    if (leagues.length === 0) return "Nessun torneo disponibile";
    if (leagues.length === 1) return "1 torneo disponibile";
    return `${leagues.length} tornei disponibili`;
  }, [leagues.length, loadingLeagues]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-5 sm:px-6">
      <HeroBanner />

      {err && (
        <Badge variant="error" className="w-full">
          {err}
        </Badge>
      )}

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center rounded-full bg-[var(--card-2)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                Dashboard
              </div>

              <div>
                <h1 className="text-3xl font-black tracking-[-0.05em] text-[var(--foreground)] sm:text-4xl">
                  Crea e gestisci i tuoi tornei
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-[var(--muted)] sm:text-base">
                  Organizza squadre, calendario, classifica, statistiche e playoff in
                  un’unica dashboard.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <SummaryPill label="Tornei" value={loadingLeagues ? "…" : String(leagues.length)} />
              <SummaryPill label="Ruolo" value={isAdmin ? "Admin" : "Viewer"} />
              <SummaryPill label="Stato" value="Attivo" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex h-full flex-col justify-between gap-5">
            <div>
              <div className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
                Controllo rapido
              </div>
              <h2 className="mt-1 text-2xl font-bold text-[var(--foreground)]">
                {subtitle}
              </h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Accedi ai tornei esistenti oppure creane uno nuovo per iniziare subito.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {isAdmin ? (
                <Button size="sm" onClick={() => setShowCreateLeague((v) => !v)}>
                  {showCreateLeague ? "Chiudi" : "Nuovo torneo"}
                </Button>
              ) : (
                <span className="rounded-full bg-[var(--card-2)] px-4 py-2 text-sm text-[var(--muted)]">
                  Accesso in sola lettura
                </span>
              )}

              <span className="rounded-full bg-[var(--card-2)] px-4 py-2 text-sm text-[var(--muted)]">
                {loadingLeagues ? "Caricamento…" : `${leagues.length} salvati`}
              </span>
            </div>
          </div>
        </Card>
      </section>

      {isAdmin && showCreateLeague && (
        <Card>
          <div className="mb-4">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
              Creazione
            </div>
            <h2 className="mt-1 text-2xl font-bold text-[var(--foreground)]">
              Nuovo torneo
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Inserisci il nome del torneo. Potrai poi aggiungere squadre, calendario e
              configurazioni.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome torneo"
              className="flex-1"
            />
            <Button onClick={create} disabled={loading} className="h-14 md:min-w-[180px]">
              {loading ? "Creazione..." : "Crea torneo"}
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
              Tornei
            </div>
            <h2 className="mt-1 text-2xl font-bold text-[var(--foreground)]">
              Tornei disponibili
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Apri un torneo per vedere overview, calendario, classifica, stats e
              playoff.
            </p>
          </div>
        </div>

        {loadingLeagues ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <LeagueCardSkeleton />
            <LeagueCardSkeleton />
          </div>
        ) : leagues.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-[var(--border-strong)] bg-[var(--card-2)] px-5 py-14 text-center">
            <div className="mx-auto max-w-md space-y-3">
              <div className="text-lg font-bold text-[var(--foreground)]">
                Nessun torneo salvato
              </div>
              <p className="text-sm text-[var(--muted)]">
                {isAdmin
                  ? "Crea il primo torneo per iniziare a gestire squadre, partite e classifiche."
                  : "Al momento non ci sono tornei disponibili da visualizzare."}
              </p>

              {isAdmin && (
                <div className="pt-2">
                  <Button onClick={() => setShowCreateLeague(true)}>Crea il primo torneo</Button>
                </div>
              )}
            </div>
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
      </Card>
    </div>
  );
}

function SummaryPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-[var(--card-2)] px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-1 text-lg font-black tracking-[-0.04em] text-[var(--foreground)]">
        {value}
      </div>
    </div>
  );
}

function LeagueCardSkeleton() {
  return (
    <div className="rounded-[22px] border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-24 rounded bg-white/10" />
        <div className="h-8 w-2/3 rounded bg-white/10" />
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="h-12 rounded bg-white/10" />
          <div className="h-12 rounded bg-white/10" />
        </div>
      </div>
    </div>
  );
}