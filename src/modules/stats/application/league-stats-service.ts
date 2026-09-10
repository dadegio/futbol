import { prisma } from "@/lib/prisma";
import type {
  FormResult,
  LeagueStatsResponse,
  PlayerStat,
  TeamStat,
} from "@/modules/stats/domain/league-stats";

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function resultForTeam(
  teamId: string,
  match: {
    homeTeamId: string;
    awayTeamId: string;
    homeGoals: number | null;
    awayGoals: number | null;
  }
): FormResult {
  const homeGoals = match.homeGoals ?? 0;
  const awayGoals = match.awayGoals ?? 0;
  if (homeGoals === awayGoals) return "D";

  const teamWon =
    (match.homeTeamId === teamId && homeGoals > awayGoals) ||
    (match.awayTeamId === teamId && awayGoals > homeGoals);

  return teamWon ? "W" : "L";
}

function currentWinStreak(results: FormResult[]) {
  let streak = 0;
  for (let i = results.length - 1; i >= 0; i -= 1) {
    if (results[i] !== "W") break;
    streak += 1;
  }
  return streak;
}

function currentUnbeatenStreak(results: FormResult[]) {
  let streak = 0;
  for (let i = results.length - 1; i >= 0; i -= 1) {
    if (results[i] === "L") break;
    streak += 1;
  }
  return streak;
}

function maxWinningStreak(results: FormResult[]) {
  let max = 0;
  let current = 0;
  for (const result of results) {
    if (result === "W") {
      current += 1;
      max = Math.max(max, current);
    } else {
      current = 0;
    }
  }
  return max;
}

function maxUnbeatenStreak(results: FormResult[]) {
  let max = 0;
  let current = 0;
  for (const result of results) {
    if (result !== "L") {
      current += 1;
      max = Math.max(max, current);
    } else {
      current = 0;
    }
  }
  return max;
}

export async function getLeagueStats(leagueId: string): Promise<LeagueStatsResponse> {

  const [teams, players, matches, playerAgg, appearancesAgg, bestSingleMatchStat, mvpMatches] =
    await Promise.all([
      prisma.team.findMany({
        where: { leagueId, activeInLeague: true },
        select: {
          id: true,
          name: true,
          badgeUrl: true,
          colorHex: true,
          secondaryColorHex: true,
        },
        orderBy: { name: "asc" },
      }),

      prisma.player.findMany({
        where: { team: { leagueId, activeInLeague: true } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          number: true,
          position: true,
          photoUrl: true,
          photoZoom: true,
          photoPositionX: true,
          photoPositionY: true,
          isTeamCaptain: true,
          teamId: true,
          team: {
            select: {
              name: true,
              badgeUrl: true,
            },
          },
        },
      }),

      prisma.match.findMany({
        where: {
          leagueId,
          resultStatus: "FINAL",
          homeGoals: { not: null },
          awayGoals: { not: null },
        },
        select: {
          id: true,
          date: true,
          createdAt: true,
          round: true,
          seriesId: true,
          homeTeamId: true,
          awayTeamId: true,
          homeGoals: true,
          awayGoals: true,
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      }),

      prisma.matchPlayerStat.groupBy({
        by: ["playerId"],
        _sum: { goals: true, assists: true },
        where: {
          match: {
            leagueId,
            resultStatus: "FINAL",
            homeGoals: { not: null },
            awayGoals: { not: null },
          },
          player: { team: { activeInLeague: true } },
        },
      }),

      prisma.matchSheetPlayer.groupBy({
        by: ["playerId"],
        _count: { _all: true },
        where: {
          match: {
            leagueId,
            resultStatus: "FINAL",
            homeGoals: { not: null },
            awayGoals: { not: null },
          },
          player: { team: { activeInLeague: true } },
        },
      }),

      prisma.matchPlayerStat.findFirst({
        where: {
          goals: { gt: 0 },
          match: {
            leagueId,
            resultStatus: "FINAL",
            homeGoals: { not: null },
            awayGoals: { not: null },
          },
          player: { team: { activeInLeague: true } },
        },
        orderBy: [{ goals: "desc" }, { assists: "desc" }],
        select: {
          goals: true,
          assists: true,
          player: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              team: { select: { name: true } },
            },
          },
          match: {
            select: {
              id: true,
              date: true,
              homeGoals: true,
              awayGoals: true,
              homeTeam: { select: { name: true } },
              awayTeam: { select: { name: true } },
            },
          },
        },
      }),
      prisma.match.findMany({
        where: { leagueId, resultStatus: "FINAL", mvpPlayerId: { not: null } },
        select: { mvpPlayerId: true },
      }),
    ]);

  const teamById = new Map(teams.map((team) => [team.id, team]));

  const teamStatsById = new Map<string, TeamStat>();
  const allResultsByTeam = new Map<string, FormResult[]>();

  for (const team of teams) {
    teamStatsById.set(team.id, {
      teamId: team.id,
      teamName: team.name,
      badgeUrl: team.badgeUrl,
      colorHex: team.colorHex,
      secondaryColorHex: team.secondaryColorHex,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      points: 0,
      pointsPerGame: 0,
      goalsPerGame: 0,
      goalsAgainstPerGame: 0,
      cleanSheets: 0,
      form: [],
      winStreak: 0,
      unbeatenStreak: 0,
    });
    allResultsByTeam.set(team.id, []);
  }

  let totalGoals = 0;
  let draws = 0;
  let homeWins = 0;
  let awayWins = 0;
  let totalCleanSheets = 0;

  let biggestWin:
    | {
        matchId: string;
        date: string | null;
        homeTeamName: string;
        awayTeamName: string;
        homeGoals: number;
        awayGoals: number;
        margin: number;
      }
    | null = null;

  let highestScoringMatch:
    | {
        matchId: string;
        date: string | null;
        homeTeamName: string;
        awayTeamName: string;
        homeGoals: number;
        awayGoals: number;
        totalGoals: number;
      }
    | null = null;

  for (const match of matches) {
    const homeGoals = match.homeGoals ?? 0;
    const awayGoals = match.awayGoals ?? 0;
    const home = teamStatsById.get(match.homeTeamId);
    const away = teamStatsById.get(match.awayTeamId);
    if (!home || !away) continue;

    totalGoals += homeGoals + awayGoals;
    home.played += 1;
    away.played += 1;
    home.gf += homeGoals;
    home.ga += awayGoals;
    away.gf += awayGoals;
    away.ga += homeGoals;

    if (awayGoals === 0) {
      home.cleanSheets += 1;
      totalCleanSheets += 1;
    }
    if (homeGoals === 0) {
      away.cleanSheets += 1;
      totalCleanSheets += 1;
    }

    if (homeGoals > awayGoals) {
      home.wins += 1;
      away.losses += 1;
      home.points += 3;
      homeWins += 1;
    } else if (awayGoals > homeGoals) {
      away.wins += 1;
      home.losses += 1;
      away.points += 3;
      awayWins += 1;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
      draws += 1;
    }

    allResultsByTeam.get(match.homeTeamId)?.push(resultForTeam(match.homeTeamId, match));
    allResultsByTeam.get(match.awayTeamId)?.push(resultForTeam(match.awayTeamId, match));

    const margin = Math.abs(homeGoals - awayGoals);
    if (margin > 0 && (!biggestWin || margin > biggestWin.margin)) {
      biggestWin = {
        matchId: match.id,
        date: match.date?.toISOString() ?? null,
        homeTeamName: teamById.get(match.homeTeamId)?.name ?? "",
        awayTeamName: teamById.get(match.awayTeamId)?.name ?? "",
        homeGoals,
        awayGoals,
        margin,
      };
    }

    const matchGoals = homeGoals + awayGoals;
    if (!highestScoringMatch || matchGoals > highestScoringMatch.totalGoals) {
      highestScoringMatch = {
        matchId: match.id,
        date: match.date?.toISOString() ?? null,
        homeTeamName: teamById.get(match.homeTeamId)?.name ?? "",
        awayTeamName: teamById.get(match.awayTeamId)?.name ?? "",
        homeGoals,
        awayGoals,
        totalGoals: matchGoals,
      };
    }
  }

  const teamStats = Array.from(teamStatsById.values()).map((team) => {
    team.gd = team.gf - team.ga;
    team.pointsPerGame = team.played ? round(team.points / team.played) : 0;
    team.goalsPerGame = team.played ? round(team.gf / team.played) : 0;
    team.goalsAgainstPerGame = team.played ? round(team.ga / team.played) : 0;
    const results = allResultsByTeam.get(team.teamId) ?? [];
    team.form = results.slice(-5);
    team.winStreak = currentWinStreak(results);
    team.unbeatenStreak = currentUnbeatenStreak(results);
    return team;
  });

  teamStats.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.teamName.localeCompare(b.teamName);
  });

  const playerAggById = new Map(
    playerAgg.map((row) => [
      row.playerId,
      {
        goals: row._sum.goals ?? 0,
        assists: row._sum.assists ?? 0,
      },
    ])
  );
  const appearancesById = new Map(
    appearancesAgg.map((row) => [row.playerId, row._count._all])
  );
  const mvpById = new Map<string, number>();
  for (const row of mvpMatches) {
    if (row.mvpPlayerId) mvpById.set(row.mvpPlayerId, (mvpById.get(row.mvpPlayerId) ?? 0) + 1);
  }

  const playerStats: PlayerStat[] = players.map((player) => {
    const agg = playerAggById.get(player.id) ?? { goals: 0, assists: 0 };
    const appearances = appearancesById.get(player.id) ?? 0;
    const contributions = agg.goals + agg.assists;

    return {
      playerId: player.id,
      firstName: player.firstName,
      lastName: player.lastName,
      number: player.number,
      position: player.position,
      photoUrl: player.photoUrl,
      photoZoom: player.photoZoom,
      photoPositionX: player.photoPositionX,
      photoPositionY: player.photoPositionY,
      isTeamCaptain: player.isTeamCaptain,
      teamId: player.teamId,
      teamName: player.team?.name ?? "",
      teamBadgeUrl: player.team?.badgeUrl ?? null,
      appearances,
      goals: agg.goals,
      assists: agg.assists,
      contributions,
      goalsPerAppearance: appearances ? round(agg.goals / appearances) : 0,
      assistsPerAppearance: appearances ? round(agg.assists / appearances) : 0,
      contributionsPerAppearance: appearances ? round(contributions / appearances) : 0,
      mvpAwards: mvpById.get(player.id) ?? 0,
    };
  });

  playerStats.sort((a, b) => {
    if (b.contributions !== a.contributions) return b.contributions - a.contributions;
    if (b.goals !== a.goals) return b.goals - a.goals;
    if (b.assists !== a.assists) return b.assists - a.assists;
    return a.lastName.localeCompare(b.lastName);
  });

  const topScorer = [...playerStats]
    .filter((player) => player.goals > 0)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists)[0] ?? null;
  const topAssister = [...playerStats]
    .filter((player) => player.assists > 0)
    .sort((a, b) => b.assists - a.assists || b.goals - a.goals)[0] ?? null;
  const topContributor = playerStats.find((player) => player.contributions > 0) ?? null;
  const mostAppearances = [...playerStats].sort((a, b) => b.appearances - a.appearances || b.contributions - a.contributions)[0] ?? null;
  const topMvp = [...playerStats].filter((player) => player.mvpAwards > 0).sort((a, b) => b.mvpAwards - a.mvpAwards || b.contributions - a.contributions)[0] ?? null;

  const teamsWithMatches = teamStats.filter((team) => team.played > 0);
  const bestAttack = [...teamsWithMatches].sort((a, b) => b.gf - a.gf || b.goalsPerGame - a.goalsPerGame)[0] ?? null;
  const bestDefense = [...teamsWithMatches].sort((a, b) => a.ga - b.ga || a.goalsAgainstPerGame - b.goalsAgainstPerGame)[0] ?? null;
  const mostCleanSheets = [...teamsWithMatches].sort((a, b) => b.cleanSheets - a.cleanSheets || a.ga - b.ga)[0] ?? null;

  const streakRows = teamStats.map((team) => {
    const results = allResultsByTeam.get(team.teamId) ?? [];
    return {
      teamId: team.teamId,
      teamName: team.teamName,
      badgeUrl: team.badgeUrl,
      longestWinningStreak: maxWinningStreak(results),
      longestUnbeatenStreak: maxUnbeatenStreak(results),
    };
  });

  const longestWinningStreakCandidate = [...streakRows].sort(
    (a, b) => b.longestWinningStreak - a.longestWinningStreak
  )[0] ?? null;
  const longestUnbeatenStreakCandidate = [...streakRows].sort(
    (a, b) => b.longestUnbeatenStreak - a.longestUnbeatenStreak
  )[0] ?? null;
  const longestWinningStreak =
    longestWinningStreakCandidate && longestWinningStreakCandidate.longestWinningStreak > 0
      ? longestWinningStreakCandidate
      : null;
  const longestUnbeatenStreak =
    longestUnbeatenStreakCandidate && longestUnbeatenStreakCandidate.longestUnbeatenStreak > 0
      ? longestUnbeatenStreakCandidate
      : null;

  const bestSingleMatch = bestSingleMatchStat
    ? {
        playerId: bestSingleMatchStat.player.id,
        playerName: `${bestSingleMatchStat.player.firstName} ${bestSingleMatchStat.player.lastName}`,
        teamName: bestSingleMatchStat.player.team.name,
        goals: bestSingleMatchStat.goals,
        assists: bestSingleMatchStat.assists,
        matchId: bestSingleMatchStat.match.id,
        date: bestSingleMatchStat.match.date?.toISOString() ?? null,
        homeTeamName: bestSingleMatchStat.match.homeTeam.name,
        awayTeamName: bestSingleMatchStat.match.awayTeam.name,
        homeGoals: bestSingleMatchStat.match.homeGoals ?? 0,
        awayGoals: bestSingleMatchStat.match.awayGoals ?? 0,
      }
    : null;

  return {
    overview: {
      completedMatches: matches.length,
      totalGoals,
      averageGoalsPerMatch: matches.length ? round(totalGoals / matches.length) : 0,
      totalCleanSheets,
      draws,
      homeWins,
      awayWins,
      teams: teams.length,
      players: players.length,
    },
    teamStats,
    playerStats,
    leaders: {
      topScorer,
      topAssister,
      topContributor,
      mostAppearances,
      topMvp,
    },
    records: {
      bestAttack,
      bestDefense,
      mostCleanSheets,
      biggestWin,
      highestScoringMatch,
      bestSingleMatch,
      longestWinningStreak,
      longestUnbeatenStreak,
    },
  };
}
