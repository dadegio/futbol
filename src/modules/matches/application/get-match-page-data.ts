import "server-only";

import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";
import { sanitizePlayerForRole } from "@/modules/players/application/player-visibility";
import { isCaptainOfTeam, isLeagueAdmin, isRefereeAssignedToMatch } from "@/modules/permissions/permissions";
import { getRefereeMatchFeeCents } from "@/modules/referees/domain/referee-cost";

export async function getMatchPageData(
  leagueId: string,
  matchId: string,
  session: SessionUser | null = null
) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      referee: {
        select: {
          id: true,
          name: true,
        },
      },
      homeTeam: { include: { players: { orderBy: { number: "asc" } } } },
      awayTeam: { include: { players: { orderBy: { number: "asc" } } } },
      stats: true,
      mvpPlayer: { select: { id: true, firstName: true, lastName: true, number: true } },
      sheetPlayers: { select: { playerId: true, teamId: true } },
      lineups: {
        select: {
          teamId: true,
          formation: true,
          updatedAt: true,
          players: {
            select: {
              playerId: true,
              status: true,
              positionX: true,
              positionY: true,
              sortOrder: true,
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  if (!match || match.leagueId !== leagueId) return null;

  const isCaptainOfMatch =
    isCaptainOfTeam(session, match.homeTeamId) ||
    isCaptainOfTeam(session, match.awayTeamId);
  const canViewDraft =
    isLeagueAdmin(session, match.leagueId) ||
    isRefereeAssignedToMatch(session, match.refereeId);
  const canViewRecordedData = match.resultStatus === "FINAL" || canViewDraft;
  const canViewFinalExtras = match.resultStatus === "FINAL" || isLeagueAdmin(session, match.leagueId);

  const coachSuggestedLineup =
    canViewDraft && match.sheetPlayers.length === 0
      ? match.lineups.flatMap((lineup) =>
          lineup.players.map((player) => ({
            teamId: lineup.teamId,
            playerId: player.playerId,
            status: player.status,
          }))
        )
      : [];

  const effectiveSheetPlayers =
    match.sheetPlayers.length > 0
      ? match.sheetPlayers
      : coachSuggestedLineup.map((player) => ({
          teamId: player.teamId,
          playerId: player.playerId,
        }));

  const lineupTeamIds = new Set(match.lineups.map((lineup) => lineup.teamId));
  const fallbackSheetPlayers = match.sheetPlayers.filter(
    (row) => !lineupTeamIds.has(row.teamId)
  );

  const { refereeCostCents: _legacyRefereeCostCents, lineups: _lineups, ...visibleMatch } = match;

  return {
    ...visibleMatch,
    homeGoals: canViewRecordedData ? match.homeGoals : null,
    awayGoals: canViewRecordedData ? match.awayGoals : null,
    stats: canViewRecordedData ? match.stats : [],
    sheetPlayers: canViewDraft ? effectiveSheetPlayers : fallbackSheetPlayers,
    coachSuggestedLineup,
    publishedLineups: match.lineups,
    homeSheetConfirmed: canViewRecordedData ? match.homeSheetConfirmed : false,
    awaySheetConfirmed: canViewRecordedData ? match.awaySheetConfirmed : false,
    finalizedAt: match.resultStatus === "FINAL" || canViewDraft ? match.finalizedAt : null,
    mvpPlayerId: canViewFinalExtras ? match.mvpPlayerId : null,
    mvpPlayer: canViewFinalExtras ? match.mvpPlayer : null,
    replayUrl: canViewFinalExtras ? match.replayUrl : null,
    highlightsUrl: canViewFinalExtras ? match.highlightsUrl : null,
    referee: match.referee ? { id: match.referee.id } : null,
    refereeFeeCents:
      match.venueKey && match.referee
        ? getRefereeMatchFeeCents(match.referee.name)
        : null,
    homeTeam: {
      ...match.homeTeam,
      players: match.homeTeam.players.map((player) =>
        sanitizePlayerForRole(player, session, match.leagueId)
      ),
    },
    awayTeam: {
      ...match.awayTeam,
      players: match.awayTeam.players.map((player) =>
        sanitizePlayerForRole(player, session, match.leagueId)
      ),
    },
  };
}
