export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type PlayerInfo = {
  id: string;
  firstName: string;
  lastName: string;
  team: {
    name: string;
    badgeUrl: string | null;
  } | null;
};

export async function GET(
  _: Request,
  ctx: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await ctx.params;

  const scorersAgg = await prisma.matchPlayerStat.groupBy({
    by: ["playerId"],
    _sum: { goals: true },
    where: {
      match: { leagueId },
      goals: { gt: 0 },
    },
    orderBy: { _sum: { goals: "desc" } },
    take: 10,
  });

  const assistsAgg = await prisma.matchPlayerStat.groupBy({
    by: ["playerId"],
    _sum: { assists: true },
    where: {
      match: { leagueId },
      assists: { gt: 0 },
    },
    orderBy: { _sum: { assists: "desc" } },
    take: 10,
  });

  const appearancesAgg = await prisma.matchPlayerStat.groupBy({
    by: ["playerId"],
    _count: { playerId: true },
    where: {
      match: { leagueId },
    },
    orderBy: { _count: { playerId: "desc" } },
    take: 10,
  });

  const scorerIds = scorersAgg.map((item) => item.playerId);
  const assistIds = assistsAgg.map((item) => item.playerId);
  const appearanceIds = appearancesAgg.map((item) => item.playerId);

  const allIds = Array.from(
    new Set([...scorerIds, ...assistIds, ...appearanceIds])
  );

  const players: PlayerInfo[] = await prisma.player.findMany({
    where: { id: { in: allIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      team: {
        select: {
          name: true,
          badgeUrl: true,
        },
      },
    },
  });

  const byId = new Map<string, PlayerInfo>(
    players.map((player) => [player.id, player])
  );

  const scorers = scorersAgg.map((item) => {
    const player = byId.get(item.playerId);

    return {
      playerId: item.playerId,
      firstName: player?.firstName ?? "",
      lastName: player?.lastName ?? "",
      teamName: player?.team?.name ?? "",
      teamBadgeUrl: player?.team?.badgeUrl ?? null,
      value: item._sum.goals ?? 0,
    };
  });

  const assists = assistsAgg.map((item) => {
    const player = byId.get(item.playerId);

    return {
      playerId: item.playerId,
      firstName: player?.firstName ?? "",
      lastName: player?.lastName ?? "",
      teamName: player?.team?.name ?? "",
      teamBadgeUrl: player?.team?.badgeUrl ?? null,
      value: item._sum.assists ?? 0,
    };
  });

  const appearances = appearancesAgg.map((item) => {
    const player = byId.get(item.playerId);

    return {
      playerId: item.playerId,
      firstName: player?.firstName ?? "",
      lastName: player?.lastName ?? "",
      teamName: player?.team?.name ?? "",
      teamBadgeUrl: player?.team?.badgeUrl ?? null,
      value: item._count.playerId ?? 0,
    };
  });

  return NextResponse.json({
    scorers,
    assists,
    appearances,
  });
}