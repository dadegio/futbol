import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrCaptainOfMatch } from "@/lib/server-auth";

type Body = {
  homeGoals?: number;
  awayGoals?: number;
  playerStats?: Array<{ playerId: string; goals: number; assists: number }>;
};

function asNonNegInt(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  const i = Math.floor(x);
  if (i < 0) return null;
  return i;
}

export async function POST(req: Request, ctx: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await ctx.params;
  const authErr = await requireAdminOrCaptainOfMatch(matchId);
  if (authErr) return authErr;

  const body = (await req.json().catch(() => ({}))) as Body;

  const homeGoals = body.homeGoals === undefined ? undefined : asNonNegInt(body.homeGoals);
  const awayGoals = body.awayGoals === undefined ? undefined : asNonNegInt(body.awayGoals);

  if (homeGoals === null) return NextResponse.json({ error: "homeGoals non valido" }, { status: 400 });
  if (awayGoals === null) return NextResponse.json({ error: "awayGoals non valido" }, { status: 400 });

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, leagueId: true, homeTeamId: true, awayTeamId: true },
  });
  if (!match) return NextResponse.json({ error: "Partita non trovata" }, { status: 404 });

  const rows = Array.isArray(body.playerStats) ? body.playerStats : [];

  // validazione stats
  for (const r of rows) {
    if (!r?.playerId) return NextResponse.json({ error: "playerId mancante" }, { status: 400 });
    const g = asNonNegInt(r.goals);
    const a = asNonNegInt(r.assists);
    if (g === null || a === null) return NextResponse.json({ error: "goals/assists non validi" }, { status: 400 });
  }

  // prendi i player per verificare che appartengano a una delle due squadre
  const playerIds = [...new Set(rows.map(r => r.playerId))];
  const players = playerIds.length
    ? await prisma.player.findMany({
        where: { id: { in: playerIds } },
        select: { id: true, teamId: true },
      })
    : [];

  const playerTeam = new Map(players.map(p => [p.id, p.teamId]));
  for (const pid of playerIds) {
    const tid = playerTeam.get(pid);
    if (!tid) return NextResponse.json({ error: "Giocatore non valido" }, { status: 400 });
    if (tid !== match.homeTeamId && tid !== match.awayTeamId) {
      return NextResponse.json({ error: "Un giocatore non appartiene alle squadre della partita" }, { status: 400 });
    }
  }

  // transazione: aggiorna risultato + riscrive completamente le stats della partita
  await prisma.$transaction(async tx => {
    await tx.match.update({
      where: { id: matchId },
      data: {
        ...(homeGoals !== undefined ? { homeGoals } : {}),
        ...(awayGoals !== undefined ? { awayGoals } : {}),
      },
    });

    // reset stats di quel match (idempotente)
    await tx.matchPlayerStat.deleteMany({ where: { matchId } });

    if (rows.length) {
      await tx.matchPlayerStat.createMany({
        data: rows.map(r => ({
          matchId,
          playerId: r.playerId,
          goals: Math.floor(r.goals),
          assists: Math.floor(r.assists),
        })),
      });
    }
  });

  return NextResponse.json({ ok: true });
}