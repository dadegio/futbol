"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Search, Users } from "lucide-react";
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
  team: {
    id: string;
    name: string;
    badgeUrl?: string | null;
  };
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
        if (!ok) throw new Error(d?.error ?? "Errore caricamento giocatori");
        setRows(Array.isArray(d) ? d : []);
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

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();

    for (const player of rows) {
      const key = player.team?.name ?? "Senza squadra";
      map.set(key, [...(map.get(key) ?? []), player]);
    }

    return Array.from(map.entries())
      .map(([teamName, players]) => [
        teamName,
        players.sort((a, b) => {
          if (a.number !== b.number) return a.number - b.number;
          return `${a.lastName} ${a.firstName}`.localeCompare(
            `${b.lastName} ${b.firstName}`
          );
        }),
      ] as [string, Row[]])
      .sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  if (!leagueId) return null;

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="w-full space-y-6 pb-8">
        <Card>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <CardHeader
              tag="Giocatori"
              title="Rosa torneo"
              description="Cerca e consulta tutti i giocatori divisi per squadra."
              level={1}
            />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <InfoBox label="Risultati" value={loading ? "…" : String(rows.length)} />
              <InfoBox label="Squadre" value={String(grouped.length)} />
              <InfoBox label="Filtro" value={q ? "Attivo" : "Tutti"} />
            </div>
          </div>
        </Card>

        <Card>
          <form onSubmit={submitSearch} className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search
                size={17}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
              />

              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca per nome, cognome, numero o squadra"
                className="h-12 w-full pl-11"
              />
            </div>

            <Button className="h-12 md:min-w-[150px]">Cerca</Button>
          </form>

          {err && (
            <Badge variant="error" className="mt-4">
              {err}
            </Badge>
          )}
        </Card>

        {loading && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <PlayerSkeleton />
            <PlayerSkeleton />
            <PlayerSkeleton />
          </div>
        )}

        {!loading && rows.length === 0 && (
          <Card>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--card-2)] text-[var(--accent)]">
                <Users size={18} />
              </div>

              <div>
                <h2 className="font-black text-[var(--foreground)]">
                  Nessun giocatore trovato
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Prova a modificare la ricerca oppure aggiungi giocatori dalle pagine squadra.
                </p>
              </div>
            </div>
          </Card>
        )}

        {!loading && grouped.length > 0 && (
          <div className="space-y-6">
            {grouped.map(([teamName, players]) => {
              const firstPlayer = players[0];

              return (
                <section key={teamName} className="space-y-3">
                  <div className="flex items-center justify-between gap-3 px-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <TeamLogo
                        name={teamName}
                        badgeUrl={firstPlayer?.team?.badgeUrl ?? null}
                      />

                      <h2 className="truncate text-base font-black tracking-[-0.03em] text-[var(--foreground)]">
                        {teamName}
                      </h2>
                    </div>

                    <span className="rounded-full bg-[var(--card-2)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
                      {players.length}
                    </span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {players.map((player) => (
                      <PlayerCard
                        key={player.id}
                        player={player}
                        leagueId={leagueId}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function PlayerCard({
  player,
  leagueId,
}: {
  player: Row;
  leagueId: string;
}) {
  const fullName = `${player.firstName} ${player.lastName}`;

  return (
    <Link
      href={`/leagues/${leagueId}/players/${player.id}`}
      className="group rounded-[18px] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5 hover:border-[var(--accent)]/40 hover:shadow-[0_10px_30px_rgba(0,0,0,0.08)]"
    >
      <div className="flex items-start gap-4">
        <PlayerAvatar
          name={fullName}
          number={player.number}
          photoUrl={player.photoUrl ?? null}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-black tracking-[-0.03em] text-[var(--foreground)]">
                {fullName}
              </h3>

              <p className="mt-1 text-sm font-medium text-[var(--muted)]">
                {player.position || "Ruolo non impostato"}
              </p>
            </div>

            <span className="rounded-xl bg-[var(--accent)] px-2.5 py-1 text-sm font-black text-white">
              #{player.number}
            </span>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-[var(--card-2)] px-3 py-2">
            <TeamLogo
              name={player.team.name}
              badgeUrl={player.team.badgeUrl ?? null}
            />

            <span className="min-w-0 truncate text-xs font-semibold text-[var(--muted)]">
              {player.team.name}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--card-2)] px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </div>

      <div className="mt-1 text-lg font-black tracking-[-0.04em] text-[var(--foreground)]">
        {value}
      </div>
    </div>
  );
}

function PlayerAvatar({
  name,
  number,
  photoUrl,
}: {
  name: string;
  number: number;
  photoUrl: string | null;
}) {
  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (photoUrl) {
    return (
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card-2)]">
        <img src={photoUrl} alt={name} className="h-full w-full object-cover" />

        <span className="absolute bottom-0 right-0 flex h-6 min-w-6 items-center justify-center rounded-tl-xl bg-[var(--accent)] px-1 text-[10px] font-black text-white">
          {number}
        </span>
      </div>
    );
  }

  return (
    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card-2)] text-lg font-black text-[var(--accent)]">
      {initials || "?"}

      <span className="absolute bottom-0 right-0 flex h-6 min-w-6 items-center justify-center rounded-tl-xl bg-[var(--accent)] px-1 text-[10px] font-black text-white">
        {number}
      </span>
    </div>
  );
}

function TeamLogo({
  name,
  badgeUrl,
}: {
  name: string;
  badgeUrl: string | null;
}) {
  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (badgeUrl) {
    return (
      <img
        src={badgeUrl}
        alt={`Logo ${name}`}
        className="h-7 w-7 shrink-0 rounded-lg object-contain"
      />
    );
  }

  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--card)] text-[9px] font-black text-[var(--muted)]">
      {initials || "?"}
    </span>
  );
}

function PlayerSkeleton() {
  return (
    <div className="rounded-[18px] border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="animate-pulse">
        <div className="flex gap-4">
          <div className="h-16 w-16 rounded-2xl bg-[var(--card-2)]" />
          <div className="flex-1 space-y-3">
            <div className="h-4 w-2/3 rounded bg-[var(--card-2)]" />
            <div className="h-3 w-1/2 rounded bg-[var(--card-2)]" />
            <div className="h-10 rounded-2xl bg-[var(--card-2)]" />
          </div>
        </div>
      </div>
    </div>
  );
}