export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _: Request,
  ctx: { params: Promise<{ playerId: string }> }
) {
  const { playerId } = await ctx.params;

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      teamId: true,
    },
  });

  if (!player) {
    return NextResponse.json(
      { error: "Giocatore non trovato" },
      { status: 404 }
    );
  }

  const [agg, appearances, recentMatches, recentStats] = await Promise.all([
    prisma.matchPlayerStat.aggregate({
      where: { playerId },
      _sum: {
        goals: true,
        assists: true,
      },
    }),

    prisma.match.count({
      where: {
        homeGoals: { not: null },
        awayGoals: { not: null },
        OR: [
          { homeTeamId: player.teamId },
          { awayTeamId: player.teamId },
        ],
      },
    }),

    prisma.match.findMany({
      where: {
        homeGoals: { not: null },
        awayGoals: { not: null },
        OR: [
          { homeTeamId: player.teamId },
          { awayTeamId: player.teamId },
        ],
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 8,
      select: {
        id: true,
        date: true,
        homeGoals: true,
        awayGoals: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
      },
    }),

    prisma.matchPlayerStat.findMany({
      where: { playerId },
      select: {
        matchId: true,
        goals: true,
        assists: true,
      },
    }),
  ]);

  const statsByMatch = new Map(
    recentStats.map((row) => [
      row.matchId,
      { goals: row.goals, assists: row.assists },
    ])
  );

  return NextResponse.json({
    goals: agg._sum.goals ?? 0,
    assists: agg._sum.assists ?? 0,
    appearances,
    recentMatches: recentMatches.map((match) => {
      const stat = statsByMatch.get(match.id);

      return {
        matchId: match.id,
        date: match.date,
        homeTeamName: match.homeTeam.name,
        awayTeamName: match.awayTeam.name,
        homeGoals: match.homeGoals,
        awayGoals: match.awayGoals,
        goals: stat?.goals ?? 0,
        assists: stat?.assists ?? 0,
      };
    }),
  });
}