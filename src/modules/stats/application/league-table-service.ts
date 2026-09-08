import { prisma } from "@/lib/prisma";
import { calculateLeagueTable } from "@/modules/stats/domain/league-table";

export async function getLeagueTable(leagueId: string) {
  const teams = await prisma.team.findMany({
    where: { leagueId, activeInLeague: true },
    select: { id: true, name: true, badgeUrl: true },
    orderBy: { name: "asc" },
  });

  const matches = await prisma.match.findMany({
    where: {
      leagueId,
      seriesId: null,
      homeGoals: { not: null },
      awayGoals: { not: null },
    },
    select: { homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true },
  });

  return calculateLeagueTable(teams, matches);
}
