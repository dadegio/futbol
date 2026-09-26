export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import { getServerSession } from "@/modules/auth/server-session";
import { updateNotificationPreferences } from "@/modules/notifications/application/notification-service";

type Body = {
  matchReminders?: boolean;
  pushEnabled?: boolean;
};

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const body = await readJsonBody<Body>(req);
    return NextResponse.json(
      await updateNotificationPreferences(session.userId, body)
    );
  } catch (error) {
    return apiErrorResponse(error, "Errore salvataggio preferenze");
  }
}
