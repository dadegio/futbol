import { NextResponse } from "next/server";
import { getServerSession } from "@/modules/auth/server-session";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import { saveCoachLineup } from "@/modules/coaches/application/coach-lineup-service";

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ leagueId: string; matchId: string }> }
) {
  try {
    const { leagueId, matchId } = await ctx.params;
    const session = await getServerSession();
    const input = await readJsonBody<Record<string, unknown>>(req);
    return NextResponse.json(
      await saveCoachLineup({
        session,
        leagueId,
        matchId,
        input,
      })
    );
  } catch (error) {
    return apiErrorResponse(error, "Errore salvataggio formazione");
  }
}
