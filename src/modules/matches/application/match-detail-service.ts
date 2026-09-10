import { prisma } from "@/lib/prisma";
import { sanitizePlayerForRole } from "@/modules/players/application/player-visibility";
import type { SessionUser } from "@/lib/session";
import { AppError } from "@/modules/core/errors";
import {
  isLeagueAdmin,
  isRefereeAssignedToMatch,
} from "@/modules/permissions/permissions";
import { getRefereeMatchFeeCents } from "@/modules/referees/domain/referee-cost";

export async function getMatchDetail({
  matchId,
  session,
}: {
  matchId: string;
  session: SessionUser | null;
}) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      referee: { select: { id: true, name: true } },
      mvpPlayer: { select: { id: true, firstName: true, lastName: true, number: true, teamId: true } },
      homeTeam: {
        select: {
          id: true,
          name: true,
          badgeUrl: true,
          players: {
            orderBy: { number: "asc" },
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
              teamId: true,
              status: true,
              documentSigned: true,
              mediaConsent: true,
            },
          },
        },
      },
      awayTeam: {
        select: {
          id: true,
          name: true,
          badgeUrl: true,
          players: {
            orderBy: { number: "asc" },
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
              teamId: true,
              status: true,
              documentSigned: true,
              mediaConsent: true,
            },
          },
        },
      },
      stats: {
        include: {
          player: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              number: true,
              teamId: true,
            },
          },
        },
        orderBy: [{ goals: "desc" }, { assists: "desc" }],
      },
      sheetPlayers: { select: { playerId: true, teamId: true } },
    },
  });

  if (!match) throw new AppError(404, "Partita non trovata");

  const canViewDraft =
    isLeagueAdmin(session, match.leagueId) ||
    isRefereeAssignedToMatch(session, match.refereeId);
  const canViewRecordedData = match.resultStatus === "FINAL" || canViewDraft;
  const canViewFinalExtras = match.resultStatus === "FINAL" || isLeagueAdmin(session, match.leagueId);
  const { refereeCostCents: _legacyRefereeCostCents, ...visibleMatch } = match;

  return {
    ...visibleMatch,
    homeGoals: canViewRecordedData ? match.homeGoals : null,
    awayGoals: canViewRecordedData ? match.awayGoals : null,
    stats: canViewRecordedData ? match.stats : [],
    sheetPlayers: canViewRecordedData ? match.sheetPlayers : [],
    homeSheetConfirmed: canViewRecordedData ? match.homeSheetConfirmed : false,
    awaySheetConfirmed: canViewRecordedData ? match.awaySheetConfirmed : false,
    finalizedAt: match.resultStatus === "FINAL" || canViewDraft ? match.finalizedAt : null,
    mvpPlayerId: canViewFinalExtras ? match.mvpPlayerId : null,
    mvpPlayer: canViewFinalExtras ? match.mvpPlayer : null,
    replayUrl: canViewFinalExtras ? match.replayUrl : null,
    highlightsUrl: canViewFinalExtras ? match.highlightsUrl : null,
    refereeFeeCents:
      match.venueKey && match.referee
        ? getRefereeMatchFeeCents(match.referee.name)
        : null,
    referee: match.referee
      ? {
          id: match.referee.id,
          name: isLeagueAdmin(session, match.leagueId) || isRefereeAssignedToMatch(session, match.refereeId)
            ? match.referee.name
            : null,
        }
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
