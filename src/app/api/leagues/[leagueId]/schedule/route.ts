import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateRoundRobin } from "@/lib/scheduler";
import { requireAdmin } from "@/lib/server-auth";

export async function GET(req: Request, ctx: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await ctx.params;

  const { searchParams } = new URL(req.url);
  const phase = searchParams.get("phase") ?? "league";

  const seriesFilter =
    phase === "playoff"
      ? { seriesId: { not: null as unknown as string } }
      : phase === "all"
        ? {}
        : { seriesId: null };

  const matches = await prisma.match.findMany({
    where: { leagueId, ...seriesFilter },
    orderBy: [{ round: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      leagueId: true,
      round: true,
      date: true,
      homeGoals: true,
      awayGoals: true,
      seriesId: true,
      leg: true,
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(matches);
}

export async function POST(req: Request, ctx: { params: Promise<{ leagueId: string }> }) {
  const authErr = await requireAdmin();
  if (authErr) return authErr;

  const { leagueId } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const mode = String(body?.mode ?? "");

  // modalità manuale
  if (mode === "manual") {
    const round = Number(body?.round);
    const homeTeamId = String(body?.homeTeamId ?? "").trim();
    const awayTeamId = String(body?.awayTeamId ?? "").trim();
    const dateRaw = body?.date ? String(body.date).trim() : null;

    if (!Number.isInteger(round) || round <= 0) {
      return NextResponse.json({ error: "Giornata non valida" }, { status: 400 });
    }

    if (!homeTeamId || !awayTeamId) {
      return NextResponse.json({ error: "Squadre mancanti" }, { status: 400 });
    }

    if (homeTeamId === awayTeamId) {
      return NextResponse.json({ error: "Una squadra non può giocare contro se stessa" }, { status: 400 });
    }

    const teams = await prisma.team.findMany({
      where: {
        leagueId,
        id: { in: [homeTeamId, awayTeamId] },
      },
      select: { id: true },
    });

    if (teams.length !== 2) {
      return NextResponse.json({ error: "Squadre non valide per questa lega" }, { status: 400 });
    }

    try {
      const match = await prisma.match.create({
        data: {
          leagueId,
          round,
          homeTeamId,
          awayTeamId,
          ...(dateRaw ? { date: new Date(dateRaw) } : {}),
        },
      });

      return NextResponse.json(match);
    } catch {
      return NextResponse.json(
        { error: "Partita duplicata o dati non validi" },
        { status: 400 }
      );
    }
  }

  // modalità automatica
  const random = body?.random !== false;
  const seed =
    body?.seed === undefined || body?.seed === null || String(body.seed).trim() === ""
      ? undefined
      : Number(body.seed);

  if (seed !== undefined && !Number.isFinite(seed)) {
    return NextResponse.json({ error: "Seed non valido" }, { status: 400 });
  }

  const teams = await prisma.team.findMany({
    where: { leagueId },
    select: { id: true },
  });

  const teamIds = teams.map((t) => t.id);
  if (teamIds.length < 2) {
    return NextResponse.json({ error: "Servono almeno 2 squadre" }, { status: 400 });
  }

  await prisma.match.deleteMany({ where: { leagueId, seriesId: null } });

  const pairings = generateRoundRobin(teamIds, { random, seed });

  await prisma.match.createMany({
    data: pairings.map((p) => ({
      leagueId,
      round: p.round,
      homeTeamId: p.homeTeamId,
      awayTeamId: p.awayTeamId,
    })),
  });

  const rounds = pairings.length ? Math.max(...pairings.map((p) => p.round)) : 0;
  return NextResponse.json({ created: pairings.length, rounds });
}