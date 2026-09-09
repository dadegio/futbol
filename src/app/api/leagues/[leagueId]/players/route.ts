export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "@/modules/permissions/server-guards";
import { apiErrorResponse } from "@/modules/core/api";
import { listLeaguePlayers } from "@/modules/players/application/player-service";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ leagueId: string }> }
) {
  try {
    const { leagueId } = await ctx.params;
    const session = await getServerSession();
    const url = new URL(req.url);
    const players = await listLeaguePlayers({
      leagueId,
      query: url.searchParams.get("q"),
      statusFilter: url.searchParams.get("status"),
      session,
    });
    return NextResponse.json(players);
  } catch (error) {
    return apiErrorResponse(error, "Errore caricamento giocatori");
  }
}