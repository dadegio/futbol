"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card, { CardHeader } from "src/app/_components/ui/card";
import Button from "src/app/_components/ui/button";
import Input from "src/app/_components/ui/input";
import Badge from "src/app/_components/ui/badge";

type Row = {
  id: string;
  firstName: string;
  lastName: string;
  number: number;
  position?: string | null;
  photoUrl?: string | null;
  team: { id: string; name: string };
};

export default function PlayersPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const q = (sp.get("q") ?? "").trim();

  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState(q);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSearch(q);
  }, [q]);

  useEffect(() => {
    if (!leagueId) return;

    setErr(null);
    setLoading(true);

    fetch(`/api/leagues/${leagueId}/players?q=${encodeURIComponent(q)}`, {
      cache: "no-store",
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d?.error ?? "Errore");
        setRows(d);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [leagueId, q]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const value = search.trim();
    router.push(
      value
        ? `/leagues/${leagueId}/players?q=${encodeURIComponent(value)}`
        : `/leagues/${leagueId}/players`
    );
  }

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="space-y-6">
        <Card>
          <CardHeader
            tag="Players"
            title="Giocatori"
            description={loading ? "Caricamento…" : `Totale risultati: ${rows.length}`}
          />

          <form onSubmit={submitSearch} className="mt-5 flex flex-col gap-3 md:flex-row">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca per nome, cognome, numero o squadra"
              className="flex-1"
            />
            <Button className="h-14">Cerca</Button>
          </form>

          {err && <Badge variant="error" className="mt-4">{err}</Badge>}
        </Card>

        <Card>
          {rows.length === 0 && !loading && (
            <Card variant="flat">
              <span className="text-[var(--foreground)]/55">Nessun giocatore trovato.</span>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((p) => (
              <Link
                key={p.id}
                href={`/leagues/${leagueId}/players/${p.id}`}
                className="rounded-[24px] border border-white/8 bg-[var(--card-2)] p-4 md:p-5 transition hover:-translate-y-0.5 hover:border-[var(--accent)]/30"
              >
                <div className="flex items-start gap-4">
                  {p.photoUrl ? (
                    <img
                      src={p.photoUrl}
                      alt={`${p.firstName} ${p.lastName}`}
                      className="h-14 w-14 md:h-16 md:w-16 rounded-2xl border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-2xl bg-white/5 text-xs font-bold text-[var(--foreground)]/35">
                      N/A
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs uppercase tracking-[0.18em] text-[var(--foreground)]/40">
                          {p.team.name}
                        </div>
                        <div className="mt-2 text-lg md:text-xl font-bold text-[var(--foreground)] break-words">
                          {p.firstName} {p.lastName}
                        </div>
                        <div className="mt-2 text-sm text-[var(--foreground)]/50">
                          {p.position || "Ruolo non impostato"}
                        </div>
                      </div>

                      <Badge variant="accent" className="shrink-0 text-base md:text-lg">
                        #{p.number}
                      </Badge>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
