import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, ctx: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await ctx.params;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
      stats: {
        include: {
          player: {
            select: { id: true, firstName: true, lastName: true, number: true, teamId: true },
          },
        },
        orderBy: [{ goals: "desc" }, { assists: "desc" }],
      },
    },
  });

  if (!match) {
    return NextResponse.json({ error: "Partita non trovata" }, { status: 404 });
  }

  return NextResponse.json(match);
}
