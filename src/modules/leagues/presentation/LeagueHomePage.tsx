"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card from "src/app/_components/ui/card";
import YouTubeVideoCard from "src/app/_components/youtube-video-card";
import SponsorBanner from "src/app/_components/sponsor-banner";
import LeagueAdSlot from "src/app/_components/league-ad-slot";
import { authFetch } from "@/lib/client-auth";
import { Clapperboard, PlayCircle, Star } from "lucide-react";

type League = {
  id: string;
  name: string;
  adsEnabled?: boolean | null;
  adProvider?: string | null;
  adClientId?: string | null;
  adLeagueSlot?: string | null;
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
  venueName?: string | null;
  venueAddress?: string | null;
  referee?: {
    id: string;
    name: string | null;
  } | null;
  homeGoals: number | null;
  awayGoals: number | null;
  resultStatus?: "DRAFT" | "FINAL" | null;
  lifecycleStatus?: "SCHEDULED" | "POSTPONED" | "CANCELLED";
  mvpPlayer?: { id: string; firstName: string; lastName: string; number: number } | null;
  replayUrl?: string | null;
  highlightsUrl?: string | null;
  homeTeam: Team;
  awayTeam: Team;
  isPlayoff?: boolean;
  stageLabel?: string;
};

type TableRow = {
  teamId: string;
  teamName: string;
  badgeUrl?: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

type PlayoffSeries = {
  id: string;
  bracketRound: number;
  position: number;
  homeTeam: Team | null;
  awayTeam: Team | null;
  matches: Array<{
    id: string;
    leg: number;
    homeGoals: number | null;
    awayGoals: number | null;
    resultStatus?: "DRAFT" | "FINAL" | null;
    lifecycleStatus?: "SCHEDULED" | "POSTPONED" | "CANCELLED";
    homeTeamId: string;
    awayTeamId: string;
    date: string | null;
  }>;
};

type PlayoffResponse = {
  configured?: boolean;
  format?: "SINGLE_ELIM" | "TWO_LEG";
  teamCount?: number | null;
  seeded?: boolean;
  series?: PlayoffSeries[];
  error?: string;
};

type LeagueOverview = {
  league: League;
  teams: Team[];
  matches: Match[];
  overviewMatches: Match[];
  table: TableRow[];
  summary: {
    currentRound: number;
    totalRounds: number;
    teamCount: number;
    matchCount: number;
    totalGoals: number;
  };
};

async function getJSON<T>(url: string): Promise<T> {
  const res = await authFetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error((data as any)?.error ?? "Errore caricamento dati");
  }

  return data as T;
}

function isPlayed(match: Match) {
  return match.resultStatus === "FINAL" && match.homeGoals !== null && match.awayGoals !== null;
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

function playoffStageLabel(bracketRound: number, teamCount?: number | null) {
  if (bracketRound <= 1) return "Finale";
  if (bracketRound === 2) return "Semifinale";
  if (bracketRound === 4) return "Quarti";
  if (teamCount && bracketRound === teamCount / 2) return "Primo turno";
  return `Playoff · R${bracketRound}`;
}

function normalizePlayoffMatches(
  leagueId: string,
  playoff: PlayoffResponse | null | undefined
): Match[] {
  if (!playoff?.configured || !Array.isArray(playoff.series)) return [];

  const out: Match[] = [];

  for (const series of playoff.series) {
    for (const match of series.matches ?? []) {
      let homeTeam: Team | null = null;
      let awayTeam: Team | null = null;

      if (series.homeTeam && series.awayTeam) {
        if (match.homeTeamId === series.homeTeam.id) {
          homeTeam = series.homeTeam;
        } else if (match.homeTeamId === series.awayTeam.id) {
          homeTeam = series.awayTeam;
        }

        if (match.awayTeamId === series.awayTeam.id) {
          awayTeam = series.awayTeam;
        } else if (match.awayTeamId === series.homeTeam.id) {
          awayTeam = series.homeTeam;
        }
      }

      if (!homeTeam || !awayTeam) {
        continue;
      }

      out.push({
        id: match.id,
        leagueId,
        round: 0,
        date: match.date,
        homeGoals: match.homeGoals,
        awayGoals: match.awayGoals,
        resultStatus: match.resultStatus ?? null,
        lifecycleStatus: match.lifecycleStatus ?? "SCHEDULED",
        homeTeam,
        awayTeam,
        isPlayoff: true,
        stageLabel: playoffStageLabel(series.bracketRound, playoff.teamCount),
      });
    }
  }

  return out.sort((a, b) => {
    const ad = a.date ? new Date(a.date).getTime() : Number.MAX_SAFE_INTEGER;
    const bd = b.date ? new Date(b.date).getTime() : Number.MAX_SAFE_INTEGER;
    return ad - bd;
  });
}

export default function LeagueHomePage() {
  const { leagueId } = useParams<{ leagueId: string }>();

  const [league, setLeague] = useState<League | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [overviewMatches, setOverviewMatches] = useState<Match[]>([]);
  const [table, setTable] = useState<TableRow[]>([]);
  const [summary, setSummary] = useState<LeagueOverview["summary"] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leagueId) return;

    async function load() {
      try {
        setErr(null);
        setLoading(true);

        const overview = await getJSON<LeagueOverview>(`/api/leagues/${leagueId}/overview`);

        setLeague(overview.league);
        setTeams(overview.teams);
        setMatches(overview.matches);
        setOverviewMatches(overview.overviewMatches);
        setTable(overview.table);
        setSummary(overview.summary);
      } catch (error: any) {
        setErr(error.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [leagueId]);

  const totalRounds = summary?.totalRounds ?? Math.max(teams.length * 2 - 2, 1);
  const currentRound = summary?.currentRound ?? 1;
  const totalGoals = summary?.totalGoals ?? 0;
  const teamCount = summary?.teamCount ?? teams.length;
  const matchCount = summary?.matchCount ?? matches.length;

  const liveMatch = useMemo(() => {
    return overviewMatches.find((match) => isLiveMatch(match)) ?? null;
  }, [overviewMatches]);

  const liveMinute = useMemo(() => {
    return liveMatch ? getLiveMinute(liveMatch) : null;
  }, [liveMatch]);

  const nextMatches = useMemo(() => {
    const now = Date.now();
    return overviewMatches
      .filter((match) =>
        !isPlayed(match) &&
        (match.lifecycleStatus ?? "SCHEDULED") === "SCHEDULED" &&
        match.date &&
        new Date(match.date).getTime() >= now
      )
      .slice(0, 2);
  }, [overviewMatches]);

  const recentResults = useMemo(() =>
    overviewMatches
      .filter((match) => isPlayed(match))
      .sort((a, b) => (b.date ? new Date(b.date).getTime() : 0) - (a.date ? new Date(a.date).getTime() : 0))
      .slice(0, 3),
    [overviewMatches]
  );

  if (!leagueId) return null;

  if (loading) {
    return (
      <DashboardShell leagueId={leagueId}>
        <LeagueOverviewSkeleton />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="w-full space-y-6 pb-8">
        <header className="pt-2">
          <Link
            href="/"
            className="mb-8 flex items-center gap-3 text-sm text-[var(--muted)]"
          >
            <span className="text-xl leading-none">‹</span>
            <span>{league?.name ?? "Torneo"}</span>
          </Link>

          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <h1 className="imperial-title max-w-full break-words text-[30px] font-black leading-tight text-[var(--foreground)] sm:text-[34px]">
              {league?.name ?? "Coppa Primavera"}
            </h1>

            <span className="imperial-chip rounded-full px-4 py-2 text-sm font-bold">
              In corso
            </span>
          </div>
        </header>

        {err && (
          <Card className="border-amber-400/20 bg-amber-400/[0.05]">
            <p className="font-black text-[var(--foreground)]">Dati del torneo temporaneamente non disponibili</p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">Riprova tra poco. Sponsor e contenuti media restano comunque consultabili.</p>
          </Card>
        )}

        <SponsorBanner compact />

        <LeagueAdSlot league={league} placement="league" />

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
                  {liveMatch.isPlayoff ? liveMatch.stageLabel ?? "Playoff" : `G${liveMatch.round}`}
                </span>
              </div>

              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                  <TeamBadge
                    name={liveMatch.homeTeam.name}
                    badgeUrl={liveMatch.homeTeam.badgeUrl ?? null}
                  />
                  <span className="max-w-full truncate text-sm font-semibold">
                    {liveMatch.homeTeam.name}
                  </span>
                </div>

                <div className="whitespace-nowrap px-1 text-center text-[28px] font-black tracking-[-0.06em] sm:text-[36px]">
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
                <NextMatchCard key={match.id} match={match} leagueId={leagueId} />
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

        {!err && summary && (
          <Card className="overflow-hidden !p-0">
            <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Stagione regolare</p>
                  <p className="shrink-0 text-xs font-black text-[var(--accent)]">G{currentRound} / {totalRounds}</p>
                </div>
                <div className="mt-2 h-1 rounded-full bg-[rgba(210,174,114,0.16)]">
                  <div
                    className="h-1 rounded-full bg-[linear-gradient(90deg,var(--imperial-green-2),var(--imperial-gold))]"
                    style={{ width: `${Math.min((currentRound / totalRounds) * 100, 100)}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:min-w-[330px]">
                <SummaryStat label="Squadre" value={teamCount} compact />
                <SummaryStat label="Partite" value={matchCount} compact />
                <SummaryStat label="Gol" value={totalGoals} compact />
              </div>
            </div>
          </Card>
        )}

        {recentResults.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.03em]">Ultimi risultati</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">Risultati definitivi, MVP e contenuti della gara.</p>
              </div>
              <Link href={`/leagues/${leagueId}/calendar`} className="text-sm font-semibold text-[var(--accent)]">Tutti →</Link>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              {recentResults.map((match) => <RecentResultCard key={match.id} match={match} leagueId={leagueId} />)}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.03em]">Cammino TV</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Video ufficiale di presentazione del torneo.</p>
            </div>

            <Link
              href={`/leagues/${leagueId}/videos`}
              className="shrink-0 text-sm font-semibold text-[var(--accent)]"
            >
              Tutti i video →
            </Link>
          </div>

          <YouTubeVideoCard leagueId={leagueId} mode="presentation" compact />
        </section>

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
              const teamBadgeUrl = row.badgeUrl ?? teams.find((t) => t.id === row.teamId)?.badgeUrl ?? null;

              return (
                <div
                  key={row.teamId}
                  className="grid min-w-0 grid-cols-[28px_32px_minmax(0,1fr)_auto] items-center gap-2 border-b border-[var(--border)] px-3 py-4 transition hover:bg-[var(--card-2)] last:border-b-0 sm:grid-cols-[34px_36px_minmax(0,1fr)_auto] sm:gap-3 sm:px-4"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-lg border border-[rgba(210,174,114,0.18)] text-sm font-bold text-[var(--muted)]">
                    {index + 1}
                  </span>

                  <TeamBadge
                    name={row.teamName}
                    badgeUrl={teamBadgeUrl}
                    size="sm"
                  />

                  <span className="min-w-0 break-words text-sm font-semibold text-[var(--foreground)] sm:truncate sm:text-base">{row.teamName}</span>

                  <span className="text-xl font-black text-[var(--imperial-gold-2)]">{row.points}</span>
                </div>
              );
            })}
          </Card>
        </section>


      </div>
    </DashboardShell>
  );
}


function LeagueOverviewSkeleton() {
  return (
    <div className="w-full space-y-6 pb-8" aria-busy="true" aria-label="Caricamento torneo">
      <header className="space-y-5 pt-2">
        <div className="h-4 w-40 animate-pulse rounded-full bg-[var(--card-2)]" />
        <div className="flex items-center justify-between gap-4">
          <div className="h-10 w-72 max-w-full animate-pulse rounded-full bg-[var(--card-2)]" />
          <div className="h-9 w-24 animate-pulse rounded-full bg-[var(--card-2)]" />
        </div>
      </header>

      <Card className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="h-5 w-40 animate-pulse rounded-full bg-[var(--card-2)]" />
          <div className="h-5 w-14 animate-pulse rounded-full bg-[var(--card-2)]" />
        </div>
        <div className="h-1 rounded-full bg-[var(--card-2)]" />
        <div className="grid grid-cols-3 gap-4 pt-1">
          {[0, 1, 2].map((item) => (
            <div key={item} className="space-y-2">
              <div className="h-7 w-12 animate-pulse rounded-full bg-[var(--card-2)]" />
              <div className="h-3 w-20 animate-pulse rounded-full bg-[var(--card-2)]" />
            </div>
          ))}
        </div>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-6 w-28 animate-pulse rounded-full bg-[var(--card-2)]" />
          <div className="h-4 w-20 animate-pulse rounded-full bg-[var(--card-2)]" />
        </div>
        <Card className="overflow-hidden !p-0">
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="grid min-w-0 grid-cols-[28px_32px_minmax(0,1fr)_auto] items-center gap-2 border-b border-[var(--border)] px-3 py-4 transition hover:bg-[var(--card-2)] last:border-b-0 sm:grid-cols-[34px_36px_minmax(0,1fr)_auto] sm:gap-3 sm:px-4">
              <div className="h-4 w-4 animate-pulse rounded bg-[var(--card-2)]" />
              <div className="h-8 w-8 animate-pulse rounded-lg bg-[var(--card-2)]" />
              <div className="h-4 w-40 max-w-full animate-pulse rounded-full bg-[var(--card-2)]" />
              <div className="h-5 w-7 animate-pulse rounded-full bg-[var(--card-2)]" />
            </div>
          ))}
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-6 w-28 animate-pulse rounded-full bg-[var(--card-2)]" />
          <div className="h-4 w-14 animate-pulse rounded-full bg-[var(--card-2)]" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[0, 1].map((match) => (
            <Card key={match} className="min-h-[136px] space-y-4">
              <div className="h-4 w-32 animate-pulse rounded-full bg-[var(--card-2)]" />
              <div className="space-y-3">
                <div className="h-7 animate-pulse rounded-xl bg-[var(--card-2)]" />
                <div className="h-7 animate-pulse rounded-xl bg-[var(--card-2)]" />
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: number;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "rounded-xl border border-[rgba(210,174,114,0.14)] bg-black/10 px-3 py-2" : "imperial-plate rounded-2xl px-4 py-3"}>
      <div className={compact ? "text-lg font-black text-[var(--imperial-gold-2)]" : "text-3xl font-black tracking-[-0.02em] text-[var(--imperial-gold-2)]"}>{value}</div>
      <div className="mt-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
      </div>
    </div>
  );
}


function RecentResultCard({ match, leagueId }: { match: Match; leagueId: string }) {
  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--accent)]">
          {match.isPlayoff ? match.stageLabel ?? "Playoff" : `Giornata ${match.round}`}
        </span>
        <span className="text-xs text-[var(--muted)]">{formatMatchDateTime(match.date)}</span>
      </div>
      <Link href={`/leagues/${leagueId}/matches/${match.id}`} className="block rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-3 transition hover:border-[var(--border-strong)]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <span className="truncate text-sm font-black text-[var(--foreground)]">{match.homeTeam.name}</span>
          <span className="whitespace-nowrap text-xl font-black text-[var(--imperial-gold-2)]">{match.homeGoals}–{match.awayGoals}</span>
          <span className="truncate text-right text-sm font-black text-[var(--foreground)]">{match.awayTeam.name}</span>
        </div>
      </Link>
      {match.mvpPlayer && (
        <div className="flex items-center gap-2 text-xs text-[var(--muted)]"><Star size={14} className="text-amber-300" /><span><strong className="text-[var(--foreground)]">MVP</strong> · #{match.mvpPlayer.number} {match.mvpPlayer.firstName} {match.mvpPlayer.lastName}</span></div>
      )}
      {(match.replayUrl || match.highlightsUrl) && (
        <div className="flex flex-wrap gap-2">
          {match.replayUrl && <a href={match.replayUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--foreground)]"><PlayCircle size={14} /> Replay</a>}
          {match.highlightsUrl && <a href={match.highlightsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--foreground)]"><Clapperboard size={14} /> Highlights</a>}
        </div>
      )}
    </Card>
  );
}

function NextMatchCard({ match, leagueId }: { match: Match; leagueId: string }) {
  return (
    <Link href={`/leagues/${leagueId}/matches/${match.id}`} className="block">
    <Card className="turf-card min-h-[136px] transition hover:-translate-y-0.5 hover:border-[var(--border-strong)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--accent)]">
          {formatMatchDateTime(match.date)}
        </div>

        {match.isPlayoff && (
          <span className="imperial-chip shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide">
            {match.stageLabel ?? "Playoff"}
          </span>
        )}
      </div>

      <div className="mb-4 text-[11px] font-semibold text-[var(--muted)]">
        <span>{match.venueName ?? "Campo da definire"}</span>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
        <div className="flex min-w-0 items-center gap-2">
          <TeamBadge
            name={match.homeTeam.name}
            badgeUrl={match.homeTeam.badgeUrl ?? null}
            size="sm"
          />
          <span className="truncate text-sm font-semibold">{match.homeTeam.name}</span>
        </div>

        <span className="imperial-title text-lg text-[var(--imperial-gold-2)]">VS</span>

        <div className="flex min-w-0 items-center gap-2 sm:justify-end sm:text-right">
          <span className="truncate text-sm font-semibold">{match.awayTeam.name}</span>
          <TeamBadge
            name={match.awayTeam.name}
            badgeUrl={match.awayTeam.badgeUrl ?? null}
            size="sm"
          />
        </div>
      </div>
    </Card>
    </Link>
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
