export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireLeagueAdmin } from "@/modules/permissions/server-guards";
import { getLeagueAdminOperations } from "@/modules/admin/application/admin-operations-service";
import { apiErrorResponse } from "@/modules/core/api";
import { NO_STORE_HEADERS } from "@/modules/core/http-cache";

export async function GET(
  _: Request,
  ctx: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await ctx.params;
  const authErr = await requireLeagueAdmin(leagueId);
  if (authErr) return authErr;

  try {
    return NextResponse.json(await getLeagueAdminOperations(leagueId), { headers: NO_STORE_HEADERS });
  } catch (error) {
    return apiErrorResponse(error, "Errore caricamento centro operativo");
  }
}
