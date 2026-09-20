import { NextResponse } from "next/server";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import { getServerSession } from "@/modules/permissions/server-guards";
import {
  createLockedTeamChangeRequest,
  getTeamRosterLockState,
  listTeamChangeRequests,
} from "@/modules/teams/application/team-change-request-service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ teamId: string }> };

export async function GET(_: Request, ctx: Ctx) {
  try {
    const { teamId } = await ctx.params;
    const actor = await getServerSession();
    const [lock, requests] = await Promise.all([
      getTeamRosterLockState(teamId),
      listTeamChangeRequests({ teamId, actor }),
    ]);
    return NextResponse.json({ lock, requests });
  } catch (error) {
    return apiErrorResponse(error, "Errore caricamento richieste squadra");
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { teamId } = await ctx.params;
    const actor = await getServerSession();
    const body = await readJsonBody<Record<string, unknown>>(req);
    const type = String(body.type ?? "") as
      | "TEAM_UPDATE"
      | "PLAYER_ADD"
      | "PLAYER_UPDATE"
      | "PLAYER_REMOVE"
      | "PLAYER_NUMBER_SWAP";
    if (!["TEAM_UPDATE", "PLAYER_ADD", "PLAYER_UPDATE", "PLAYER_REMOVE", "PLAYER_NUMBER_SWAP"].includes(type)) {
      return NextResponse.json({ error: "Tipo richiesta non valido" }, { status: 400 });
    }
    const request = await createLockedTeamChangeRequest({
      teamId,
      actor,
      type,
      input: (body.payload && typeof body.payload === "object" ? body.payload : {}) as Record<string, unknown>,
      targetPlayerId: typeof body.targetPlayerId === "string" ? body.targetPlayerId : null,
      reason: typeof body.reason === "string" ? body.reason : null,
    });
    return NextResponse.json({ requestCreated: true, request }, { status: 202 });
  } catch (error) {
    return apiErrorResponse(error, "Errore creazione richiesta squadra");
  }
}
