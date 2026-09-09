import { prisma } from "@/lib/prisma";
import { AppError } from "@/modules/core/errors";
import { getLeagueTable } from "@/modules/stats/application/league-table-service";

type TeamLite = {
  id: string;
  name: string;
  badgeUrl: string | null;
};

type OverviewMatchInput = {
  id: string;
  leagueId: string;
  round: number;
  date: Date | null;
  venueName: string | null;
  venueAddress: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
  seriesId?: string | null;
  leg?: number | null;
  referee: { id: string; name: string | null } | null;
  homeTeam: TeamLite;
  awayTeam: TeamLite;
  series?: { bracketRound: number } | null;
};

function isPlayed(match: { homeGoals: number | null; awayGoals: number | null }) {
  return match.homeGoals !== null && match.awayGoals !== null;
}

function playoffStageLabel(bracketRound?: number | null, teamCount?: number | null) {
  if (!bracketRound) return "Playoff";
  if (bracketRound <= 1) return "Finale";
  if (bracketRound === 2) return "Semifinale";
  if (bracketRound === 4) return "Quarti";
  if (teamCount && bracketRound === teamCount / 2) return "Primo turno";
  return `Playoff · R${bracketRound}`;
}

function publicMatch(match: OverviewMatchInput, canSeeRefereeName: boolean, playoffTeamCount?: number | null) {
  const isPlayoff = Boolean(match.seriesId);

  return {
    id: match.id,
    leagueId: match.leagueId,
    round: match.round,
    date: match.date,
    venueName: match.venueName,
    venueAddress: match.venueAddress,
    referee: match.referee
      ? { id: match.referee.id, name: canSeeRefereeName ? match.referee.name : null }
      : null,
    homeGoals: match.homeGoals,
    awayGoals: match.awayGoals,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    isPlayoff,
    stageLabel: isPlayoff ? playoffStageLabel(match.series?.bracketRound, playoffTeamCount) : undefined,
  };
}

function byDate(a: { date: Date | null }, b: { date: Date | null }) {
  const ad = a.date ? a.date.getTime() : Number.MAX_SAFE_INTEGER;
  const bd = b.date ? b.date.getTime() : Number.MAX_SAFE_INTEGER;
  return ad - bd;
}

export async function getLeagueOverview({
  leagueId,
  canSeeRefereeName,
}: {
  leagueId: string;
  canSeeRefereeName: boolean;
}) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      id: true,
      name: true,
      adsEnabled: true,
      adProvider: true,
      adClientId: true,
      adLeagueSlot: true,
      playoffTeamCount: true,
    },
  });

  if (!league) throw new AppError(404, "Torneo non trovato");

  const [teams, regularMatches, playoffMatches, table] = await Promise.all([
    prisma.team.findMany({
      where: { leagueId, activeInLeague: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, badgeUrl: true },
    }),
    prisma.match.findMany({
      where: { leagueId, seriesId: null },
      orderBy: [{ round: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        leagueId: true,
        round: true,
        date: true,
        venueName: true,
        venueAddress: true,
        homeGoals: true,
        awayGoals: true,
        referee: { select: { id: true, name: true } },
        homeTeam: { select: { id: true, name: true, badgeUrl: true } },
        awayTeam: { select: { id: true, name: true, badgeUrl: true } },
      },
    }),
    prisma.match.findMany({
      where: { leagueId, seriesId: { not: null as unknown as string } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      take: 12,
      select: {
        id: true,
        leagueId: true,
        round: true,
        date: true,
        venueName: true,
        venueAddress: true,
        homeGoals: true,
        awayGoals: true,
        seriesId: true,
        leg: true,
        referee: { select: { id: true, name: true } },
        homeTeam: { select: { id: true, name: true, badgeUrl: true } },
        awayTeam: { select: { id: true, name: true, badgeUrl: true } },
        series: { select: { bracketRound: true } },
      },
    }),
    getLeagueTable(leagueId),
  ]);

  const rounds = [...new Set(regularMatches.map((match) => match.round))].sort((a, b) => a - b);
  const totalRounds = rounds.length || Math.max(teams.length * 2 - 2, 1);
  const currentRound = (() => {
    if (rounds.length === 0) return 1;
    for (const round of rounds) {
      const roundMatches = regularMatches.filter((match) => match.round === round);
      const allPlayed = roundMatches.length > 0 && roundMatches.every((match) => isPlayed(match));
      if (!allPlayed) return round;
    }
    return rounds[rounds.length - 1] ?? 1;
  })();
  const playedMatches = regularMatches.filter((match) => isPlayed(match));
  const totalGoals = playedMatches.reduce(
    (sum, match) => sum + (match.homeGoals ?? 0) + (match.awayGoals ?? 0),
    0
  );

  const regularPublic = regularMatches.map((match) => publicMatch(match, canSeeRefereeName));
  const playoffPublic = playoffMatches.map((match) =>
    publicMatch(match, canSeeRefereeName, league.playoffTeamCount)
  );
  const overviewMatches = [...regularPublic, ...playoffPublic].sort(byDate).slice(0, 24);

  return {
    league: {
      id: league.id,
      name: league.name,
      adsEnabled: league.adsEnabled,
      adProvider: league.adProvider,
      adClientId: league.adClientId,
      adLeagueSlot: league.adLeagueSlot,
    },
    teams,
    matches: regularPublic,
    overviewMatches,
    table: table.slice(0, 5),
    summary: {
      currentRound,
      totalRounds,
      teamCount: teams.length,
      matchCount: regularMatches.length,
      totalGoals,
    },
  };
}
