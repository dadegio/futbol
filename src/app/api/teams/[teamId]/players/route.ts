import { NextResponse } from "next/server";
import { getServerSession, requireAdminOrCaptainOfTeam } from "@/modules/permissions/server-guards";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import { addPlayerToTeam } from "@/modules/players/application/player-service";
import { createLockedTeamChangeRequest, getTeamRosterLockState } from "@/modules/teams/application/team-change-request-service";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await ctx.params;
  const authErr = await requireAdminOrCaptainOfTeam(teamId);
  if (authErr) return authErr;

  try {
    const input = await readJsonBody<Record<string, unknown>>(req);
    const session = await getServerSession();
    if (session?.role === "CAPTAIN") {
      const lock = await getTeamRosterLockState(teamId);
      if (lock.locked) {
        const request = await createLockedTeamChangeRequest({ teamId, actor: session, type: "PLAYER_ADD", input });
        return NextResponse.json({ requestCreated: true, request, rosterLocked: true }, { status: 202 });
      }
    }
    const player = await addPlayerToTeam({ teamId, input, session });
    return NextResponse.json(player);
  } catch (error) {
    return apiErrorResponse(error, "Errore creazione giocatore");
  }
}