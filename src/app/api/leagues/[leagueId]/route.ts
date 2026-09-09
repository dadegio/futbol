import { NextResponse } from "next/server";
import { getServerSession, requireAdmin, requireLeagueAdmin } from "@/modules/permissions/server-guards";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import {
  deleteLeague,
  getLeagueSettings,
  updateLeagueSettings,
} from "@/modules/leagues/application/league-service";
import { writeAuditLog } from "@/modules/audit/application/audit-service";

type Ctx = { params: Promise<{ leagueId: string }> };

export async function GET(_: Request, ctx: Ctx) {
  const { leagueId } = await ctx.params;

  try {
    return NextResponse.json(await getLeagueSettings(leagueId));
  } catch (error) {
    return apiErrorResponse(error, "Errore caricamento torneo");
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { leagueId } = await ctx.params;
  const authErr = await requireLeagueAdmin(leagueId);
  if (authErr) return authErr;

  try {
    const session = await getServerSession();
    const body = await readJsonBody<Record<string, unknown>>(req);
    const league = await updateLeagueSettings(leagueId, body);
    await writeAuditLog({
      leagueId,
      actor: session,
      action: "league.updated",
      entityType: "league",
      entityId: leagueId,
      summary: `Aggiornate impostazioni torneo ${league.name}`,
      metadata: { updatedFields: Object.keys(body) },
    });
    return NextResponse.json(league);
  } catch (error) {
    return apiErrorResponse(error, "Errore aggiornamento torneo");
  }
}

export async function DELETE(_: Request, ctx: Ctx) {
  const { leagueId } = await ctx.params;
  const authErr = await requireAdmin();
  if (authErr) return authErr;

  try {
    const session = await getServerSession();
    const result = await deleteLeague(leagueId);
    await writeAuditLog({
      leagueId: null,
      actor: session,
      action: "league.deleted",
      entityType: "league",
      entityId: leagueId,
      summary: "Eliminato torneo",
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "Errore eliminazione torneo");
  }
}
