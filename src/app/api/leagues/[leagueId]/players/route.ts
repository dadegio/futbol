export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, ctx: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await ctx.params;

  const url = new URL(req.url);
  const qRaw = (url.searchParams.get("q") ?? "").trim();

  const qNum = Number(qRaw);
  const isNum = Number.isInteger(qNum) && qNum > 0;

  const players = await prisma.player.findMany({
    where: {
      team: { leagueId },

      ...(qRaw
        ? {
            OR: [
              { firstName: { contains: qRaw, mode: "insensitive" } },
              { lastName: { contains: qRaw, mode: "insensitive" } },
              { team: { name: { contains: qRaw, mode: "insensitive" } } },
              ...(isNum ? [{ number: qNum }] : []),
            ],
          }
        : {}),
    },

    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],

    select: {
      id: true,
      firstName: true,
      lastName: true,
      number: true,
      position: true,
      photoUrl: true,
      team: {
        select: {
          id: true,
          name: true,
          badgeUrl: true,
        },
      },
    },
  });

  return NextResponse.json(players);
}