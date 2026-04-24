import "server-only";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { parseToken, type SessionUser } from "./session";
import { prisma } from "./prisma";

// ── read session from Authorization: Bearer <token> header ──────────────────
export async function getServerSession(): Promise<SessionUser | null> {
  const headersList = await headers();
  const auth = headersList.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return parseToken(auth.slice(7));
}

// ── API route guards ────────────────────────────────────────────────────────
// Returns a NextResponse error if the check fails, null if access is granted.

export async function requireAdmin(): Promise<NextResponse | null> {
  const session = await getServerSession();
  if (!session)
    return NextResponse.json({ error: "Devi effettuare il login" }, { status: 401 });
  if (session.role !== "ADMIN")
    return NextResponse.json({ error: "Accesso riservato all'amministratore" }, { status: 403 });
  return null;
}

export async function requireAdminOrCaptainOfTeam(
  teamId: string
): Promise<NextResponse | null> {
  const session = await getServerSession();
  if (!session)
    return NextResponse.json({ error: "Devi effettuare il login" }, { status: 401 });
  if (session.role === "ADMIN") return null;
  if (session.role === "CAPTAIN" && session.teamId === teamId) return null;
  return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
}

export async function requireAdminOrCaptainOfMatch(
  matchId: string
): Promise<NextResponse | null> {
  const session = await getServerSession();
  if (!session)
    return NextResponse.json({ error: "Devi effettuare il login" }, { status: 401 });
  if (session.role === "ADMIN") return null;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { homeTeamId: true, awayTeamId: true },
  });
  if (!match) return NextResponse.json({ error: "Partita non trovata" }, { status: 404 });

  if (
    session.role === "CAPTAIN" &&
    (session.teamId === match.homeTeamId || session.teamId === match.awayTeamId)
  )
    return null;

  return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
}

export async function requireAdminOrCaptainOfPlayer(
  playerId: string
): Promise<NextResponse | null> {
  const session = await getServerSession();
  if (!session)
    return NextResponse.json({ error: "Devi effettuare il login" }, { status: 401 });
  if (session.role === "ADMIN") return null;

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { teamId: true },
  });
  if (!player) return NextResponse.json({ error: "Giocatore non trovato" }, { status: 404 });

  if (session.role === "CAPTAIN" && session.teamId === player.teamId) return null;

  return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
}
