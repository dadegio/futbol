export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/modules/core/api";
import { requireLeagueAdminForMatch } from "@/modules/permissions/server-guards";
import { getMatchTimeline } from "@/modules/audit/application/audit-service";

export async function GET(_: Request, ctx: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await ctx.params;
  const authErr = await requireLeagueAdminForMatch(matchId); if (authErr) return authErr;
  try {
    const timeline = await getMatchTimeline(matchId);
    if (!timeline) return NextResponse.json({ error: "Partita non trovata" }, { status: 404 });
    return NextResponse.json(timeline);
  } catch (error) { return apiErrorResponse(error, "Errore caricamento timeline"); }
}
