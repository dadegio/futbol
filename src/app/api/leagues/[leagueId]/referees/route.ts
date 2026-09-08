import { NextResponse } from "next/server";
import { requireLeagueAdmin } from "@/lib/server-auth";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import {
  createReferee,
  deleteReferee,
  listLeagueReferees,
  updateReferee,
} from "@/modules/referees/application/referee-service";

type Ctx = { params: Promise<{ leagueId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { leagueId } = await ctx.params;
  const denied = await requireLeagueAdmin(leagueId);
  if (denied) return denied;

  try {
    const matchId = new URL(req.url).searchParams.get("matchId")?.trim() || null;
    return NextResponse.json(await listLeagueReferees({ leagueId, matchId }));
  } catch (error) {
    return apiErrorResponse(error, "Errore caricamento arbitri");
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const { leagueId } = await ctx.params;
  const denied = await requireLeagueAdmin(leagueId);
  if (denied) return denied;

  try {
    const input = await readJsonBody<Record<string, unknown>>(req);
    return NextResponse.json(await createReferee({ leagueId, input }), { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Errore creazione arbitro");
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { leagueId } = await ctx.params;
  const denied = await requireLeagueAdmin(leagueId);
  if (denied) return denied;

  try {
    const input = await readJsonBody<Record<string, unknown>>(req);
    return NextResponse.json(await updateReferee({ leagueId, input }));
  } catch (error) {
    return apiErrorResponse(error, "Errore aggiornamento arbitro");
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { leagueId } = await ctx.params;
  const denied = await requireLeagueAdmin(leagueId);
  if (denied) return denied;

  try {
    const input = await readJsonBody<Record<string, unknown>>(req);
    return NextResponse.json(
      await deleteReferee({
        leagueId,
        refereeId: String(input.id ?? "").trim(),
      })
    );
  } catch (error) {
    return apiErrorResponse(error, "Errore eliminazione arbitro");
  }
}