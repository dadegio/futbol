export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function toPositiveInt(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i <= 0) return null;
  return i;
}

export async function GET(_: Request, ctx: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await ctx.params;

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      number: true,
      team: {
        select: {
          id: true,
          name: true,
          leagueId: true,
        },
      },
    },
  });

  if (!player) {
    return NextResponse.json({ error: "Giocatore non trovato" }, { status: 404 });
  }

  return NextResponse.json(player);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const firstName = String(body?.firstName ?? "").trim();
  const lastName = String(body?.lastName ?? "").trim();
  const number = toPositiveInt(body?.number);

  if (!firstName || !lastName) {
    return NextResponse.json({ error: "Nome e cognome sono obbligatori" }, { status: 400 });
  }

  if (number === null || number > 99) {
    return NextResponse.json({ error: "Numero maglia non valido (1-99)" }, { status: 400 });
  }

  const existing = await prisma.player.findUnique({
    where: { id: playerId },
    select: { id: true, teamId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Giocatore non trovato" }, { status: 404 });
  }

  try {
    const updated = await prisma.player.update({
      where: { id: playerId },
      data: {
        firstName,
        lastName,
        number,
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Numero maglia già usato in questa squadra" },
      { status: 409 }
    );
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await ctx.params;

  const existing = await prisma.player.findUnique({
    where: { id: playerId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Giocatore non trovato" }, { status: 404 });
  }

  await prisma.player.delete({
    where: { id: playerId },
  });

  return NextResponse.json({ ok: true });
}
