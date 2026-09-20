import { NextResponse } from "next/server";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import { getServerSession } from "@/modules/permissions/server-guards";
import { reviewTeamChangeRequest } from "@/modules/teams/application/team-change-request-service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ requestId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { requestId } = await ctx.params;
    const actor = await getServerSession();
    const body = await readJsonBody<Record<string, unknown>>(req);
    const decision = String(body.decision ?? "").toUpperCase();
    if (decision !== "APPROVED" && decision !== "REJECTED") {
      return NextResponse.json({ error: "Decisione non valida" }, { status: 400 });
    }
    const result = await reviewTeamChangeRequest({
      requestId,
      actor,
      decision,
      reviewNote: typeof body.reviewNote === "string" ? body.reviewNote : null,
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "Errore valutazione richiesta squadra");
  }
}
