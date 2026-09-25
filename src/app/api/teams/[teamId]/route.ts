export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  getServerSession,
  requireAdminOrCaptainOfTeam,
  requireLeagueAdminForTeam,
} from "@/modules/permissions/server-guards";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import { writeAuditLog } from "@/modules/audit/application/audit-service";
import { createLockedTeamChangeRequest, getTeamRosterLockState } from "@/modules/teams/application/team-change-request-service";
import {
  getTeamDetail,
  removeTeamFromLeague,
  updateTeam,
} from "@/modules/teams/application/team-service";

type Ctx = { params: Promise<{ teamId: string }> };

const KIT_ONLY_TEAM_FIELDS = new Set([
  "kitHomeUrl",
  "kitAwayUrl",
  "kitGoalkeeperUrl",
]);

function isKitOnlyTeamUpdate(input: Record<string, unknown>) {
  const keys = Object.keys(input);
  return keys.length > 0 && keys.every((key) => KIT_ONLY_TEAM_FIELDS.has(key));
}

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
    const actor = await getServerSession();
    if (actor?.role === "CAPTAIN") {
      const lock = await getTeamRosterLockState(teamId);
      // Il blocco rosa riguarda giocatori e modifiche strutturali della squadra.
      // Le sole immagini delle divise possono essere aggiornate direttamente:
      // non cambiano l'eleggibilità o la distinta e devono essere subito disponibili
      // nel Coach Mode.
      if (lock.locked && !isKitOnlyTeamUpdate(input)) {
        const request = await createLockedTeamChangeRequest({ teamId, actor, type: "TEAM_UPDATE", input });
        return NextResponse.json({ requestCreated: true, request, rosterLocked: true }, { status: 202 });
      }
    }
    const team = await updateTeam({ teamId, input });
    await writeAuditLog({
      leagueId: team.league.id, actor, action: "team.updated", entityType: "team", entityId: team.id,
      summary: `Squadra ${team.name} aggiornata`,
    });
    return NextResponse.json(team);
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
    const actor = await getServerSession();
    const result = await removeTeamFromLeague({ teamId, requestedLeagueId });
    await writeAuditLog({
      leagueId: result.leagueId, actor, action: "team.removed", entityType: "team", entityId: teamId,
      summary: `Squadra ${result.teamName} rimossa dal torneo`, metadata: { mode: result.mode },
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "Errore rimozione squadra");
  }
}