export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession, requireAdminOrCaptainOfPlayoffSeries } from "@/modules/permissions/server-guards";
import { apiErrorResponse, readJsonBody, AppError } from "@/modules/core/api";
import { advancePlayoffSeries } from "@/modules/playoffs/application/playoff-service";
import { writeAuditLog } from "@/modules/audit/application/audit-service";

type Ctx = { params: Promise<{ leagueId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { leagueId } = await ctx.params;
  const body = await readJsonBody<any>(req);
  const seriesId = String(body?.seriesId ?? "").trim();

  if (!seriesId) {
    return NextResponse.json({ error: "seriesId mancante" }, { status: 400 });
  }

  const authErr = await requireAdminOrCaptainOfPlayoffSeries(seriesId);
  if (authErr) return authErr;

  try {
    const session = await getServerSession();
    const result = await advancePlayoffSeries(leagueId, body);
    await writeAuditLog({
      leagueId,
      actor: session,
      action: "playoffs.advanced",
      entityType: "playoffSeries",
      entityId: seriesId,
      summary: "Avanzata serie playoff",
      metadata: { winnerId: body?.winnerId ?? null },
    });
    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof AppError) return apiErrorResponse(error, "Errore avanzamento playoff");
    return NextResponse.json(
      { error: error?.message ?? "Errore avanzamento playoff" },
      { status: 500 }
    );
  }
}
