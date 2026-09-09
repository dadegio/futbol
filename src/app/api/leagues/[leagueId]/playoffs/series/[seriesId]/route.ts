export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  getServerSession,
  requireAdminOrCaptainOfPlayoffSeries,
  requireLeagueAdmin,
} from "@/modules/permissions/server-guards";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import {
  assignPlayoffSeriesTeams,
  savePlayoffSeriesPenalties,
} from "@/modules/playoffs/application/playoff-service";
import { writeAuditLog } from "@/modules/audit/application/audit-service";

type Ctx = { params: Promise<{ leagueId: string; seriesId: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  const { leagueId, seriesId } = await ctx.params;
  const authErr = await requireLeagueAdmin(leagueId);
  if (authErr) return authErr;

  try {
    const session = await getServerSession();
    const body = await readJsonBody<Record<string, unknown>>(req);
    const result = await assignPlayoffSeriesTeams(leagueId, seriesId, body);
    await writeAuditLog({
      leagueId,
      actor: session,
      action: "playoffs.series_updated",
      entityType: "playoffSeries",
      entityId: seriesId,
      summary: "Aggiornate squadre serie playoff",
      metadata: { homeTeamId: body?.homeTeamId ?? null, awayTeamId: body?.awayTeamId ?? null },
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "Errore aggiornamento serie playoff");
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { leagueId, seriesId } = await ctx.params;

  const authError = await requireAdminOrCaptainOfPlayoffSeries(seriesId);
  if (authError) return authError;

  try {
    const session = await getServerSession();
    const body = await readJsonBody<Record<string, unknown>>(req);
    const result = await savePlayoffSeriesPenalties(leagueId, seriesId, body);
    await writeAuditLog({
      leagueId,
      actor: session,
      action: "playoffs.penalties_saved",
      entityType: "playoffSeries",
      entityId: seriesId,
      summary: "Salvati rigori serie playoff",
      metadata: { penaltiesHome: body?.penaltiesHome ?? null, penaltiesAway: body?.penaltiesAway ?? null },
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "Errore salvataggio rigori");
  }
}
