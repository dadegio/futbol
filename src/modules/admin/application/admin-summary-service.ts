import { prisma } from "@/lib/prisma";
import { FUTPOLI_RULES, isPlayerEligibleForMatchSheet } from "@/modules/players/domain/tournament-rules";
import { AppError } from "@/modules/core/errors";

export async function getLeagueAdminSummary(leagueId: string) {
  const [league, teams, players, sheetCount, matches] = await Promise.all([
    prisma.league.findUnique({
      where: { id: leagueId },
      select: { id: true, name: true },
    }),
    prisma.team.findMany({
      where: { leagueId, activeInLeague: true },
      select: { id: true, name: true },
    }),
    prisma.player.findMany({
      where: { team: { leagueId, activeInLeague: true } },
      select: {
        id: true,
        teamId: true,
        status: true,
        documentSigned: true,
        mediaConsent: true,
        wildcardUsed: true,
      },
    }),
    prisma.matchSheetPlayer.count({ where: { match: { leagueId } } }),
    prisma.match.findMany({
      where: { leagueId, seriesId: null },
      select: {
        id: true,
        homeGoals: true,
        awayGoals: true,
        refereeCostCents: true,
      },
    }),
  ]);

  if (!league) throw new AppError(404, "Lega non trovata");

  const authorized = players.filter((player) =>
    isPlayerEligibleForMatchSheet(player)
  ).length;
  const playedMatches = matches.filter(
    (match) => match.homeGoals !== null && match.awayGoals !== null
  ).length;

  const byTeam = teams.map((team) => {
    const teamPlayers = players.filter((player) => player.teamId === team.id);
    const teamAuthorized = teamPlayers.filter((player) =>
      isPlayerEligibleForMatchSheet(player)
    ).length;
    return {
      teamId: team.id,
      teamName: team.name,
      players: teamPlayers.length,
      authorized: teamAuthorized,
      blocked: teamPlayers.length - teamAuthorized,
      wildcards: teamPlayers.filter((player) => player.wildcardUsed).length,
    };
  });

  return {
    league,
    rules: FUTPOLI_RULES,
    totals: {
      teams: teams.length,
      players: players.length,
      authorized,
      blocked: players.length - authorized,
      wildcards: players.filter((player) => player.wildcardUsed).length,
      sheetAppearances: sheetCount,
      playerFeesCents: sheetCount * FUTPOLI_RULES.playerFeeCentsPerAppearance,
      matches: matches.length,
      playedMatches,
      refereeFeesCents: playedMatches * FUTPOLI_RULES.refereeCostCentsPerMatch,
    },
    byTeam,
  };
}