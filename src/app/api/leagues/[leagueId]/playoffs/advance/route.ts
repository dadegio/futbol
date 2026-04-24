export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { determineSeriesWinner } from "@/lib/bracket";
import { requireAdmin } from "@/lib/server-auth";

type Ctx = { params: Promise<{ leagueId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { leagueId } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const seriesId = body?.seriesId;
  if (!seriesId) {
    return NextResponse.json({ error: "seriesId mancante" }, { status: 400 });
  }

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { playoffFormat: true },
  });

  if (!league?.playoffFormat) {
    return NextResponse.json({ error: "Playoff non configurati" }, { status: 400 });
  }

  const series = await prisma.playoffSeries.findUnique({
    where: { id: seriesId },
    include: {
      matches: {
        select: {
          homeTeamId: true,
          awayTeamId: true,
          homeGoals: true,
          awayGoals: true,
          leg: true,
        },
      },
    },
  });

  if (!series || series.leagueId !== leagueId) {
    return NextResponse.json({ error: "Serie non trovata" }, { status: 404 });
  }

  const winnerId = determineSeriesWinner(series.matches, league.playoffFormat);

  if (!winnerId) {
    return NextResponse.json(
      { error: "Risultato non determinabile. Inserisci tutti i risultati o risolvi il pareggio manualmente." },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    // Set winner on the series
    await tx.playoffSeries.update({
      where: { id: seriesId },
      data: { winnerId },
    });

    // Advance winner to next series if it exists
    if (series.feedsIntoSeriesId) {
      const nextSeries = await tx.playoffSeries.findUnique({
        where: { id: series.feedsIntoSeriesId },
        select: { id: true, homeTeamId: true, awayTeamId: true },
      });

      if (nextSeries) {
        // Determine which slot: even position -> home, odd position -> away
        const isHome = series.position % 2 === 0;
        await tx.playoffSeries.update({
          where: { id: nextSeries.id },
          data: isHome ? { homeTeamId: winnerId } : { awayTeamId: winnerId },
        });

        // If next series now has both teams, create match(es)
        const updatedNext = await tx.playoffSeries.findUnique({
          where: { id: nextSeries.id },
          select: { homeTeamId: true, awayTeamId: true },
        });

        if (updatedNext?.homeTeamId && updatedNext?.awayTeamId) {
          const existingMatches = await tx.match.count({ where: { seriesId: nextSeries.id } });
          if (existingMatches === 0) {
            await tx.match.create({
              data: {
                leagueId,
                round: 0,
                homeTeamId: updatedNext.homeTeamId,
                awayTeamId: updatedNext.awayTeamId,
                seriesId: nextSeries.id,
                leg: 1,
              },
            });

            if (league.playoffFormat === "TWO_LEG") {
              await tx.match.create({
                data: {
                  leagueId,
                  round: 0,
                  homeTeamId: updatedNext.awayTeamId,
                  awayTeamId: updatedNext.homeTeamId,
                  seriesId: nextSeries.id,
                  leg: 2,
                },
              });
            }
          }
        }
      }
    }
  });

  return NextResponse.json({ ok: true, winnerId });
}
