import { NextResponse } from "next/server";
import { requireLeagueAdmin } from "@/modules/permissions/server-guards";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import {
  createLeagueTeam,
  listLeagueTeams,
} from "@/modules/teams/application/team-service";

type Ctx = { params: Promise<{ leagueId: string }> };

export async function GET(_: Request, ctx: Ctx) {
  try {
    const { leagueId } = await ctx.params;
    return NextResponse.json(await listLeagueTeams(leagueId));
  } catch (error) {
    return apiErrorResponse(error, "Errore caricamento squadre");
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const { leagueId } = await ctx.params;
  const authErr = await requireLeagueAdmin(leagueId);
  if (authErr) return authErr;

  try {
    const input = await readJsonBody<Record<string, unknown>>(req);
    return NextResponse.json(await createLeagueTeam({ leagueId, input }));
  } catch (error) {
    return apiErrorResponse(error, "Errore creazione squadra");
  }
}