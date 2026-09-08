import { prisma } from "@/lib/prisma";
import { sanitizePlayerForRole } from "@/lib/player-visibility";
import type { SessionUser } from "@/lib/session";
import { AppError } from "@/modules/core/api";
import { isLeagueAdmin } from "@/modules/permissions/permissions";

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

  return {
    ...match,
    referee: match.referee
      ? {
          id: match.referee.id,
          name: isLeagueAdmin(session, match.leagueId)
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