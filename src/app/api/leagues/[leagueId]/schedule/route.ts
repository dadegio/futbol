import { NextResponse } from "next/server";
import { getServerSession, isLeagueAdminSession, requireLeagueAdmin } from "@/modules/permissions/server-guards";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import { NO_STORE_HEADERS, publicApiCacheHeaders } from "@/modules/core/http-cache";
import {
  createLeagueSchedule,
  getLeagueSchedule,
} from "@/modules/matches/application/league-schedule-service";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ leagueId: string }> }
) {
  try {
    const { leagueId } = await ctx.params;
    const session = await getServerSession();
    const canSeeRefereeName = isLeagueAdminSession(session, leagueId);
    const canSeeCreatorCrew = canSeeRefereeName || Boolean(
      session?.role === "CAPTAIN" && session.leagueId === leagueId
    );
    const { searchParams } = new URL(req.url);
    const payload = await getLeagueSchedule({
      leagueId,
      phase: searchParams.get("phase"),
      canSeeRefereeName,
      canSeeCreatorCrew,
    });

    return NextResponse.json(payload, {
      headers: canSeeCreatorCrew ? NO_STORE_HEADERS : publicApiCacheHeaders(20, 60),
    });
  } catch (error) {
    return apiErrorResponse(error, "Errore caricamento calendario");
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await ctx.params;
  const authErr = await requireLeagueAdmin(leagueId);
  if (authErr) return authErr;

  try {
    const body = await readJsonBody<Record<string, unknown>>(req);
    const payload = await createLeagueSchedule({ leagueId, input: body });
    return NextResponse.json(payload, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return apiErrorResponse(error, "Errore generazione calendario");
  }
}
