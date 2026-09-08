export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-auth";
import { apiErrorResponse } from "@/modules/core/api";
import { getPlayerStats } from "@/modules/players/application/player-service";

export async function GET(
  _: Request,
  ctx: { params: Promise<{ playerId: string }> }
) {
  try {
    const { playerId } = await ctx.params;
    const session = await getServerSession();
    const stats = await getPlayerStats({ playerId, session });
    return NextResponse.json(stats);
  } catch (error) {
    return apiErrorResponse(error, "Errore caricamento statistiche giocatore");
  }
}