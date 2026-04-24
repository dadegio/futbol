import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrCaptainOfTeam } from "@/lib/server-auth";

function toNonNegInt(value: any) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i < 0) return null;
  return i;
}

export async function POST(req: Request, ctx: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await ctx.params;
  const authErr = await requireAdminOrCaptainOfTeam(teamId);
  if (authErr) return authErr;


  const body = await req.json().catch(() => ({}));
  const firstName = String(body?.firstName ?? "").trim();
  const lastName = String(body?.lastName ?? "").trim();
  const number = toNonNegInt(body?.number);
  const position = body?.position ? String(body.position).trim() : null;
  const photoUrl = body?.photoUrl ? String(body.photoUrl).trim() : null;

  if (!teamId) {
    return NextResponse.json({ error: "teamId mancante nella route" }, { status: 400 });
  }

  if (!firstName || !lastName) {
    return NextResponse.json({ error: "Nome e cognome sono obbligatori" }, { status: 400 });
  }

  if (number === null || number > 99) {
    return NextResponse.json({ error: "Numero maglia non valido (0-99)" }, { status: 400 });
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { players: { select: { id: true } } },
  });

  if (!team) {
    return NextResponse.json({ error: "Squadra non valida" }, { status: 400 });
  }

  if (team.players.length >= 16) {
    return NextResponse.json({ error: "Rosa completa: massimo 16 giocatori" }, { status: 400 });
  }

  try {
    const player = await prisma.player.create({
      data: {
        firstName,
        lastName,
        number,
        position: position || null,
        photoUrl: photoUrl || null,
        team: { connect: { id: teamId } },
      },
    });

    return NextResponse.json(player);
  } catch {
    return NextResponse.json(
      { error: "Numero maglia già usato in questa squadra (o dati non validi)" },
      { status: 400 }
    );
  }
}