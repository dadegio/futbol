export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  getServerSession,
  requireAdminOrCaptainOfPlayer,
} from "@/modules/permissions/server-guards";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import { writeAuditLog } from "@/modules/audit/application/audit-service";
import { createLockedTeamChangeRequest, getTeamRosterLockState } from "@/modules/teams/application/team-change-request-service";
import {
  deletePlayer,
  getPlayerDetail,
  updatePlayer,
} from "@/modules/players/application/player-service";

type Ctx = { params: Promise<{ playerId: string }> };

export async function GET(_: Request, ctx: Ctx) {
  try {
    const { playerId } = await ctx.params;
    const session = await getServerSession();
    const player = await getPlayerDetail({ playerId, session });
    return NextResponse.json(player);
  } catch (error) {
    return apiErrorResponse(error, "Errore caricamento giocatore");
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { playerId } = await ctx.params;
  const authErr = await requireAdminOrCaptainOfPlayer(playerId);
  if (authErr) return authErr;

  try {
    const session = await getServerSession();
    const input = await readJsonBody<Record<string, unknown>>(req);
    if (session?.role === "CAPTAIN") {
      const current = await getPlayerDetail({ playerId, session });
      const teamId = current.teamId ?? current.team?.id;
      if (!teamId) return NextResponse.json({ error: "Squadra giocatore mancante" }, { status: 400 });
      const lock = await getTeamRosterLockState(teamId);
      if (lock.locked) {
        const request = await createLockedTeamChangeRequest({ teamId, actor: session, type: "PLAYER_UPDATE", input, targetPlayerId: playerId });
        return NextResponse.json({ requestCreated: true, request, rosterLocked: true }, { status: 202 });
      }
    }
    const player = await updatePlayer({ playerId, input, session });
    await writeAuditLog({
      leagueId: player.team.leagueId, actor: session, action: "player.updated", entityType: "player", entityId: player.id,
      summary: `Giocatore ${player.firstName} ${player.lastName} aggiornato`,
    });
    return NextResponse.json(player);
  } catch (error) {
    return apiErrorResponse(error, "Errore aggiornamento giocatore");
  }
}

export async function DELETE(_: Request, ctx: Ctx) {
  const { playerId } = await ctx.params;
  const authErr = await requireAdminOrCaptainOfPlayer(playerId);
  if (authErr) return authErr;

  try {
    const session = await getServerSession();
    const player = await getPlayerDetail({ playerId, session });
    const teamId = player.teamId ?? player.team?.id;
    if (session?.role === "CAPTAIN" && teamId) {
      const lock = await getTeamRosterLockState(teamId);
      if (lock.locked) {
        const request = await createLockedTeamChangeRequest({ teamId, actor: session, type: "PLAYER_REMOVE", input: {}, targetPlayerId: playerId });
        return NextResponse.json({ requestCreated: true, request, rosterLocked: true }, { status: 202 });
      }
    }
    const result = await deletePlayer(playerId);
    await writeAuditLog({
      leagueId: player.team.leagueId, actor: session, action: "player.deleted", entityType: "player", entityId: playerId,
      summary: `Giocatore ${player.firstName} ${player.lastName} eliminato`,
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "Errore eliminazione giocatore");
  }
}