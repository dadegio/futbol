import { NextResponse } from "next/server";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import {
  getServerSession,
  requireLeagueAdmin,
} from "@/modules/permissions/server-guards";
import {
  getCreatorAssignmentBoard,
  replaceRoundCreatorAssignments,
  updateLeagueVeoTeam,
} from "@/modules/media/application/creator-assignment-service";
import { writeAuditLog } from "@/modules/audit/application/audit-service";

export async function GET(
  _: Request,
  ctx: { params: Promise<{ leagueId: string }> }
) {
  try {
    const { leagueId } = await ctx.params;
    const authError = await requireLeagueAdmin(leagueId);
    if (authError) return authError;
    return NextResponse.json(await getCreatorAssignmentBoard(leagueId));
  } catch (error) {
    return apiErrorResponse(error, "Errore caricamento assegnazioni creator");
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ leagueId: string }> }
) {
  try {
    const { leagueId } = await ctx.params;
    const authError = await requireLeagueAdmin(leagueId);
    if (authError) return authError;
    const session = await getServerSession();
    const input = await readJsonBody<Record<string, unknown>>(req);
    const veoTeamId = String(input.veoTeamId ?? "").trim() || null;
    const result = await updateLeagueVeoTeam({ leagueId, veoTeamId });

    await writeAuditLog({
      leagueId,
      actor: session,
      action: "creator.veo_team_updated",
      entityType: "league",
      entityId: leagueId,
      summary: veoTeamId
        ? "Aggiornata la squadra coperta con VEO"
        : "Rimossa la squadra coperta con VEO",
      metadata: { veoTeamId },
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "Errore aggiornamento squadra VEO");
  }
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ leagueId: string }> }
) {
  try {
    const { leagueId } = await ctx.params;
    const authError = await requireLeagueAdmin(leagueId);
    if (authError) return authError;
    const session = await getServerSession();
    const input = await readJsonBody<Record<string, unknown>>(req);
    const round = Number(input.round);
    const rawAssignments = Array.isArray(input.assignments) ? input.assignments : [];
    const assignments = rawAssignments.map((entry) => {
      const row =
        entry && typeof entry === "object"
          ? (entry as Record<string, unknown>)
          : {};
      return {
        matchId: String(row.matchId ?? "").trim(),
        photoCreatorId: String(row.photoCreatorId ?? "").trim() || null,
        videoCreatorId: String(row.videoCreatorId ?? "").trim() || null,
      };
    });

    const result = await replaceRoundCreatorAssignments({
      leagueId,
      round,
      assignments,
    });

    await writeAuditLog({
      leagueId,
      actor: session,
      action: "creator.assignments_updated",
      entityType: "creator_assignment",
      entityId: `round:${round}`,
      summary: `Aggiornate assegnazioni foto/video della giornata ${round}`,
      metadata: result,
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "Errore salvataggio assegnazioni creator");
  }
}
