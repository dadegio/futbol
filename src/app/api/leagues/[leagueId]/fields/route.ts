import { NextResponse } from "next/server";
import {
  getServerSession,
  isLeagueAdminSession,
  requireLeagueAdmin,
} from "@/lib/server-auth";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import {
  createField,
  deleteField,
  listLeagueFields,
  updateField,
} from "@/modules/fields/application/field-service";

type Ctx = { params: Promise<{ leagueId: string }> };

export async function GET(_: Request, ctx: Ctx) {
  try {
    const { leagueId } = await ctx.params;
    const session = await getServerSession();
    return NextResponse.json(
      await listLeagueFields({
        leagueId,
        includeInactive: isLeagueAdminSession(session, leagueId),
      })
    );
  } catch (error) {
    return apiErrorResponse(error, "Errore caricamento campi");
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const { leagueId } = await ctx.params;
  const denied = await requireLeagueAdmin(leagueId);
  if (denied) return denied;

  try {
    const input = await readJsonBody<Record<string, unknown>>(req);
    return NextResponse.json(await createField({ leagueId, input }), { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Errore creazione campo");
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { leagueId } = await ctx.params;
  const denied = await requireLeagueAdmin(leagueId);
  if (denied) return denied;

  try {
    const input = await readJsonBody<Record<string, unknown>>(req);
    return NextResponse.json(await updateField({ leagueId, input }));
  } catch (error) {
    return apiErrorResponse(error, "Errore aggiornamento campo");
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { leagueId } = await ctx.params;
  const denied = await requireLeagueAdmin(leagueId);
  if (denied) return denied;

  try {
    const input = await readJsonBody<Record<string, unknown>>(req);
    return NextResponse.json(
      await deleteField({
        leagueId,
        fieldId: String(input.id ?? "").trim(),
      })
    );
  } catch (error) {
    return apiErrorResponse(error, "Errore eliminazione campo");
  }
}