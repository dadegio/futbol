import { NextResponse } from "next/server";
import { getServerSession, requireLeagueAdmin } from "@/modules/permissions/server-guards";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import { writeAuditLog } from "@/modules/audit/application/audit-service";
import {
  createReferee,
  deleteReferee,
  listLeagueReferees,
  updateReferee,
} from "@/modules/referees/application/referee-service";

type Ctx = { params: Promise<{ leagueId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { leagueId } = await ctx.params;
  const denied = await requireLeagueAdmin(leagueId);
  if (denied) return denied;

  try {
    const matchId = new URL(req.url).searchParams.get("matchId")?.trim() || null;
    return NextResponse.json(await listLeagueReferees({ leagueId, matchId }));
  } catch (error) {
    return apiErrorResponse(error, "Errore caricamento arbitri");
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const { leagueId } = await ctx.params;
  const denied = await requireLeagueAdmin(leagueId);
  if (denied) return denied;

  try {
    const input = await readJsonBody<Record<string, unknown>>(req);
    const actor = await getServerSession();
    const referee = await createReferee({ leagueId, input });
    await writeAuditLog({
      leagueId, actor, action: "referee.created", entityType: "referee", entityId: referee.id,
      summary: `Arbitro ${referee.name} creato`, metadata: { teamId: referee.teamId },
    });
    return NextResponse.json(referee, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Errore creazione arbitro");
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { leagueId } = await ctx.params;
  const denied = await requireLeagueAdmin(leagueId);
  if (denied) return denied;

  try {
    const input = await readJsonBody<Record<string, unknown>>(req);
    const actor = await getServerSession();
    const referee = await updateReferee({ leagueId, input });
    await writeAuditLog({
      leagueId, actor, action: "referee.updated", entityType: "referee", entityId: referee.id,
      summary: `Arbitro ${referee.name} aggiornato`,
      metadata: { active: referee.active, releasedAssignments: referee.releasedAssignments },
    });
    return NextResponse.json(referee);
  } catch (error) {
    return apiErrorResponse(error, "Errore aggiornamento arbitro");
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { leagueId } = await ctx.params;
  const denied = await requireLeagueAdmin(leagueId);
  if (denied) return denied;

  try {
    const input = await readJsonBody<Record<string, unknown>>(req);
    const actor = await getServerSession();
    const refereeId = String(input.id ?? "").trim();
    const result = await deleteReferee({ leagueId, refereeId });
    await writeAuditLog({
      leagueId, actor, action: "referee.deleted", entityType: "referee", entityId: refereeId,
      summary: "Arbitro eliminato", metadata: { releasedAssignments: result.releasedAssignments },
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "Errore eliminazione arbitro");
  }
}