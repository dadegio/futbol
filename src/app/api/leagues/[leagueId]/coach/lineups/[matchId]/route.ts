import { NextResponse } from "next/server";
import { getServerSession } from "@/modules/auth/server-session";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import { deleteCoachLineupDraft, saveCoachLineup, saveCoachLineupDraft } from "@/modules/coaches/application/coach-lineup-service";

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ leagueId: string; matchId: string }> }
) {
  try {
    const { leagueId, matchId } = await ctx.params;
    const session = await getServerSession();
    const input = await readJsonBody<Record<string, unknown>>(req);
    return NextResponse.json(
      await saveCoachLineup({
        session,
        leagueId,
        matchId,
        input,
      })
    );
  } catch (error) {
    return apiErrorResponse(error, "Errore salvataggio formazione");
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ leagueId: string; matchId: string }> }) {
  try {
    const { leagueId, matchId } = await ctx.params;
    const session = await getServerSession();
    const input = await readJsonBody<Record<string, unknown>>(req);
    return NextResponse.json(await saveCoachLineupDraft({ session, leagueId, matchId, input }));
  } catch (error) { return apiErrorResponse(error, "Errore salvataggio bozza"); }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ leagueId: string; matchId: string }> }) {
  try {
    const { leagueId, matchId } = await ctx.params;
    const session = await getServerSession();
    const draftId = new URL(req.url).searchParams.get("draftId") ?? "";
    return NextResponse.json(await deleteCoachLineupDraft({ session, leagueId, matchId, draftId }));
  } catch (error) { return apiErrorResponse(error, "Errore eliminazione bozza"); }
}
