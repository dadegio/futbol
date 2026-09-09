import { NextResponse } from "next/server";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import {
  createMediaItem,
  listLeagueMedia,
} from "@/modules/media/application/media-service";
import { writeAuditLog } from "@/modules/audit/application/audit-service";
import { getServerSession } from "@/modules/permissions/server-guards";

export async function GET(req: Request, ctx: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await ctx.params;

  try {
    const { searchParams } = new URL(req.url);
    const media = await listLeagueMedia({ leagueId, searchParams });
    return NextResponse.json(media);
  } catch (error) {
    return apiErrorResponse(error, "Non è stato possibile caricare i contenuti media");
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await ctx.params;

  try {
    const session = await getServerSession();
    const input = await readJsonBody<Record<string, unknown>>(req);
    const media = await createMediaItem({ leagueId, input });
    await writeAuditLog({
      leagueId,
      actor: session,
      action: "media.created",
      entityType: "media",
      entityId: media.id,
      summary: `Creato contenuto ${media.title || media.type}`,
      metadata: { type: media.type, status: media.status, matchId: media.matchId, teamId: media.teamId, playerId: media.playerId },
    });
    return NextResponse.json(media, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Non è stato possibile creare il contenuto media");
  }
}
