export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrCaptainOfTeam } from "@/lib/server-auth";

export async function POST(req: Request, ctx: { params: Promise<{ teamId: string }> }) {
  const { teamId: _swapTeamId } = await ctx.params;
  const authSwapErr = await requireAdminOrCaptainOfTeam(_swapTeamId);
  if (authSwapErr) return authSwapErr;

  const { teamId } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const aPlayerId = String(body?.aPlayerId ?? "").trim();
  const bPlayerId = String(body?.bPlayerId ?? "").trim();

  if (!aPlayerId || !bPlayerId) {
    return NextResponse.json({ error: "playerId mancanti" }, { status: 400 });
  }
  if (aPlayerId === bPlayerId) {
    return NextResponse.json({ error: "Seleziona due giocatori diversi" }, { status: 400 });
  }

  const players = await prisma.player.findMany({
    where: { id: { in: [aPlayerId, bPlayerId] } },
    select: { id: true, teamId: true, number: true },
  });

  const a = players.find(p => p.id === aPlayerId);
  const b = players.find(p => p.id === bPlayerId);

  if (!a || !b) return NextResponse.json({ error: "Giocatore non trovato" }, { status: 404 });
  if (a.teamId !== teamId || b.teamId !== teamId) {
    return NextResponse.json({ error: "I giocatori non appartengono a questa squadra" }, { status: 400 });
  }

  // scegli un numero temporaneo sicuro (negativo). Il numero è Int e non hai vincoli >0.
  const TEMP = -1;

  try {
    await prisma.$transaction(async (tx) => {
      // A -> TEMP
      await tx.player.update({
        where: { id: aPlayerId },
        data: { number: TEMP },
      });

      // B -> numero di A
      await tx.player.update({
        where: { id: bPlayerId },
        data: { number: a.number },
      });

      // A -> numero di B
      await tx.player.update({
        where: { id: aPlayerId },
        data: { number: b.number },
      });
    });
  } catch (e: any) {
    return NextResponse.json({ error: "Errore scambio numeri" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}