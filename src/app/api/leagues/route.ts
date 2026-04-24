import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/server-auth";

export async function GET() {
  const leagues = await prisma.league.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(leagues);
}

export async function POST(req: Request) {
  const err = await requireAdmin();
  if (err) return err;

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Nome lega mancante" }, { status: 400 });

  const league = await prisma.league.create({ data: { name } });
  return NextResponse.json(league);
}