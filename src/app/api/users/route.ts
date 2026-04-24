/**
 * Admin-only user management endpoints.
 *
 * GET  /api/users          — list all users (passwords excluded)
 * POST /api/users          — create a new user
 * DELETE /api/users?id=…   — delete a user by id (admin account is protected)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/server-auth";
import { hashPassword } from "@/lib/session";

// ── GET /api/users ────────────────────────────────────────────────────────────
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      role: true,
      teamId: true,
      team: { select: { name: true } },
      createdAt: true,
    },
    orderBy: [{ role: "asc" }, { username: "asc" }],
  });

  return NextResponse.json(users);
}

// ── POST /api/users ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const { username, password, role, teamId } = body as {
    username?: string;
    password?: string;
    role?: string;
    teamId?: string | null;
  };

  if (!username?.trim()) {
    return NextResponse.json({ error: "Username obbligatorio" }, { status: 400 });
  }
  if (!password || password.length < 4) {
    return NextResponse.json({ error: "Password minimo 4 caratteri" }, { status: 400 });
  }
  if (role !== "ADMIN" && role !== "CAPTAIN") {
    return NextResponse.json({ error: "Ruolo non valido (ADMIN o CAPTAIN)" }, { status: 400 });
  }
  if (role === "CAPTAIN" && !teamId) {
    return NextResponse.json({ error: "Specifica teamId per un capitano" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: "Username già in uso" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      username: username.trim(),
      passwordHash: hashPassword(password),
      role: role as "ADMIN" | "CAPTAIN",
      teamId: role === "CAPTAIN" ? teamId : null,
    },
    select: { id: true, username: true, role: true, teamId: true, createdAt: true },
  });

  return NextResponse.json(user, { status: 201 });
}

// ── DELETE /api/users?id=… ────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Parametro id mancante" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
  }

  // Prevent deleting the last admin
  if (user.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: "Impossibile eliminare l'unico account admin" },
        { status: 400 }
      );
    }
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
