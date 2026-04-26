"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card from "src/app/_components/ui/card";

type League = {
  id: string;
  name: string;
};

type Team = {
  id: string;
  name: string;
  badgeUrl?: string | null;
};

type Match = {
  id: string;
  leagueId: string;
  round: number;
  date: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
  homeTeam: Team;
  awayTeam: Team;
};

type TableRow = {
  teamId: string;
  teamName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error((data as any)?.error ?? "Errore caricamento dati");
  }

  return data as T;
}

function isPlayed(match: Match) {
  return match.homeGoals !== null && match.awayGoals !== null;
}

function isToday(date: Date) {
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function isLiveMatch(match: Match) {
  if (!match.date) return false;

  const start = new Date(match.date);

  if (Number.isNaN(start.getTime())) return false;
  if (!isToday(start)) return false;

  const now = new Date();
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

  return now >= start && now <= end;
}

function getLiveMinute(match: Match) {
  if (!match.date) return null;

  const start = new Date(match.date);
  const now = new Date();

  if (Number.isNaN(start.getTime())) return null;

  const diffMinutes = Math.floor((now.getTime() - start.getTime()) / 60000);

  if (diffMinutes < 0 || diffMinutes > 120) return null;
  if (diffMinutes <= 45) return `${diffMinutes}'`;
  if (diffMinutes <= 60) return "45'+";
  if (diffMinutes <= 105) return `${diffMinutes - 15}'`;

  return "90'+";
}

function formatMatchDateTime(date: string | null) {
  if (!date) return "DATA DA DEFINIRE";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "DATA DA DEFINIRE";

  const weekday = parsed
    .toLocaleDateString("it-IT", { weekday: "short" })
    .toUpperCase()
    .replace(".", "");

  const day = parsed.toLocaleDateString("it-IT", { day: "2-digit" });

  const month = parsed
    .toLocaleDateString("it-IT", { month: "short" })
    .toUpperCase()
    .replace(".", "");

  const time = parsed.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${weekday} ${day} ${month} · ${time}`;
}

export default function LeagueHomePage() {
  const { leagueId } = useParams<{ leagueId: string }>();

  const [league, setLeague] = useState<League | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [table, setTable] = useState<TableRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!leagueId) return;

    async function load() {
      try {
        setErr(null);

        const [leagueData, teamsData, matchesData, tableData] = await Promise.all([
          getJSON<League>(`/api/leagues/${leagueId}`),
          getJSON<any[]>(`/api/leagues/${leagueId}/teams`),
          getJSON<Match[]>(`/api/leagues/${leagueId}/schedule`),
          getJSON<TableRow[]>(`/api/leagues/${leagueId}/table`),
        ]);

        setLeague(leagueData);
        setTeams(
          teamsData.map((team) => ({
            id: team.id,
            name: team.name,
            badgeUrl: team.badgeUrl ?? null,
          }))
        );
        setMatches(matchesData);
        setTable(tableData);
      } catch (error: any) {
        setErr(error.message);
      }
    }

    load();
  }, [leagueId]);

  const rounds = useMemo(
    () => [...new Set(matches.map((match) => match.round))].sort((a, b) => a - b),
    [matches]
  );

  const totalRounds = rounds.length || Math.max(teams.length * 2 - 2, 1);

  const currentRound = useMemo(() => {
    if (rounds.length === 0) return 1;

    for (const round of rounds) {
      const roundMatches = matches.filter((match) => match.round === round);
      const allPlayed =
        roundMatches.length > 0 && roundMatches.every((match) => isPlayed(match));

      if (!allPlayed) return round;
    }

    return rounds[rounds.length - 1] ?? 1;
  }, [matches, rounds]);

  const playedMatches = useMemo(
    () => matches.filter((match) => isPlayed(match)),
    [matches]
  );

  const totalGoals = useMemo(
    () =>
      playedMatches.reduce(
        (sum, match) => sum + (match.homeGoals ?? 0) + (match.awayGoals ?? 0),
        0
      ),
    [playedMatches]
  );

  const liveMatch = useMemo(() => {
    return matches.find((match) => isLiveMatch(match)) ?? null;
  }, [matches]);

  const liveMinute = useMemo(() => {
    return liveMatch ? getLiveMinute(liveMatch) : null;
  }, [liveMatch]);

  const nextMatches = useMemo(
    () => matches.filter((match) => !isPlayed(match)).slice(0, 2),
    [matches]
  );

  if (!leagueId) return null;

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="mx-auto w-full max-w-[480px] space-y-6 px-4 pb-8">
        <header className="pt-2">
          <Link
            href="/"
            className="mb-8 flex items-center gap-3 text-sm text-[var(--muted)]"
          >
            <span className="text-xl leading-none">‹</span>
            <span>{league?.name ?? "Torneo"}</span>
          </Link>

          <div className="flex items-center justify-between gap-4">
            <h1 className="text-[31px] font-black tracking-[-0.06em] text-[var(--foreground)]">
              {league?.name ?? "Coppa Primavera"}
            </h1>

            <span className="rounded-full bg-[#d9f6df] px-4 py-2 text-sm font-bold text-green-800">
              In corso
            </span>
          </div>
        </header>

        {err && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {err}
          </div>
        )}

        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-base font-semibold">Stagione regolare</div>
            <div className="text-sm font-semibold text-[var(--muted)]">
              G{currentRound}
              <span className="mx-2 text-[var(--muted)]">/</span>
              {totalRounds}
            </div>
          </div>

          <div className="h-1 rounded-full bg-[#ece9df]">
            <div
              className="h-1 rounded-full bg-[var(--accent)]"
              style={{
                width: `${Math.min((currentRound / totalRounds) * 100, 100)}%`,
              }}
            />
          </div>

          <div className="grid grid-cols-3 gap-4 pt-1">
            <SummaryStat label="Squadre" value={teams.length} />
            <SummaryStat label="Partite" value={matches.length} />
            <SummaryStat label="Goal" value={totalGoals} />
          </div>
        </Card>

        {liveMatch && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-[-0.03em]">In diretta</h2>

              <Link
                href={`/leagues/${leagueId}/calendar`}
                className="text-sm font-semibold text-[var(--accent)]"
              >
                Dettagli →
              </Link>
            </div>

            <Card>
              <div className="mb-4 flex items-center justify-between text-sm">
                <span className="font-semibold text-red-600">
                  <span className="mr-2 inline-block h-2 w-2 rounded-full bg-red-600" />
                  {liveMinute ?? "Live"}
                </span>
                <span className="font-semibold text-[var(--muted)]">
                  G{liveMatch.round}
                </span>
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                  <TeamBadge
                    name={liveMatch.homeTeam.name}
                    badgeUrl={liveMatch.homeTeam.badgeUrl ?? null}
                  />
                  <span className="max-w-full truncate text-sm font-semibold">
                    {liveMatch.homeTeam.name}
                  </span>
                </div>

                <div className="whitespace-nowrap px-1 text-center text-[36px] font-black tracking-[-0.06em]">
                  {liveMatch.homeGoals ?? 0}
                  <span className="mx-2 text-[var(--muted)]">-</span>
                  {liveMatch.awayGoals ?? 0}
                </div>

                <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                  <TeamBadge
                    name={liveMatch.awayTeam.name}
                    badgeUrl={liveMatch.awayTeam.badgeUrl ?? null}
                  />
                  <span className="max-w-full truncate text-sm font-semibold">
                    {liveMatch.awayTeam.name}
                  </span>
                </div>
              </div>
            </Card>
          </section>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-[-0.03em]">Classifica</h2>

            <Link
              href={`/leagues/${leagueId}/table`}
              className="text-sm font-semibold text-[var(--accent)]"
            >
              Vedi tutta →
            </Link>
          </div>

          <Card className="overflow-hidden !p-0">
            {table.slice(0, 5).map((row, index) => {
              const team = teams.find((t) => t.id === row.teamId);

              return (
                <div
                  key={row.teamId}
                  className="grid grid-cols-[28px_32px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--border)] px-4 py-4 last:border-b-0"
                >
                  <span className="text-sm font-medium text-[var(--muted)]">
                    {index + 1}
                  </span>

                  <TeamBadge
                    name={row.teamName}
                    badgeUrl={team?.badgeUrl ?? null}
                    size="sm"
                  />

                  <span className="truncate font-semibold">{row.teamName}</span>

                  <span className="text-lg font-black">{row.points}</span>
                </div>
              );
            })}
          </Card>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-[-0.03em]">Calendario</h2>

            <Link
              href={`/leagues/${leagueId}/calendar`}
              className="text-sm font-semibold text-[var(--accent)]"
            >
              Tutte →
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {nextMatches.length > 0 ? (
              nextMatches.map((match) => (
                <NextMatchCard key={match.id} match={match} />
              ))
            ) : (
              <Card>
                <p className="text-sm text-[var(--muted)]">
                  Nessuna partita in programma.
                </p>
              </Card>
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

function SummaryStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="space-y-1">
      <div className="text-2xl font-black tracking-[-0.05em]">{value}</div>
      <div className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
        {label}
      </div>
    </div>
  );
}

function NextMatchCard({ match }: { match: Match }) {
  return (
    <Card className="min-h-[136px]">
      <div className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
        {formatMatchDateTime(match.date)}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TeamBadge
            name={match.homeTeam.name}
            badgeUrl={match.homeTeam.badgeUrl ?? null}
            size="sm"
          />
          <span className="truncate text-sm font-semibold">
            {match.homeTeam.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <TeamBadge
            name={match.awayTeam.name}
            badgeUrl={match.awayTeam.badgeUrl ?? null}
            size="sm"
          />
          <span className="truncate text-sm font-semibold">
            {match.awayTeam.name}
          </span>
        </div>
      </div>
    </Card>
  );
}

function TeamBadge({
  name,
  badgeUrl,
  size = "md",
}: {
  name: string;
  badgeUrl?: string | null;
  size?: "sm" | "md";
}) {
  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const colors = [
    "bg-green-200 text-green-900",
    "bg-pink-200 text-pink-900",
    "bg-cyan-200 text-cyan-900",
    "bg-orange-200 text-orange-900",
    "bg-violet-200 text-violet-900",
    "bg-fuchsia-200 text-fuchsia-900",
  ];

  const index = initials ? initials.charCodeAt(0) % colors.length : 0;

  const sizes = {
    sm: "h-7 w-7 rounded-lg text-[10px]",
    md: "h-11 w-11 rounded-[14px] text-base",
  };

  if (badgeUrl) {
    return (
      <img
        src={badgeUrl}
        alt={`Logo ${name}`}
        className={`shrink-0 object-contain ${sizes[size].split(" ").slice(0, 2).join(" ")} ${
          size === "sm" ? "rounded-lg" : "rounded-[14px]"
        }`}
      />
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center font-black ${sizes[size]} ${colors[index]}`}
    >
      {initials}
    </span>
  );
}