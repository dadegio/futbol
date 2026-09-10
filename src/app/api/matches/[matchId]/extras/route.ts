export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import { getServerSession, requireLeagueAdminForMatch } from "@/modules/permissions/server-guards";
import { updateMatchExtras } from "@/modules/matches/application/match-lifecycle-service";
import { writeAuditLog } from "@/modules/audit/application/audit-service";

export async function PATCH(req: Request, ctx: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await ctx.params;
  const authErr = await requireLeagueAdminForMatch(matchId);
  if (authErr) return authErr;
  try {
    const body = await readJsonBody<{ mvpPlayerId?: unknown; replayUrl?: unknown; highlightsUrl?: unknown }>(req);
    const session = await getServerSession();
    const result = await updateMatchExtras(matchId, body);
    await writeAuditLog({ leagueId: result.leagueId, actor: session, action: "match.extras_updated", entityType: "match", entityId: matchId, summary: "Aggiornati MVP/contenuti partita" });
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "Aggiornamento contenuti partita non riuscito");
  }
}
