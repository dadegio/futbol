export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireLeagueAdmin } from "@/lib/server-auth";
import { getLeagueAdminSummary } from "@/modules/admin/application/admin-summary-service";
import { apiErrorResponse } from "@/modules/core/api";

export async function GET(
  _: Request,
  ctx: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await ctx.params;
  const authErr = await requireLeagueAdmin(leagueId);
  if (authErr) return authErr;

  try {
    return NextResponse.json(await getLeagueAdminSummary(leagueId));
  } catch (error) {
    return apiErrorResponse(error, "Errore caricamento riepilogo amministrativo");
  }
}