import { NextResponse } from "next/server";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import {
  getServerSession,
  requireLeagueAdmin,
} from "@/modules/permissions/server-guards";
import { updateCreatorPreference } from "@/modules/media/application/creator-assignment-service";
import { writeAuditLog } from "@/modules/audit/application/audit-service";

type Ctx = { params: Promise<{ leagueId: string; creatorId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { leagueId, creatorId } = await ctx.params;
    const authError = await requireLeagueAdmin(leagueId);
    if (authError) return authError;
    const session = await getServerSession();
    const input = await readJsonBody<Record<string, unknown>>(req);
    const preferredTeamId = String(input.preferredTeamId ?? "").trim() || null;

    const creator = await updateCreatorPreference({
      leagueId,
      creatorId,
      preferredTeamId,
    });

    await writeAuditLog({
      leagueId,
      actor: session,
      action: "creator.preference_updated",
      entityType: "creator",
      entityId: creatorId,
      summary: `Aggiornata preferenza squadra di ${creator.displayName}`,
      metadata: { preferredTeamId },
    });

    return NextResponse.json(creator);
  } catch (error) {
    return apiErrorResponse(error, "Errore aggiornamento preferenza creator");
  }
}
