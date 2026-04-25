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

type PlayoffMatch = {
  id: string;
  leg: number | null;
  homeGoals: number | null;
  awayGoals: number | null;
};

type PlayoffSeries = {
  id: string;
  bracketRound: number;
  position: number;
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
  homeSeed: number | null;
  awaySeed: number | null;
  penaltiesHome: number | null;
  penaltiesAway: number | null;
  winnerId: string | null;
  matches: PlayoffMatch[];
};

type PlayoffData = {
  configured: boolean;
  format?: string;
  teamCount?: number;
  series?: PlayoffSeries[];
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

  // Match lasts 60 min + 2 min half-time break = 62 min live window.
  const end = new Date(start.getTime() + 62 * 60 * 1000);

  return now >= start && now <= end;
}

function getLiveMinute(match: Match) {
  if (!match.date) return null;

  const start = new Date(match.date);
  const now = new Date();

  if (Number.isNaN(start.getTime())) return null;

  const diffMinutes = Math.floor((now.getTime() - start.getTime()) / 60000);

  if (diffMinutes < 0 || diffMinutes > 62) return null;

  if (diffMinutes <= 30) return `${diffMinutes}'`;
  if (diffMinutes <= 32) return "30'+";  // half-time break
  if (diffMinutes <= 62) return `${diffMinutes - 2}'`;

  return "60'+";
}

export default function LeagueHomePage() {
  const { leagueId } = useParams<{ leagueId: string }>();

  const [league, setLeague] = useState<League | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [table, setTable] = useState<TableRow[]>([]);
  const [playoffData, setPlayoffData] = useState<PlayoffData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!leagueId) return;

    async function load() {
      try {
        setErr(null);

        const [leagueData, teamsData, matchesData, tableData, playoffRes] =
          await Promise.all([
            getJSON<League>(`/api/leagues/${leagueId}`),
            getJSON<any[]>(`/api/leagues/${leagueId}/teams`),
            getJSON<Match[]>(`/api/leagues/${leagueId}/schedule`),
            getJSON<TableRow[]>(`/api/leagues/${leagueId}/table`),
            fetch(`/api/leagues/${leagueId}/playoffs`, { cache: "no-store" }),
          ]);

        setLeague(leagueData);
        setTeams(teamsData.map((team) => ({ id: team.id, name: team.name })));
        setMatches(matchesData);
        setTable(tableData);
        const pd = await playoffRes.json().catch(() => null);
        setPlayoffData(playoffRes.ok ? pd : null);
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

            <span
              className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: "oklch(0.92 0.04 148)", color: "var(--success)" }}
            >
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

          <div className="h-1 rounded-full bg-[var(--card-2)]">
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
              <h2 className="text-lg font-semibold tracking-[-0.03em]">
                In diretta
              </h2>

              <Link
                href={`/leagues/${leagueId}/calendar`}
                className="text-sm font-semibold text-[var(--accent)]"
              >
                Dettagli →
              </Link>
            </div>

            <Card>
              <div className="mb-4 flex items-center justify-between text-sm">
                <span className="font-semibold text-[var(--danger)]">
                  <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[var(--danger)]" />
                  {liveMinute ?? "Live"}
                </span>
                <span className="font-semibold text-[var(--muted)]">
                  G{liveMatch.round}
                </span>
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                  <TeamBadge name={liveMatch.homeTeam.name} />
                  <span className="max-w-full truncate text-sm font-semibold">
                    {liveMatch.homeTeam.name}
                  </span>
                </div>

                <div
                  className="whitespace-nowrap px-1 text-center text-[36px] font-semibold tabular-nums leading-none tracking-[-0.04em] text-[var(--foreground)]"
                  style={{ fontFamily: "var(--font-mono, ui-monospace)" }}
                >
                  {liveMatch.homeGoals ?? 0}
                  <span className="mx-2 text-[var(--muted)]">–</span>
                  {liveMatch.awayGoals ?? 0}
                </div>

                <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                  <TeamBadge name={liveMatch.awayTeam.name} />
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
            <h2 className="text-lg font-semibold tracking-[-0.03em]">
              Classifica
            </h2>

            <Link
              href={`/leagues/${leagueId}/table`}
              className="text-sm font-semibold text-[var(--accent)]"
            >
              Vedi tutto →
            </Link>
          </div>

          <Card className="overflow-hidden !p-0">
            {table.slice(0, 4).map((row, index) => (
              <div
                key={row.teamId}
                className="grid grid-cols-[34px_32px_1fr_auto] items-center gap-3 border-b border-[var(--border)] px-4 py-4 last:border-b-0"
              >
                <span className="text-sm font-medium text-[var(--muted)]">
                  {index + 1}
                </span>

                <TeamBadge name={row.teamName} size="sm" />

                <span className="truncate font-semibold">{row.teamName}</span>

                <span className="text-lg font-black">{row.points}</span>
              </div>
            ))}
          </Card>
        </section>

        {playoffData?.configured && playoffData.series && playoffData.series.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-[-0.03em]">Playoff</h2>
              <Link
                href={`/leagues/${leagueId}/playoffs`}
                className="text-sm font-semibold text-[var(--accent)]"
              >
                Vedi tutto →
              </Link>
            </div>
            <PlayoffRecapSection
              series={playoffData.series}
              format={playoffData.format!}
              teamCount={playoffData.teamCount!}
              leagueId={leagueId}
            />
          </section>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-[-0.03em]">
              Prossime
            </h2>

            <span className="text-sm font-semibold text-[var(--muted)]">
              G{currentRound}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {nextMatches.length === 0 ? (
              <Card className="col-span-2">
                <p className="text-sm text-[var(--muted)]">
                  Nessuna prossima partita disponibile.
                </p>
              </Card>
            ) : (
              nextMatches.map((match) => (
                <NextMatchCard key={match.id} match={match} />
              ))
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[10px] text-[var(--muted)]">{label}</div>
      <div
        className="mt-0.5 text-[18px] font-semibold tabular-nums leading-tight text-[var(--foreground)]"
        style={{ fontFamily: "var(--font-mono, ui-monospace)" }}
      >
        {value}
      </div>
    </div>
  );
}

function NextMatchCard({ match }: { match: Match }) {
  return (
    <Card>
      <div
        className="mb-3 text-[11px] text-[var(--muted)]"
        style={{ fontFamily: "var(--font-mono, ui-monospace)" }}
      >
        G{match.round}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <TeamBadge name={match.homeTeam.name} size="sm" />
          <span className="truncate text-[12px] font-medium text-[var(--foreground)]">
            {match.homeTeam.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <TeamBadge name={match.awayTeam.name} size="sm" />
          <span className="truncate text-[12px] font-medium text-[var(--foreground)]">
            {match.awayTeam.name}
          </span>
        </div>
      </div>
    </Card>
  );
}

const ROUND_NAMES: Record<number, string> = {
  1: "Finale",
  2: "Semifinali",
  4: "Quarti di finale",
  8: "Ottavi di finale",
};

function PlayoffRecapSection({
  series,
  format,
  teamCount,
  leagueId,
}: {
  series: PlayoffSeries[];
  format: string;
  teamCount: number;
  leagueId: string;
}) {
  const isTwoLeg = format === "TWO_LEG";

  // Find the active round: highest bracketRound (earliest) that still has incomplete series.
  // Fall back to the final (bracketRound=1) if everything is done.
  const firstRound = teamCount / 2;
  const roundOrder: number[] = [];
  for (let r = firstRound; r >= 1; r = r / 2) roundOrder.push(r);

  const activeRound =
    roundOrder.find((r) => {
      const roundSeries = series.filter((s) => s.bracketRound === r);
      return roundSeries.length > 0 && roundSeries.some((s) => !s.winnerId);
    }) ?? 1;

  const activeSeries = series
    .filter((s) => s.bracketRound === activeRound)
    .sort((a, b) => a.position - b.position);

  const allDone = series.every((s) => s.winnerId);
  const champion = allDone
    ? series.find((s) => s.bracketRound === 1)
    : null;
  const championTeam = champion
    ? (champion.winnerId === champion.homeTeam?.id ? champion.homeTeam : champion.awayTeam)
    : null;

  return (
    <div className="space-y-2">
      {/* Round label */}
      <div className="flex items-center justify-between px-0.5">
        <span
          className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {ROUND_NAMES[activeRound] ?? `Round ${activeRound}`}
        </span>
        {championTeam && (
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-[var(--accent)]"
            style={{ background: "oklch(0.94 0.03 258)" }}
          >
            Campione: {championTeam.name}
          </span>
        )}
      </div>

      {/* Series cards */}
      <Card className="overflow-hidden !p-0">
        {activeSeries.map((s, i) => {
          const leg1 = s.matches.find((m) => m.leg === 1) ?? s.matches[0];
          const leg2 = s.matches.find((m) => m.leg === 2);
          const leg1Played = !!leg1 && leg1.homeGoals !== null && leg1.awayGoals !== null;
          const leg2Played = !!leg2 && leg2.homeGoals !== null && leg2.awayGoals !== null;

          const homeAgg = isTwoLeg
            ? (leg1?.homeGoals ?? 0) + (leg2?.awayGoals ?? 0)
            : null;
          const awayAgg = isTwoLeg
            ? (leg1?.awayGoals ?? 0) + (leg2?.homeGoals ?? 0)
            : null;

          const homeWon = s.winnerId && s.homeTeam && s.winnerId === s.homeTeam.id;
          const awayWon = s.winnerId && s.awayTeam && s.winnerId === s.awayTeam.id;

          return (
            <Link
              key={s.id}
              href={`/leagues/${leagueId}/playoffs`}
              className={[
                "grid items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--card-2)]",
                i < activeSeries.length - 1 ? "border-b border-[var(--border)]" : "",
              ].join(" ")}
              style={{ gridTemplateColumns: "1fr auto 1fr" }}
            >
              {/* Home */}
              <div className={["flex items-center gap-2 min-w-0", awayWon ? "opacity-40" : ""].join(" ")}>
                <TeamBadge name={s.homeTeam?.name ?? "?"} size="sm" />
                <span className={[
                  "truncate text-[12px] font-semibold",
                  homeWon ? "text-[var(--accent)]" : "text-[var(--foreground)]",
                ].join(" ")}>
                  {s.homeTeam?.name ?? "TBD"}
                </span>
              </div>

              {/* Score */}
              <div
                className="flex shrink-0 flex-col items-center gap-0.5"
                style={{ fontFamily: "var(--font-mono, ui-monospace)" }}
              >
                {isTwoLeg && (leg1Played || leg2Played) ? (
                  <>
                    <div className="flex items-center gap-1 text-[11px] tabular-nums text-[var(--muted)]">
                      <span>{leg1Played ? leg1!.homeGoals : "–"}</span>
                      <span className="text-[var(--border-strong)]">:</span>
                      <span>{leg1Played ? leg1!.awayGoals : "–"}</span>
                      {leg2Played && (
                        <>
                          <span className="mx-0.5 text-[var(--border-strong)]">·</span>
                          <span>{leg2!.homeGoals}</span>
                          <span className="text-[var(--border-strong)]">:</span>
                          <span>{leg2!.awayGoals}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[13px] font-semibold tabular-nums">
                      <span className={homeWon ? "text-[var(--accent)]" : "text-[var(--foreground)]"}>{homeAgg}</span>
                      <span className="text-[var(--border-strong)]">:</span>
                      <span className={awayWon ? "text-[var(--accent)]" : "text-[var(--foreground)]"}>{awayAgg}</span>
                    </div>
                    {s.penaltiesHome !== null && s.penaltiesAway !== null && (
                      <div className="flex items-center gap-0.5 text-[10px] text-[var(--muted)]" style={{ fontFamily: "var(--font-mono, ui-monospace)" }}>
                        <span>r.</span>
                        <span className={(s.penaltiesHome > s.penaltiesAway) ? "font-semibold text-[var(--accent)]" : ""}>{s.penaltiesHome}</span>
                        <span>:</span>
                        <span className={(s.penaltiesAway > s.penaltiesHome) ? "font-semibold text-[var(--accent)]" : ""}>{s.penaltiesAway}</span>
                      </div>
                    )}
                  </>
                ) : leg1Played ? (
                  <>
                    <span className="text-[15px] font-semibold tabular-nums text-[var(--foreground)]">
                      {leg1!.homeGoals}
                      <span className="mx-0.5 text-[var(--border-strong)]">:</span>
                      {leg1!.awayGoals}
                    </span>
                    {s.penaltiesHome !== null && s.penaltiesAway !== null && (
                      <div className="flex items-center gap-0.5 text-[10px] text-[var(--muted)]" style={{ fontFamily: "var(--font-mono, ui-monospace)" }}>
                        <span>r.</span>
                        <span className={(s.penaltiesHome > s.penaltiesAway) ? "font-semibold text-[var(--accent)]" : ""}>{s.penaltiesHome}</span>
                        <span>:</span>
                        <span className={(s.penaltiesAway > s.penaltiesHome) ? "font-semibold text-[var(--accent)]" : ""}>{s.penaltiesAway}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <span className="text-[13px] text-[var(--border-strong)]">vs</span>
                )}
              </div>

              {/* Away */}
              <div className={["flex items-center gap-2 min-w-0 flex-row-reverse text-right", homeWon ? "opacity-40" : ""].join(" ")}>
                <TeamBadge name={s.awayTeam?.name ?? "?"} size="sm" />
                <span className={[
                  "truncate text-[12px] font-semibold",
                  awayWon ? "text-[var(--accent)]" : "text-[var(--foreground)]",
                ].join(" ")}>
                  {s.awayTeam?.name ?? "TBD"}
                </span>
              </div>
            </Link>
          );
        })}
      </Card>
    </div>
  );
}

function TeamBadge({
  name,
  size = "md",
}: {
  name: string;
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

  const index = initials.charCodeAt(0) % colors.length;

  const sizes = {
    sm: "h-7 w-7 rounded-lg text-[10px]",
    md: "h-11 w-11 rounded-[14px] text-base",
  };

  return (
    <span
      className={`flex shrink-0 items-center justify-center font-black ${sizes[size]} ${colors[index]}`}
    >
      {initials}
    </span>
  );
}