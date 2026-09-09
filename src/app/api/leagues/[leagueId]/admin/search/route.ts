export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireLeagueAdmin } from "@/modules/permissions/server-guards";
import { searchLeagueAdmin } from "@/modules/admin/application/admin-search-service";
import { apiErrorResponse } from "@/modules/core/api";
import { NO_STORE_HEADERS } from "@/modules/core/http-cache";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await ctx.params;
  const authErr = await requireLeagueAdmin(leagueId);
  if (authErr) return authErr;

  try {
    const query = new URL(req.url).searchParams.get("q") ?? "";
    return NextResponse.json(await searchLeagueAdmin(leagueId, query), { headers: NO_STORE_HEADERS });
  } catch (error) {
    return apiErrorResponse(error, "Errore ricerca amministrativa");
  }
}
