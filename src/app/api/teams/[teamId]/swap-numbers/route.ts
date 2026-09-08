export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAdminOrCaptainOfTeam } from "@/lib/server-auth";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import { swapTeamPlayerNumbers } from "@/modules/players/application/player-service";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await ctx.params;
  const authErr = await requireAdminOrCaptainOfTeam(teamId);
  if (authErr) return authErr;

  try {
    const input = await readJsonBody<Record<string, unknown>>(req);
    const result = await swapTeamPlayerNumbers({
      teamId,
      aPlayerId: String(input.aPlayerId ?? "").trim(),
      bPlayerId: String(input.bPlayerId ?? "").trim(),
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "Errore scambio numeri");
  }
}