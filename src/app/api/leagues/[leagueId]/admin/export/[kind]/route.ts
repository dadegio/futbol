import { apiErrorResponse } from "@/modules/core/api";
import { requireLeagueAdmin } from "@/modules/permissions/server-guards";
import { getAdminExport, type AdminExportKind } from "@/modules/admin/application/admin-export-service";

const KINDS = new Set<AdminExportKind>(["calendar", "results", "scorers", "fees", "players"]);

export async function GET(
  _: Request,
  ctx: { params: Promise<{ leagueId: string; kind: string }> }
) {
  const { leagueId, kind } = await ctx.params;
  const authErr = await requireLeagueAdmin(leagueId);
  if (authErr) return authErr;

  try {
    if (!KINDS.has(kind as AdminExportKind)) {
      return new Response("Export non valido", { status: 400 });
    }
    const result = await getAdminExport(leagueId, kind as AdminExportKind);
    return new Response(result.content, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiErrorResponse(error, "Export non disponibile");
  }
}
