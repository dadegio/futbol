import { NextResponse } from "next/server";
import {
  getServerSession,
  isLeagueAdminSession,
  requireLeagueAdmin,
} from "@/modules/permissions/server-guards";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import { writeAuditLog } from "@/modules/audit/application/audit-service";
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
    const actor = await getServerSession();
    const field = await createField({ leagueId, input });
    await writeAuditLog({
      leagueId, actor, action: "field.created", entityType: "field", entityId: field.id,
      summary: `Campo ${field.name} creato`, metadata: { slots: field.slots.length },
    });
    return NextResponse.json(field, { status: 201 });
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
    const actor = await getServerSession();
    const field = await updateField({ leagueId, input });
    await writeAuditLog({
      leagueId, actor, action: "field.updated", entityType: "field", entityId: field.id,
      summary: `Campo ${field.name} aggiornato`, metadata: { active: field.active, slots: field.slots.length },
    });
    return NextResponse.json(field);
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
    const actor = await getServerSession();
    const fieldId = String(input.id ?? "").trim();
    const result = await deleteField({ leagueId, fieldId });
    await writeAuditLog({
      leagueId, actor, action: "field.deleted", entityType: "field", entityId: fieldId,
      summary: "Campo eliminato", metadata: { releasedBookings: result.releasedBookings },
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "Errore eliminazione campo");
  }
}