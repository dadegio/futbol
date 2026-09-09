import { prisma } from "@/lib/prisma";
import { isPlayerEligibleForMatchSheet } from "@/modules/players/domain/tournament-rules";
import { AppError } from "@/modules/core/errors";

function normalizeQuery(query: string) {
  return query.trim().replace(/\s+/g, " ").slice(0, 80);
}

export async function searchLeagueAdmin(leagueId: string, query: string) {
  const q = normalizeQuery(query);
  if (q.length < 2) {
    return { query: q, teams: [], players: [], referees: [], matches: [] };
  }

  const league = await prisma.league.findUnique({ where: { id: leagueId }, select: { id: true } });
  if (!league) throw new AppError(404, "Torneo non trovato");

  const [teams, players, referees, matches] = await Promise.all([
    prisma.team.findMany({
      where: { leagueId, activeInLeague: true, name: { contains: q, mode: "insensitive" } },
      take: 6,
      orderBy: { name: "asc" },
      select: { id: true, name: true, badgeUrl: true },
    }),
    prisma.player.findMany({
      where: {
        team: { leagueId, activeInLeague: true },
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { team: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      take: 8,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        number: true,
        status: true,
        documentSigned: true,
        mediaConsent: true,
        team: { select: { id: true, name: true } },
      },
    }),
    prisma.referee.findMany({
      where: { leagueId, name: { contains: q, mode: "insensitive" } },
      take: 6,
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: { id: true, name: true, active: true, team: { select: { name: true } } },
    }),
    prisma.match.findMany({
      where: {
        leagueId,
        OR: [
          { homeTeam: { name: { contains: q, mode: "insensitive" } } },
          { awayTeam: { name: { contains: q, mode: "insensitive" } } },
          ...(Number.isInteger(Number(q)) ? [{ round: Number(q) }] : []),
        ],
      },
      take: 8,
      orderBy: [{ date: "desc" }, { round: "asc" }],
      select: {
        id: true,
        round: true,
        date: true,
        homeGoals: true,
        awayGoals: true,
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
      },
    }),
  ]);

  return {
    query: q,
    teams,
    players: players.map((player) => ({
      id: player.id,
      firstName: player.firstName,
      lastName: player.lastName,
      number: player.number,
      team: player.team,
      eligible: isPlayerEligibleForMatchSheet(player),
    })),
    referees,
    matches: matches.map((match) => ({
      ...match,
      date: match.date?.toISOString() ?? null,
    })),
  };
}
