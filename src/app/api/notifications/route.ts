export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import { getServerSession } from "@/modules/auth/server-session";
import {
  getNotificationCenter,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/modules/notifications/application/notification-service";

type PatchBody =
  | { action: "read"; id?: string }
  | { action: "read-all"; leagueId?: string | null };

export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const leagueId = new URL(req.url).searchParams.get("leagueId");
    return NextResponse.json(
      await getNotificationCenter(session.userId, leagueId)
    );
  } catch (error) {
    return apiErrorResponse(error, "Errore caricamento notifiche");
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const body = await readJsonBody<PatchBody>(req);

    if (body.action === "read" && body.id) {
      return NextResponse.json(
        await markNotificationRead(session.userId, body.id)
      );
    }
    if (body.action === "read-all") {
      return NextResponse.json(
        await markAllNotificationsRead(session.userId, body.leagueId ?? null)
      );
    }

    return NextResponse.json({ error: "Azione non valida" }, { status: 400 });
  } catch (error) {
    return apiErrorResponse(error, "Errore aggiornamento notifiche");
  }
}
