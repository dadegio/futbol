export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  getServerSession,
  requireAdminOrCaptainOfPlayer,
} from "@/lib/server-auth";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import {
  deletePlayer,
  getPlayerDetail,
  updatePlayer,
} from "@/modules/players/application/player-service";

type Ctx = { params: Promise<{ playerId: string }> };

export async function GET(_: Request, ctx: Ctx) {
  try {
    const { playerId } = await ctx.params;
    const session = await getServerSession();
    const player = await getPlayerDetail({ playerId, session });
    return NextResponse.json(player);
  } catch (error) {
    return apiErrorResponse(error, "Errore caricamento giocatore");
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { playerId } = await ctx.params;
  const authErr = await requireAdminOrCaptainOfPlayer(playerId);
  if (authErr) return authErr;

  try {
    const session = await getServerSession();
    const input = await readJsonBody<Record<string, unknown>>(req);
    const player = await updatePlayer({ playerId, input, session });
    return NextResponse.json(player);
  } catch (error) {
    return apiErrorResponse(error, "Errore aggiornamento giocatore");
  }
}

export async function DELETE(_: Request, ctx: Ctx) {
  const { playerId } = await ctx.params;
  const authErr = await requireAdminOrCaptainOfPlayer(playerId);
  if (authErr) return authErr;

  try {
    return NextResponse.json(await deletePlayer(playerId));
  } catch (error) {
    return apiErrorResponse(error, "Errore eliminazione giocatore");
  }
}