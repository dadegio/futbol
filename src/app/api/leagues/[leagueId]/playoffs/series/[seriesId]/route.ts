export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ leagueId: string; seriesId: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  const { leagueId, seriesId } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const series = await prisma.playoffSeries.findUnique({
    where: { id: seriesId },
    select: { id: true, leagueId: true, bracketRound: true },
  });

  if (!series || series.leagueId !== leagueId) {
    return NextResponse.json({ error: "Serie non trovata" }, { status: 404 });
  }

  const homeTeamId = body?.homeTeamId ?? undefined;
  const awayTeamId = body?.awayTeamId ?? undefined;

  // Validate teams belong to this league
  const teamIds = [homeTeamId, awayTeamId].filter(Boolean);
  if (teamIds.length > 0) {
    const teams = await prisma.team.findMany({
      where: { leagueId, id: { in: teamIds } },
      select: { id: true },
    });
    if (teams.length !== teamIds.length) {
      return NextResponse.json({ error: "Squadra non valida per questa lega" }, { status: 400 });
    }
  }

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { playoffFormat: true },
  });

  if (!league?.playoffFormat) {
    return NextResponse.json({ error: "Playoff non configurati" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    // Update team assignments
    await tx.playoffSeries.update({
      where: { id: seriesId },
      data: {
        ...(homeTeamId !== undefined ? { homeTeamId } : {}),
        ...(awayTeamId !== undefined ? { awayTeamId } : {}),
      },
    });

    // If both teams are now set, create match(es) if they don't exist
    const updated = await tx.playoffSeries.findUnique({
      where: { id: seriesId },
      select: { homeTeamId: true, awayTeamId: true },
    });

    if (updated?.homeTeamId && updated?.awayTeamId) {
      const existingMatches = await tx.match.count({ where: { seriesId } });
      if (existingMatches === 0) {
        await tx.match.create({
          data: {
            leagueId,
            round: 0,
            homeTeamId: updated.homeTeamId,
            awayTeamId: updated.awayTeamId,
            seriesId,
            leg: 1,
          },
        });

        if (league!.playoffFormat === "TWO_LEG") {
          await tx.match.create({
            data: {
              leagueId,
              round: 0,
              homeTeamId: updated.awayTeamId,
              awayTeamId: updated.homeTeamId,
              seriesId,
              leg: 2,
            },
          });
        }
      }
    }
  });

  return NextResponse.json({ ok: true });
}
