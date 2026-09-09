import { prisma } from "@/lib/prisma";
import { FUTPOLI_RULES, isPlayerEligibleForMatchSheet } from "@/modules/players/domain/tournament-rules";
import { AppError } from "@/modules/core/errors";

export async function getLeagueAdminSummary(leagueId: string) {
  const [league, teams, players, sheetEntries, matches] = await Promise.all([
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
    prisma.matchSheetPlayer.findMany({
      where: { match: { leagueId } },
      select: { teamId: true },
    }),
    prisma.match.findMany({
      where: { leagueId, seriesId: null },
      select: {
        id: true,
        homeGoals: true,
        awayGoals: true,
        refereeCostCents: true,
        date: true,
        venueKey: true,
        refereeId: true,
        homeTeamId: true,
        awayTeamId: true,
      },
    }),
  ]);

  if (!league) throw new AppError(404, "Lega non trovata");

  const authorized = players.filter((player) =>
    isPlayerEligibleForMatchSheet(player)
  ).length;
  const played = matches.filter(
    (match) => match.homeGoals !== null && match.awayGoals !== null
  );
  const playedMatches = played.length;
  const now = Date.now();
  const operationalAttention = matches.filter((match) => {
    if (match.homeGoals !== null && match.awayGoals !== null) return false;
    if (!match.date || !match.venueKey || !match.refereeId) return true;
    return match.date.getTime() < now;
  }).length;

  const sheetAppearancesByTeam = new Map<string, number>();
  for (const entry of sheetEntries) {
    sheetAppearancesByTeam.set(entry.teamId, (sheetAppearancesByTeam.get(entry.teamId) ?? 0) + 1);
  }

  const refereeFeesByTeam = new Map<string, number>();
  for (const match of played) {
    const split = Math.floor(match.refereeCostCents / 2);
    refereeFeesByTeam.set(match.homeTeamId, (refereeFeesByTeam.get(match.homeTeamId) ?? 0) + split);
    refereeFeesByTeam.set(match.awayTeamId, (refereeFeesByTeam.get(match.awayTeamId) ?? 0) + (match.refereeCostCents - split));
  }

  const byTeam = teams.map((team) => {
    const teamPlayers = players.filter((player) => player.teamId === team.id);
    const teamAuthorized = teamPlayers.filter((player) =>
      isPlayerEligibleForMatchSheet(player)
    ).length;
    const appearances = sheetAppearancesByTeam.get(team.id) ?? 0;
    const playerFeesCents = appearances * FUTPOLI_RULES.playerFeeCentsPerAppearance;
    const refereeFeesCents = refereeFeesByTeam.get(team.id) ?? 0;
    return {
      teamId: team.id,
      teamName: team.name,
      players: teamPlayers.length,
      authorized: teamAuthorized,
      blocked: teamPlayers.length - teamAuthorized,
      wildcards: teamPlayers.filter((player) => player.wildcardUsed).length,
      appearances,
      playerFeesCents,
      refereeFeesCents,
      totalFeesCents: playerFeesCents + refereeFeesCents,
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
      sheetAppearances: sheetEntries.length,
      playerFeesCents: sheetEntries.length * FUTPOLI_RULES.playerFeeCentsPerAppearance,
      matches: matches.length,
      playedMatches,
      operationalAttention,
      refereeFeesCents: played.reduce((sum, match) => sum + match.refereeCostCents, 0),
    },
    byTeam,
  };
}