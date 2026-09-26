export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { runWeeklyMatchReminders } from "@/modules/notifications/application/weekly-match-reminders";

export async function GET(req: Request) {
  const secret = String(process.env.CRON_SECRET ?? "").trim();
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET non configurato" },
      { status: 503 }
    );
  }

  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const force = new URL(req.url).searchParams.get("force") === "1";
  const result = await runWeeklyMatchReminders(new Date(), { force });
  return NextResponse.json(result);
}
