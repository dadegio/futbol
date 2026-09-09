import { NextResponse } from "next/server";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import {
  deleteMediaItem,
  updateMediaItem,
} from "@/modules/media/application/media-service";
import { writeAuditLog } from "@/modules/audit/application/audit-service";
import { getServerSession } from "@/modules/permissions/server-guards";

export async function PATCH(req: Request, ctx: { params: Promise<{ mediaId: string }> }) {
  const { mediaId } = await ctx.params;

  try {
    const session = await getServerSession();
    const input = await readJsonBody<Record<string, unknown>>(req);
    const updated = await updateMediaItem({ mediaId, input });
    await writeAuditLog({
      leagueId: updated.leagueId,
      actor: session,
      action: "media.updated",
      entityType: "media",
      entityId: mediaId,
      summary: `Aggiornato contenuto ${updated.title || updated.type}`,
      metadata: { updatedFields: Object.keys(input), status: updated.status, featured: updated.featured },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return apiErrorResponse(error, "Non è stato possibile aggiornare il contenuto media");
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ mediaId: string }> }) {
  const { mediaId } = await ctx.params;

  try {
    const session = await getServerSession();
    const result = await deleteMediaItem({ mediaId });
    await writeAuditLog({
      leagueId: result.leagueId,
      actor: session,
      action: "media.deleted",
      entityType: "media",
      entityId: mediaId,
      summary: "Eliminato contenuto media",
      metadata: { status: result.status },
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "Non è stato possibile eliminare il contenuto media");
  }
}
