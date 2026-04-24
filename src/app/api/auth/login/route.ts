import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createToken } from "@/lib/session";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const username = String(body?.username ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username e password sono obbligatori" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { username } });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json(
      { error: "Credenziali non valide" },
      { status: 401 }
    );
  }

  const token = createToken({
    userId: user.id,
    username: user.username,
    role: user.role as "ADMIN" | "CAPTAIN",
    teamId: user.teamId ?? null,
  });

  return NextResponse.json({
    token,
    user: {
      userId: user.id,
      username: user.username,
      role: user.role,
      teamId: user.teamId ?? null,
    },
  });
}
