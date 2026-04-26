export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrCaptainOfTeam } from "@/lib/server-auth";

export async function GET(
  _: Request,
  ctx: { params: Promise<{ playerId: string }> }
) {
  const { playerId } = await ctx.params;

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      number: true,
      position: true,
      photoUrl: true,
      teamId: true,
      team: {
        select: {
          id: true,
          name: true,
          badgeUrl: true,
          leagueId: true,
          league: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!player) {
    return NextResponse.json(
      { error: "Giocatore non trovato" },
      { status: 404 }
    );
  }

  return NextResponse.json(player);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ playerId: string }> }
) {
  const { playerId } = await ctx.params;

  const existing = await prisma.player.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      teamId: true,
    },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Giocatore non trovato" },
      { status: 404 }
    );
  }

  const authErr = await requireAdminOrCaptainOfTeam(existing.teamId);
  if (authErr) return authErr;

  const body = await req.json().catch(() => ({}));

  const firstName =
    body?.firstName !== undefined ? String(body.firstName).trim() : undefined;

  const lastName =
    body?.lastName !== undefined ? String(body.lastName).trim() : undefined;

  const number =
    body?.number !== undefined ? Number(body.number) : undefined;

  const position =
    body?.position === undefined
      ? undefined
      : body.position === null
        ? null
        : String(body.position).trim() || null;

  const photoUrl =
    body?.photoUrl === undefined
      ? undefined
      : body.photoUrl === null
        ? null
        : String(body.photoUrl).trim() || null;

  if (firstName !== undefined && !firstName) {
    return NextResponse.json(
      { error: "Nome non valido" },
      { status: 400 }
    );
  }

  if (lastName !== undefined && !lastName) {
    return NextResponse.json(
      { error: "Cognome non valido" },
      { status: 400 }
    );
  }

  if (
    number !== undefined &&
    (!Number.isInteger(number) || number <= 0 || number > 99)
  ) {
    return NextResponse.json(
      { error: "Numero maglia non valido" },
      { status: 400 }
    );
  }

  const updated = await prisma.player.update({
    where: { id: playerId },
    data: {
      ...(firstName !== undefined ? { firstName } : {}),
      ...(lastName !== undefined ? { lastName } : {}),
      ...(number !== undefined ? { number } : {}),
      ...(position !== undefined ? { position } : {}),
      ...(photoUrl !== undefined ? { photoUrl } : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      number: true,
      position: true,
      photoUrl: true,
      teamId: true,
      team: {
        select: {
          id: true,
          name: true,
          badgeUrl: true,
          leagueId: true,
          league: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _: Request,
  ctx: { params: Promise<{ playerId: string }> }
) {
  const { playerId } = await ctx.params;

  const existing = await prisma.player.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      teamId: true,
    },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Giocatore non trovato" },
      { status: 404 }
    );
  }

  const authErr = await requireAdminOrCaptainOfTeam(existing.teamId);
  if (authErr) return authErr;

  await prisma.player.delete({
    where: { id: playerId },
  });

  return NextResponse.json({ ok: true });
}