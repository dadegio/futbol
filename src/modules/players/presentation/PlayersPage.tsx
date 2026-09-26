"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { ChevronRight, Crown, Search, SlidersHorizontal, Users } from "lucide-react";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card, { CardHeader } from "src/app/_components/ui/card";
import Button from "src/app/_components/ui/button";
import Input from "src/app/_components/ui/input";
import Badge from "src/app/_components/ui/badge";
import OptimizedPlayerImage from "src/app/_components/optimized-player-image";
import { authFetch, useCanAdminLeague } from "@/lib/client-auth";

type Row = {
  id: string;
  firstName: string;
  lastName: string;
  number: number;
  position?: string | null;
  photoUrl?: string | null;
  photoZoom?: number;
  photoPositionX?: number;
  photoPositionY?: number;
  isTeamCaptain?: boolean;
  registrationStatus?: string;
  isEligibleForMatchSheet?: boolean;
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
  const status = (sp.get("status") ?? "").trim();
  const isAdmin = useCanAdminLeague(leagueId);
  const effectiveStatus = isAdmin ? status : "";

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

    authFetch(`/api/leagues/${leagueId}/players?q=${encodeURIComponent(q)}&status=${encodeURIComponent(effectiveStatus)}`, {
      cache: "no-store",
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d?.error ?? "Errore caricamento giocatori");
        setRows(Array.isArray(d) ? d : []);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [effectiveStatus, leagueId, q]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();

    const value = search.trim();

    router.push(
      value
        ? `/leagues/${leagueId}/players?q=${encodeURIComponent(value)}${isAdmin && status ? `&status=${status}` : ""}`
        : `/leagues/${leagueId}/players${isAdmin && status ? `?status=${status}` : ""}`
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

  const eagerPlayerIds = useMemo(
    () => new Set(rows.slice(0, 6).map((player) => player.id)),
    [rows]
  );

  if (!leagueId) return null;

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="w-full space-y-6 pb-8">
        <Card className="!border-0 !bg-transparent !p-0">
          <div className="flex flex-col gap-5 border-b border-[var(--border-strong)] pb-6 lg:flex-row lg:items-end lg:justify-between">
            <CardHeader
              tag="Giocatori"
              title="Giocatori"
              description={isAdmin ? "Tutte le rose del torneo, con ricerca e controlli amministrativi quando servono." : "Volti, numeri e ruoli del torneo. Cerca un giocatore e apri il suo profilo."}
              level={1}
            />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <InfoBox label="Risultati" value={loading ? "…" : String(rows.length)} />
              <InfoBox label="Squadre" value={String(grouped.length)} />
              <InfoBox label="Vista" value={q ? "Ricerca" : "Tutti"} />
            </div>
          </div>
        </Card>

        <Card className="!rounded-none !border-x-0 !bg-transparent !p-0 !py-4">
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

          {isAdmin && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                <SlidersHorizontal size={13} /> Stato iscrizione
              </span>
              {[
                ["", "Tutti"],
                ["ok", "Iscrizione OK"],
                ["todo", "Da completare"],
              ].map(([value, label]) => {
                const active = status === value;
                const href = `/leagues/${leagueId}/players${value ? `?status=${value}${q ? `&q=${encodeURIComponent(q)}` : ""}` : q ? `?q=${encodeURIComponent(q)}` : ""}`;
                return (
                  <Link key={value} href={href} className={[
                    "border-b-2 px-2 py-2 text-xs font-semibold transition",
                    active ? "border-[var(--accent)] text-[var(--foreground)]" : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]",
                  ].join(" ")}>{label}</Link>
                );
              })}
            </div>
          )}

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

                    <span className="font-mono text-xs text-[var(--muted)]">
                      {players.length}
                    </span>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                    {players.map((player) => (
                      <PlayerCard
                        key={player.id}
                        player={player}
                        leagueId={leagueId}
                        eagerPhoto={eagerPlayerIds.has(player.id)}
                        isAdmin={isAdmin}
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
  eagerPhoto = false,
  isAdmin,
}: {
  player: Row;
  leagueId: string;
  eagerPhoto?: boolean;
  isAdmin: boolean;
}) {
  const fullName = `${player.firstName} ${player.lastName}`;

  return (
    <Link
      href={`/leagues/${leagueId}/players/${player.id}`}
      className="group relative overflow-hidden rounded-[6px] border border-[var(--border)] bg-[var(--card)] transition-colors hover:border-[var(--accent)]/40"
    >
      <div className="grid min-h-[150px] grid-cols-[104px_minmax(0,1fr)] sm:grid-cols-[118px_minmax(0,1fr)]">
        <PlayerAvatar
          name={fullName}
          number={player.number}
          photoUrl={player.photoUrl ?? null}
          photoZoom={player.photoZoom ?? 1}
          photoPositionX={player.photoPositionX ?? 50}
          photoPositionY={player.photoPositionY ?? 50}
          eager={eagerPhoto}
        />

        <div className="flex min-w-0 flex-col justify-between p-4 sm:p-5">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-[var(--accent)]">
                    #{player.number}
                  </span>
                  {player.isTeamCaptain && (
                    <span className="inline-flex items-center gap-1 rounded-[3px] border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-amber-300">
                      <Crown size={10} /> Capitano
                    </span>
                  )}
                </div>

                <h3 className="mt-1.5 break-words text-lg font-black leading-tight tracking-[-0.04em] text-[var(--foreground)] sm:text-xl">
                  {fullName}
                </h3>
                <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                  {player.position || "Ruolo non impostato"}
                </p>
              </div>

              <ChevronRight
                size={18}
                className="mt-1 shrink-0 text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--accent)]"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
            <div className="flex min-w-0 items-center gap-2">
              <TeamLogo
                name={player.team.name}
                badgeUrl={player.team.badgeUrl ?? null}
              />
              <span className="min-w-0 truncate text-xs font-bold text-[var(--muted)]">
                {player.team.name}
              </span>
            </div>

            {isAdmin ? (
              <span className={[
                "inline-flex shrink-0 items-center gap-1.5 rounded-[3px] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em]",
                player.isEligibleForMatchSheet ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-amber-400/10 text-amber-300",
              ].join(" ")}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {player.registrationStatus ?? "Da completare"}
              </span>
            ) : (
              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--accent)]">Apri profilo</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l border-[var(--border)] pl-3 first:border-l-0">
      <div className="scoreboard-figure text-2xl font-semibold leading-none text-[var(--foreground)]">
        {value}
      </div>
      <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
      </div>
    </div>
  );
}

function PlayerAvatar({
  name,
  number,
  photoUrl,
  photoZoom = 1,
  photoPositionX = 50,
  photoPositionY = 50,
  eager = false,
}: {
  name: string;
  number: number;
  photoUrl: string | null;
  photoZoom?: number;
  photoPositionX?: number;
  photoPositionY?: number;
  eager?: boolean;
}) {
  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const frameClass =
    "relative h-full min-h-[150px] w-full overflow-hidden border-r border-[var(--border)] bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.08),transparent_55%)]";

  if (photoUrl) {
    return (
      <div className={frameClass}>
        <OptimizedPlayerImage
          src={photoUrl}
          alt={name}
          sizes="(max-width: 640px) 104px, 118px"
          eager={eager}
          className="absolute inset-0 h-full w-full object-contain"
          style={{
            objectPosition: `${photoPositionX}% ${photoPositionY}%`,
            transform: `scale(${Math.min(photoZoom, 1)})`,
            transformOrigin: `${photoPositionX}% ${photoPositionY}%`,
          }}
        />
        <span className="absolute bottom-2 left-2 rounded-xl border border-white/15 bg-black/55 px-2 py-1 text-[10px] font-black text-white backdrop-blur-sm">
          #{number}
        </span>
      </div>
    );
  }

  return (
    <div className={`${frameClass} flex items-center justify-center text-2xl font-black text-[var(--accent)]`}>
      {initials || "?"}
      <span className="absolute bottom-2 left-2 rounded-xl border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black text-[var(--foreground)]">
        #{number}
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
          <div className="h-[150px] w-[104px] rounded-l-[24px] bg-[var(--card-2)]" />
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