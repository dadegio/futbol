export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import { getServerSession, requireLeagueAdminForMatch } from "@/modules/permissions/server-guards";
import { updateMatchDate } from "@/modules/matches/application/match-scheduling";
import { writeAuditLog } from "@/modules/audit/application/audit-service";

type Ctx = { params: Promise<{ matchId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { matchId } = await ctx.params;
  const authErr = await requireLeagueAdminForMatch(matchId);
  if (authErr) return authErr;

  const body = await readJsonBody<Record<string, unknown>>(req);
  const rawDate = body?.date;
  let date: Date | null;

  if (rawDate === null || rawDate === "") {
    date = null;
  } else if (typeof rawDate === "string") {
    date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: "Data non valida" }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: "Parametro 'date' mancante o non valido" }, { status: 400 });
  }

  try {
    const session = await getServerSession();
    const result = await updateMatchDate({ matchId, date });
    await writeAuditLog({
      leagueId: result.leagueId,
      actor: session,
      action: "match.date_updated",
      entityType: "match",
      entityId: matchId,
      summary: date ? "Aggiornata data partita" : "Rimossa data partita",
      metadata: { date: date ? date.toISOString() : null },
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return apiErrorResponse(error, "Non è stato possibile aggiornare la data della partita");
  }
}
