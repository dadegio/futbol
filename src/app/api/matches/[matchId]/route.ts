import { NextResponse } from "next/server";
import { getServerSession } from "@/modules/permissions/server-guards";
import { apiErrorResponse } from "@/modules/core/api";
import { getMatchDetail } from "@/modules/matches/application/match-detail-service";

export async function GET(
  _: Request,
  ctx: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await ctx.params;
    const session = await getServerSession();
    return NextResponse.json(await getMatchDetail({ matchId, session }));
  } catch (error) {
    return apiErrorResponse(error, "Errore caricamento partita");
  }
}