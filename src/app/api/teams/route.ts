import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server-auth";
import { apiErrorResponse } from "@/modules/core/api";
import { listAllTeams } from "@/modules/teams/application/team-service";

export async function GET() {
  const authErr = await requireAdmin();
  if (authErr) return authErr;

  try {
    return NextResponse.json(await listAllTeams());
  } catch (error) {
    return apiErrorResponse(error, "Errore caricamento squadre");
  }
}