import { NextResponse } from "next/server";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import { getServerSession, requireMatchEditor } from "@/modules/permissions/server-guards";
import { saveMatchResult } from "@/modules/matches/application/save-match-result";
import { writeAuditLog } from "@/modules/audit/application/audit-service";

type Body = {
  homeGoals?: number;
  awayGoals?: number;
  playerStats?: Array<{ playerId: string; goals: number; assists: number }>;
  sheetPlayerIds?: string[];
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await ctx.params;

  const authErr = await requireMatchEditor(matchId);
  if (authErr) return authErr;

  try {
    const session = await getServerSession();
    const input = await readJsonBody<Body>(req);
    const result = await saveMatchResult({ matchId, input });
    await writeAuditLog({
      leagueId: result.leagueId,
      actor: session,
      action: "match.result_saved",
      entityType: "match",
      entityId: matchId,
      summary: `Salvato risultato ${input.homeGoals ?? "?"}-${input.awayGoals ?? "?"}`,
      metadata: {
        homeGoals: input.homeGoals,
        awayGoals: input.awayGoals,
        playerStats: input.playerStats?.length ?? 0,
        sheetPlayers: input.sheetPlayerIds?.length ?? 0,
      },
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return apiErrorResponse(error, "Non è stato possibile salvare il risultato");
  }
}
