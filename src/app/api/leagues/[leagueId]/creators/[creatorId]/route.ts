import { NextResponse } from "next/server";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import {
  getServerSession,
  requireLeagueAdmin,
} from "@/modules/permissions/server-guards";
import { updateCreatorAssignmentSettings } from "@/modules/media/application/creator-assignment-service";
import { writeAuditLog } from "@/modules/audit/application/audit-service";
import type { CreatorCoverageRole } from "@/modules/media/domain/creator-assignment";

type Ctx = { params: Promise<{ leagueId: string; creatorId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { leagueId, creatorId } = await ctx.params;
    const authError = await requireLeagueAdmin(leagueId);
    if (authError) return authError;
    const session = await getServerSession();
    const input = await readJsonBody<Record<string, unknown>>(req);

    const hasPreferredTeam = Object.prototype.hasOwnProperty.call(
      input,
      "preferredTeamId"
    );
    const hasCoverageRole = Object.prototype.hasOwnProperty.call(
      input,
      "coverageRole"
    );
    const hasWeeklyLimit = Object.prototype.hasOwnProperty.call(
      input,
      "weeklyAssignmentLimit"
    );

    const creator = await updateCreatorAssignmentSettings({
      leagueId,
      creatorId,
      ...(hasPreferredTeam
        ? { preferredTeamId: String(input.preferredTeamId ?? "").trim() || null }
        : {}),
      ...(hasCoverageRole
        ? { coverageRole: String(input.coverageRole ?? "") as CreatorCoverageRole }
        : {}),
      ...(hasWeeklyLimit
        ? { weeklyAssignmentLimit: Number(input.weeklyAssignmentLimit) }
        : {}),
    });

    await writeAuditLog({
      leagueId,
      actor: session,
      action: "creator.coverage_settings_updated",
      entityType: "creator",
      entityId: creatorId,
      summary: `Aggiornate impostazioni copertura di ${creator.displayName}`,
      metadata: {
        preferredTeamId: creator.preferredTeamId,
        coverageRole: creator.coverageRole,
        weeklyAssignmentLimit: creator.weeklyAssignmentLimit,
      },
    });

    return NextResponse.json(creator);
  } catch (error) {
    return apiErrorResponse(error, "Errore aggiornamento impostazioni creator");
  }
}
