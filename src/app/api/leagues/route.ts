import { NextResponse } from "next/server";
import { getServerSession, requireAdmin } from "@/modules/permissions/server-guards";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import { createLeague, listLeaguesForSession } from "@/modules/leagues/application/league-service";
import { writeAuditLog } from "@/modules/audit/application/audit-service";

export async function GET() {
  const session = await getServerSession();

  try {
    return NextResponse.json(await listLeaguesForSession(session));
  } catch (error) {
    return apiErrorResponse(error, "Errore caricamento tornei");
  }
}

export async function POST(req: Request) {
  const err = await requireAdmin();
  if (err) return err;

  try {
    const session = await getServerSession();
    const body = await readJsonBody<Record<string, unknown>>(req);
    const league = await createLeague(body);
    await writeAuditLog({
      leagueId: league.id,
      actor: session,
      action: "league.created",
      entityType: "league",
      entityId: league.id,
      summary: `Creato torneo ${league.name}`,
      metadata: { name: league.name },
    });
    return NextResponse.json(league);
  } catch (error) {
    return apiErrorResponse(error, "Errore creazione torneo");
  }
}
