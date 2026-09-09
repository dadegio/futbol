export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession, requireLeagueAdmin } from "@/modules/permissions/server-guards";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import {
  createPlayoffs,
  deletePlayoffs,
  getPlayoffs,
} from "@/modules/playoffs/application/playoff-service";
import { writeAuditLog } from "@/modules/audit/application/audit-service";

type Ctx = { params: Promise<{ leagueId: string }> };

export async function GET(_: Request, ctx: Ctx) {
  const { leagueId } = await ctx.params;

  try {
    return NextResponse.json(await getPlayoffs(leagueId));
  } catch (error) {
    return apiErrorResponse(error, "Errore caricamento playoff");
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const { leagueId } = await ctx.params;
  const authErr = await requireLeagueAdmin(leagueId);
  if (authErr) return authErr;

  try {
    const session = await getServerSession();
    const body = await readJsonBody<Record<string, unknown>>(req);
    const result = await createPlayoffs(leagueId, body);
    await writeAuditLog({
      leagueId,
      actor: session,
      action: "playoffs.created",
      entityType: "playoffs",
      entityId: leagueId,
      summary: `Creati playoff ${result.format} top ${result.teamCount}`,
      metadata: { format: result.format, teamCount: result.teamCount },
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "Errore creazione playoff");
  }
}

export async function DELETE(_: Request, ctx: Ctx) {
  const { leagueId } = await ctx.params;
  const authErr = await requireLeagueAdmin(leagueId);
  if (authErr) return authErr;

  try {
    const session = await getServerSession();
    const result = await deletePlayoffs(leagueId);
    await writeAuditLog({
      leagueId,
      actor: session,
      action: "playoffs.deleted",
      entityType: "playoffs",
      entityId: leagueId,
      summary: "Eliminati playoff",
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "Errore eliminazione playoff");
  }
}
