import { NextResponse } from "next/server";
import { requireLeagueAdmin } from "@/modules/permissions/server-guards";
import { apiErrorResponse } from "@/modules/core/api";
import { listAuditLogs } from "@/modules/audit/application/audit-service";

type Ctx = { params: Promise<{ leagueId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { leagueId } = await ctx.params;
  const authErr = await requireLeagueAdmin(leagueId);
  if (authErr) return authErr;

  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") ?? "80");
    const cursor = searchParams.get("cursor");
    const action = searchParams.get("action");
    const entityType = searchParams.get("entityType");

    return NextResponse.json(
      await listAuditLogs({
        leagueId,
        limit,
        cursor,
        action,
        entityType,
      })
    );
  } catch (error) {
    return apiErrorResponse(error, "Non è stato possibile caricare lo storico modifiche");
  }
}
