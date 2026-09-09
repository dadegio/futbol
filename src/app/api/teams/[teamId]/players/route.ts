import { NextResponse } from "next/server";
import { requireAdminOrCaptainOfTeam } from "@/modules/permissions/server-guards";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import { addPlayerToTeam } from "@/modules/players/application/player-service";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await ctx.params;
  const authErr = await requireAdminOrCaptainOfTeam(teamId);
  if (authErr) return authErr;

  try {
    const input = await readJsonBody<Record<string, unknown>>(req);
    const player = await addPlayerToTeam({ teamId, input });
    return NextResponse.json(player);
  } catch (error) {
    return apiErrorResponse(error, "Errore creazione giocatore");
  }
}