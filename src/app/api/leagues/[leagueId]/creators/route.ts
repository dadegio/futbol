import { NextResponse } from "next/server";
import { getServerSession, isLeagueAdminSession } from "@/modules/permissions/server-guards";
import { apiErrorResponse } from "@/modules/core/api";
import { listCreators } from "@/modules/media/application/creator-service";

export async function GET(
  _: Request,
  ctx: { params: Promise<{ leagueId: string }> }
) {
  try {
    const { leagueId } = await ctx.params;
    const session = await getServerSession();
    const canAdmin = isLeagueAdminSession(session, leagueId);
    return NextResponse.json(await listCreators({ leagueId, canAdmin }));
  } catch (error) {
    return apiErrorResponse(error, "Errore caricamento creator");
  }
}