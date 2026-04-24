"use client";

import { useEffect, useState } from "react";
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
      const res = await authFetch(`/api/leagues/${id}`, { method: "DELETE" });
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

        <Card>
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
              {isAdmin && (
                <Button size="sm" onClick={() => setShowCreateLeague((v) => !v)}>
                  {showCreateLeague ? "Chiudi" : "Nuovo torneo"}
                </Button>
              )}
            </div>
          </div>

          {isAdmin && showCreateLeague && (
            <Card variant="inner">
              <div className="mb-3 text-lg font-bold text-white">Nuovo torneo</div>

              <div className="flex flex-col gap-3 md:flex-row">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome torneo"
                  className="flex-1"
                />
                <Button onClick={create} disabled={loading} className="h-14">
                  {loading ? "Creazione..." : "Crea torneo"}
                </Button>
              </div>

              {err && <Badge variant="error" className="mt-3">{err}</Badge>}
            </Card>
          )}
        </Card>

        <Card>
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
        </Card>
      </div>
  );
}
