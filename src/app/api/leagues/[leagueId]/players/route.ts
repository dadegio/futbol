export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, ctx: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await ctx.params;

  const url = new URL(req.url);
  const qRaw = (url.searchParams.get("q") ?? "").trim();

  if (!qRaw) {
    return NextResponse.json([]);
  }

  const qNum = Number(qRaw);
  const isNum = Number.isInteger(qNum) && qNum > 0;

  const players = await prisma.player.findMany({
    where: {
      team: { leagueId },
      OR: [
        { firstName: { contains: qRaw } },
        { lastName: { contains: qRaw } },
        { team: { name: { contains: qRaw } } },
        ...(isNum ? [{ number: qNum }] : []),
      ],
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 20,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      number: true,
      team: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return NextResponse.json(players);
}
