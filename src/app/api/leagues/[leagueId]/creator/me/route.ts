import { NextResponse } from "next/server";
import { getServerSession } from "@/modules/permissions/server-guards";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import {
  getCreatorWorkspace,
  updateOwnCreatorProfile,
} from "@/modules/media/application/creator-service";

type Ctx = { params: Promise<{ leagueId: string }> };

export async function GET(_: Request, ctx: Ctx) {
  try {
    const { leagueId } = await ctx.params;
    const session = await getServerSession();
    return NextResponse.json(await getCreatorWorkspace({ leagueId, session }));
  } catch (error) {
    return apiErrorResponse(error, "Errore caricamento area creator");
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { leagueId } = await ctx.params;
    const session = await getServerSession();
    const input = await readJsonBody<Record<string, unknown>>(req);
    return NextResponse.json(
      await updateOwnCreatorProfile({ leagueId, session, input })
    );
  } catch (error) {
    return apiErrorResponse(error, "Errore aggiornamento profilo creator");
  }
}