import { NextResponse } from "next/server";
import { getServerSession, isLeagueAdminSession } from "@/modules/permissions/server-guards";
import { apiErrorResponse } from "@/modules/core/api";
import { NO_STORE_HEADERS, publicApiCacheHeaders } from "@/modules/core/http-cache";
import { getLeagueOverview } from "@/modules/leagues/application/league-overview-service";

export async function GET(_: Request, ctx: { params: Promise<{ leagueId: string }> }) {
  try {
    const { leagueId } = await ctx.params;
    const session = await getServerSession();
    const canSeeRefereeName = isLeagueAdminSession(session, leagueId);
    const overview = await getLeagueOverview({ leagueId, canSeeRefereeName });

    return NextResponse.json(overview, {
      headers: canSeeRefereeName ? NO_STORE_HEADERS : publicApiCacheHeaders(30, 90),
    });
  } catch (error) {
    return apiErrorResponse(error, "Errore caricamento overview");
  }
}
