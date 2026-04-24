import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/server-auth";

export async function GET(_: Request, ctx: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await ctx.params;

  const teams = await prisma.team.findMany({
    where: { leagueId },
    orderBy: { name: "asc" },
    include: { players: { orderBy: { number: "asc" } } },
  });

  return NextResponse.json(teams);
}

export async function POST(req: Request, ctx: { params: Promise<{ leagueId: string }> }) {
  const authErr = await requireAdmin();
  if (authErr) return authErr;

  const { leagueId } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  const badgeUrl = body?.badgeUrl ? String(body.badgeUrl).trim() : null;

  if (!name) {
    return NextResponse.json({ error: "Nome squadra mancante" }, { status: 400 });
  }

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true },
  });

  if (!league) {
    return NextResponse.json({ error: "Lega non valida" }, { status: 400 });
  }

  try {
    const team = await prisma.team.create({
      data: {
        name,
        badgeUrl: badgeUrl || undefined,
        league: { connect: { id: leagueId } },
      },
    });

    return NextResponse.json(team);
  } catch {
    return NextResponse.json(
      { error: "Squadra già esistente (stessa lega) o errore dati" },
      { status: 400 }
    );
  }
}