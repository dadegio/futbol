export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Row = {
  teamId: string;
  teamName: string;
  badgeUrl: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

export async function GET(_: Request, ctx: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await ctx.params;

  const teams = await prisma.team.findMany({
    where: { leagueId },
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

  const map = new Map<string, Row>();

  for (const t of teams) {
    map.set(t.id, {
      teamId: t.id,
      teamName: t.name,
      badgeUrl: t.badgeUrl,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      points: 0,
    });
  }

  for (const m of matches) {
    const hg = m.homeGoals ?? 0;
    const ag = m.awayGoals ?? 0;

    const home = map.get(m.homeTeamId);
    const away = map.get(m.awayTeamId);
    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;

    home.gf += hg;
    home.ga += ag;

    away.gf += ag;
    away.ga += hg;

    if (hg > ag) {
      home.wins += 1;
      away.losses += 1;
      home.points += 3;
    } else if (hg < ag) {
      away.wins += 1;
      home.losses += 1;
      away.points += 3;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  for (const r of map.values()) {
    r.gd = r.gf - r.ga;
  }

  const table = Array.from(map.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    if (a.ga !== b.ga) return a.ga - b.ga;
    return a.teamName.localeCompare(b.teamName);
  });

  return NextResponse.json(table);
}