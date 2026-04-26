export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncPlayoffSeriesWinner } from "@/lib/playoff-progress";
import { requireAdminOrCaptainOfPlayoffSeries } from "@/lib/server-auth";

type Ctx = { params: Promise<{ leagueId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { leagueId } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const seriesId = String(body?.seriesId ?? "").trim();
  if (!seriesId) {
    return NextResponse.json({ error: "seriesId mancante" }, { status: 400 });
  }

  const authErr = await requireAdminOrCaptainOfPlayoffSeries(seriesId);
  if (authErr) return authErr;

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { playoffFormat: true },
  });

  if (!league?.playoffFormat) {
    return NextResponse.json({ error: "Playoff non configurati" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction((tx) =>
      syncPlayoffSeriesWinner(tx, {
        leagueId,
        seriesId,
        format: league.playoffFormat!,
      })
    );

    if (!result) {
      return NextResponse.json(
        {
          error:
            "Risultato non determinabile. Inserisci tutti i risultati o risolvi il pareggio manualmente.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, winnerId: result });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Errore avanzamento playoff" },
      { status: 500 }
    );
  }
}