import { NextRequest, NextResponse } from "next/server";
import { getServerSession, requireAdmin } from "@/modules/permissions/server-guards";
import {
  createUser,
  deleteUser,
  listUsers,
  updateUserPassword,
} from "@/modules/admin/application/user-service";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    return NextResponse.json(await listUsers());
  } catch (error) {
    return apiErrorResponse(error, "Errore caricamento utenti");
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const actor = await getServerSession();
    const input = await readJsonBody<Record<string, unknown>>(req);
    return NextResponse.json(await createUser({ input, actor }), { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Errore creazione utente");
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const actor = await getServerSession();
    const input = await readJsonBody<Record<string, unknown>>(req);
    return NextResponse.json(
      await updateUserPassword({
        userId: req.nextUrl.searchParams.get("id"),
        password: input.password,
        actor,
      })
    );
  } catch (error) {
    return apiErrorResponse(error, "Errore aggiornamento utente");
  }
}

export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const actor = await getServerSession();
    return NextResponse.json(
      await deleteUser({
        userId: req.nextUrl.searchParams.get("id"),
        actor,
      })
    );
  } catch (error) {
    return apiErrorResponse(error, "Errore eliminazione utente");
  }
}