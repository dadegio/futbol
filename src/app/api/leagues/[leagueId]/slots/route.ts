import { NextResponse } from "next/server";
import { getServerSession, isLeagueAdminSession } from "@/lib/server-auth";
import { getLeagueMatchSlots } from "@/modules/bookings/application/slot-service";
import { apiErrorResponse } from "@/modules/core/api";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ leagueId: string }> }
) {
  try {
    const { leagueId } = await ctx.params;
    const session = await getServerSession();
    const matchId = new URL(req.url).searchParams.get("matchId")?.trim() || null;
    return NextResponse.json(
      await getLeagueMatchSlots({
        leagueId,
        matchId,
        adminBypass: isLeagueAdminSession(session, leagueId),
      })
    );
  } catch (error) {
    return apiErrorResponse(error, "Errore caricamento slot");
  }
}