import { NextResponse } from "next/server";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import { getServerSession, requireLeagueAdmin } from "@/modules/permissions/server-guards";
import {
  deleteSponsor,
  getSponsorLeagueId,
  updateSponsor,
} from "@/modules/sponsors/application/sponsor-service";
import { writeAuditLog } from "@/modules/audit/application/audit-service";

export async function PATCH(req: Request, ctx: { params: Promise<{ sponsorId: string }> }) {
  const { sponsorId } = await ctx.params;

  try {
    const leagueId = await getSponsorLeagueId(sponsorId);
    const authErr = await requireLeagueAdmin(leagueId);
    if (authErr) return authErr;

    const session = await getServerSession();
    const input = await readJsonBody<Record<string, unknown>>(req);
    const updated = await updateSponsor({ sponsorId, input });
    await writeAuditLog({
      leagueId,
      actor: session,
      action: "sponsor.updated",
      entityType: "sponsor",
      entityId: sponsorId,
      summary: `Aggiornato sponsor ${updated.name}`,
      metadata: { updatedFields: Object.keys(input), active: updated.active },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return apiErrorResponse(error, "Non è stato possibile aggiornare lo sponsor");
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ sponsorId: string }> }) {
  const { sponsorId } = await ctx.params;

  try {
    const leagueId = await getSponsorLeagueId(sponsorId);
    const authErr = await requireLeagueAdmin(leagueId);
    if (authErr) return authErr;

    const session = await getServerSession();
    const result = await deleteSponsor({ sponsorId });
    await writeAuditLog({
      leagueId,
      actor: session,
      action: "sponsor.deleted",
      entityType: "sponsor",
      entityId: sponsorId,
      summary: "Eliminato sponsor",
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "Non è stato possibile eliminare lo sponsor");
  }
}
