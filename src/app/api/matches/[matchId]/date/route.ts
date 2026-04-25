export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { requireAdminOrCaptainOfMatch } from "@/lib/server-auth";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ matchId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { matchId } = await ctx.params;

  const authErr = await requireAdminOrCaptainOfMatch(matchId);
  if (authErr) return authErr;

  const body = await req.json().catch(() => ({}));
  const rawDate = body?.date;
  let date: Date | null;

  if (rawDate === null || rawDate === "") {
    date = null;
  } else if (typeof rawDate === "string") {
    date = new Date(rawDate);
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: "Data non valida" }, { status: 400 });
    }
  } else {
    return NextResponse.json(
      { error: "Parametro 'date' mancante o non valido" },
      { status: 400 },
    );
  }

  await prisma.match.update({
    where: { id: matchId },
    data: { date },
  });

  return NextResponse.json({ ok: true });
}
