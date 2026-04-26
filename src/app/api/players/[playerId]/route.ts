export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _: Request,
  ctx: { params: Promise<{ playerId: string }> }
) {
  const { playerId } = await ctx.params;

  const [agg, recentStats] = await Promise.all([
    prisma.matchPlayerStat.aggregate({
      where: { playerId },
      _sum: {
        goals: true,
        assists: true,
      },
      _count: {
        matchId: true,
      },
    }),
    prisma.matchPlayerStat.findMany({
      where: { playerId },
      orderBy: { match: { date: "desc" } },
      take: 8,
      select: {
        goals: true,
        assists: true,
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
  ]);

  return NextResponse.json({
    goals: agg._sum.goals ?? 0,
    assists: agg._sum.assists ?? 0,
    appearances: agg._count.matchId ?? 0,
    recentMatches: recentStats.map((row) => ({
      matchId: row.match.id,
      date: row.match.date,
      homeTeamName: row.match.homeTeam.name,
      awayTeamName: row.match.awayTeam.name,
      homeGoals: row.match.homeGoals,
      awayGoals: row.match.awayGoals,
      goals: row.goals,
      assists: row.assists,
    })),
  });
}