export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type PlayerLookup = {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  team: {
    name: string;
    badgeUrl: string | null;
  } | null;
};

type StatRow = {
  playerId: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  teamName: string;
  teamBadgeUrl: string | null;
  value: number;
};

export async function GET(
  _: Request,
  ctx: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await ctx.params;

  const scorersAgg = await prisma.matchPlayerStat.groupBy({
    by: ["playerId"],
    _sum: { goals: true },
    where: { match: { leagueId } },
    orderBy: { _sum: { goals: "desc" } },
    take: 5,
  });

  const assistsAgg = await prisma.matchPlayerStat.groupBy({
    by: ["playerId"],
    _sum: { assists: true },
    where: { match: { leagueId } },
    orderBy: { _sum: { assists: "desc" } },
    take: 5,
  });

  const appearancesAgg = await prisma.matchPlayerStat.groupBy({
    by: ["playerId"],
    _count: { playerId: true },
    where: { match: { leagueId } },
    orderBy: { _count: { playerId: "desc" } },
    take: 5,
  });

  const allIds = Array.from(
    new Set([
      ...scorersAgg.map((x) => x.playerId),
      ...assistsAgg.map((x) => x.playerId),
      ...appearancesAgg.map((x) => x.playerId),
    ])
  );

  const rawPlayers = await prisma.player.findMany({
    where: { id: { in: allIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      photoUrl: true,
      team: {
        select: {
          name: true,
          badgeUrl: true,
        },
      },
    },
  });

  const players: PlayerLookup[] = rawPlayers.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    photoUrl: p.photoUrl ?? null,
    team: p.team
      ? {
          name: p.team.name,
          badgeUrl: p.team.badgeUrl ?? null,
        }
      : null,
  }));

  const byId = new Map<string, PlayerLookup>(
    players.map((p) => [p.id, p])
  );

  const scorers: StatRow[] = scorersAgg.map((x) => {
    const p = byId.get(x.playerId);

    return {
      playerId: x.playerId,
      firstName: p?.firstName ?? "",
      lastName: p?.lastName ?? "",
      photoUrl: p?.photoUrl ?? null,
      teamName: p?.team?.name ?? "",
      teamBadgeUrl: p?.team?.badgeUrl ?? null,
      value: x._sum.goals ?? 0,
    };
  });

  const assists: StatRow[] = assistsAgg.map((x) => {
    const p = byId.get(x.playerId);

    return {
      playerId: x.playerId,
      firstName: p?.firstName ?? "",
      lastName: p?.lastName ?? "",
      photoUrl: p?.photoUrl ?? null,
      teamName: p?.team?.name ?? "",
      teamBadgeUrl: p?.team?.badgeUrl ?? null,
      value: x._sum.assists ?? 0,
    };
  });

  const appearances: StatRow[] = appearancesAgg.map((x) => {
    const p = byId.get(x.playerId);

    return {
      playerId: x.playerId,
      firstName: p?.firstName ?? "",
      lastName: p?.lastName ?? "",
      photoUrl: p?.photoUrl ?? null,
      teamName: p?.team?.name ?? "",
      teamBadgeUrl: p?.team?.badgeUrl ?? null,
      value: x._count.playerId ?? 0,
    };
  });

  return NextResponse.json({
    scorers,
    assists,
    appearances,
  });
}