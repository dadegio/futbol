export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  getServerSession,
  requireAdminOrCaptainOfTeam,
  requireLeagueAdminForTeam,
} from "@/modules/permissions/server-guards";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import {
  getTeamDetail,
  removeTeamFromLeague,
  updateTeam,
} from "@/modules/teams/application/team-service";

type Ctx = { params: Promise<{ teamId: string }> };

export async function GET(_: Request, ctx: Ctx) {
  try {
    const { teamId } = await ctx.params;
    const session = await getServerSession();
    return NextResponse.json(await getTeamDetail({ teamId, session }));
  } catch (error) {
    return apiErrorResponse(error, "Errore caricamento squadra");
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { teamId } = await ctx.params;
  const authErr = await requireAdminOrCaptainOfTeam(teamId);
  if (authErr) return authErr;

  try {
    const input = await readJsonBody<Record<string, unknown>>(req);
    return NextResponse.json(await updateTeam({ teamId, input }));
  } catch (error) {
    return apiErrorResponse(error, "Errore aggiornamento squadra");
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { teamId } = await ctx.params;
  const authErr = await requireLeagueAdminForTeam(teamId);
  if (authErr) return authErr;

  try {
    const requestedLeagueId = new URL(req.url).searchParams.get("leagueId");
    return NextResponse.json(
      await removeTeamFromLeague({ teamId, requestedLeagueId })
    );
  } catch (error) {
    return apiErrorResponse(error, "Errore rimozione squadra");
  }
}