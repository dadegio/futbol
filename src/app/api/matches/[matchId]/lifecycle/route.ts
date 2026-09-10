export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import { getServerSession, requireLeagueAdminForMatch, requireMatchEditor } from "@/modules/permissions/server-guards";
import { writeAuditLog } from "@/modules/audit/application/audit-service";
import {
  finalizeMatchResult,
  reopenMatchResult,
  setMatchSheetConfirmation,
  updateMatchLifecycle,
} from "@/modules/matches/application/match-lifecycle-service";

type Body =
  | { action: "finalize" }
  | { action: "reopen" }
  | { action: "postpone" | "cancel" | "restore" }
  | { action: "confirm-sheet"; team: "home" | "away"; confirmed?: boolean };

export async function PATCH(req: Request, ctx: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await ctx.params;
  try {
    const body = await readJsonBody<Body>(req);
    const action = body?.action;
    const needsAdmin = action === "reopen" || action === "postpone" || action === "cancel" || action === "restore";
    const authErr = needsAdmin ? await requireLeagueAdminForMatch(matchId) : await requireMatchEditor(matchId);
    if (authErr) return authErr;
    const session = await getServerSession();

    let result;
    if (action === "finalize") result = await finalizeMatchResult(matchId);
    else if (action === "reopen") result = await reopenMatchResult(matchId);
    else if (action === "postpone" || action === "cancel" || action === "restore") result = await updateMatchLifecycle(matchId, action);
    else if (action === "confirm-sheet") result = await setMatchSheetConfirmation(matchId, body.team, body.confirmed !== false);
    else return NextResponse.json({ error: "Azione non valida" }, { status: 400 });

    await writeAuditLog({
      leagueId: result.leagueId,
      actor: session,
      action: `match.${action}`,
      entityType: "match",
      entityId: matchId,
      summary: `Partita: ${action}`,
      metadata: body as any,
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "Operazione partita non riuscita");
  }
}
