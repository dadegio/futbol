import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/server-auth";

export async function GET(_: Request, ctx: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await ctx.params;

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, name: true, playoffFormat: true, playoffTeamCount: true },
  });

  if (!league) {
    return NextResponse.json({ error: "Campionato non trovato" }, { status: 404 });
  }

  return NextResponse.json(league);
}

export async function DELETE(_: Request, ctx: { params: Promise<{ leagueId: string }> }) {
  const authErr = await requireAdmin();
  if (authErr) return authErr;

  const { leagueId } = await ctx.params;

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true },
  });

  if (!league) {
    return NextResponse.json({ error: "Campionato non trovato" }, { status: 404 });
  }

  await prisma.league.delete({ where: { id: leagueId } });
  return NextResponse.json({ ok: true });
}