export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import { getServerSession } from "@/modules/auth/server-session";
import {
  removePushSubscription,
  savePushSubscription,
} from "@/modules/notifications/application/notification-service";

type SubscriptionBody = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const body = await readJsonBody<SubscriptionBody>(req);
    return NextResponse.json(
      await savePushSubscription(session.userId, body)
    );
  } catch (error) {
    return apiErrorResponse(error, "Errore attivazione notifiche push");
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const body = await readJsonBody<{ endpoint?: string }>(req);
    return NextResponse.json(
      await removePushSubscription(session.userId, body.endpoint)
    );
  } catch (error) {
    return apiErrorResponse(error, "Errore disattivazione notifiche push");
  }
}
