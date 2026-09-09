import "server-only";

import { prisma } from "@/lib/prisma";
import { sanitizePlayerForRole } from "@/modules/players/application/player-visibility";
import { getRefereeMatchFeeCents } from "@/modules/referees/domain/referee-cost";

export async function getMatchPageData(leagueId: string, matchId: string) {
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
      sheetPlayers: { select: { playerId: true, teamId: true } },
    },
  });

  if (!match || match.leagueId !== leagueId) return null;

  const { refereeCostCents: _legacyRefereeCostCents, ...visibleMatch } = match;

  return {
    ...visibleMatch,
    referee: match.referee ? { id: match.referee.id } : null,
    refereeFeeCents:
      match.venueKey && match.referee
        ? getRefereeMatchFeeCents(match.referee.name)
        : null,
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