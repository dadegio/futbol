import "server-only";

import { prisma } from "@/lib/prisma";
import { sanitizePlayerForRole } from "@/lib/player-visibility";

export async function getMatchPageData(leagueId: string, matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      referee: {
        select: {
          id: true,
        },
      },
      homeTeam: { include: { players: { orderBy: { number: "asc" } } } },
      awayTeam: { include: { players: { orderBy: { number: "asc" } } } },
      stats: true,
      sheetPlayers: { select: { playerId: true, teamId: true } },
    },
  });

  if (!match || match.leagueId !== leagueId) return null;

  return {
    ...match,
    homeTeam: {
      ...match.homeTeam,
      players: match.homeTeam.players.map((player) => sanitizePlayerForRole(player, null)),
    },
    awayTeam: {
      ...match.awayTeam,
      players: match.awayTeam.players.map((player) => sanitizePlayerForRole(player, null)),
    },
  };
}