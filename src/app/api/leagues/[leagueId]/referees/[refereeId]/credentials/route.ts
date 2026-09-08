import { NextResponse } from "next/server";
import { requireLeagueAdmin } from "@/lib/server-auth";
import { apiErrorResponse } from "@/modules/core/api";
import { createRefereeCredentials } from "@/modules/referees/application/referee-service";

type Ctx = { params: Promise<{ leagueId: string; refereeId: string }> };

export async function POST(_: Request, ctx: Ctx) {
  const { leagueId, refereeId } = await ctx.params;
  const denied = await requireLeagueAdmin(leagueId);
  if (denied) return denied;

  try {
    return NextResponse.json(
      await createRefereeCredentials({ leagueId, refereeId }),
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error, "Errore creazione credenziali arbitro");
  }
}