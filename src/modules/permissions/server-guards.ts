import "server-only";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/modules/auth/server-session";
import {
  canPerform,
  isCreator,
  isLeagueAdmin,
  isSuperAdmin,
  type Permission,
  type PermissionContext,
} from "./permissions";
import type { SessionUser } from "@/lib/session";

export { getServerSession };
export type { SessionUser };

function unauthorized(message = "Devi effettuare il login") {
  return NextResponse.json({ error: message }, { status: 401 });
}

function forbidden(message = "Non autorizzato") {
  return NextResponse.json({ error: message }, { status: 403 });
}

function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function isSuperAdminSession(session: SessionUser | null): boolean {
  return isSuperAdmin(session);
}

export function isLeagueAdminSession(
  session: SessionUser | null,
  leagueId: string
): boolean {
  return isLeagueAdmin(session, leagueId);
}

export function isCreatorSession(
  session: SessionUser | null,
  leagueId: string
): boolean {
  return isCreator(session, leagueId);
}

export async function requirePermission(
  permission: Permission,
  context: PermissionContext = {},
  message = "Non autorizzato"
): Promise<NextResponse | null> {
  const session = await getServerSession();
  if (!session) return unauthorized();
  if (canPerform(session, permission, context)) return null;
  return forbidden(message);
}

export async function requireAdmin(): Promise<NextResponse | null> {
  const session = await getServerSession();
  if (!session) return unauthorized();
  if (session.role !== "ADMIN") return forbidden("Accesso riservato al Super Admin");
  return null;
}

export async function requireLeagueAdmin(
  leagueId: string
): Promise<NextResponse | null> {
  const session = await getServerSession();
  if (!session) return unauthorized();
  if (!isLeagueAdminSession(session, leagueId)) {
    return forbidden("Non sei amministratore di questo torneo");
  }
  return null;
}

async function leagueIdForTeam(teamId: string): Promise<string | null> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { leagueId: true },
  });
  return team?.leagueId ?? null;
}

async function leagueIdForMatch(matchId: string): Promise<string | null> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { leagueId: true },
  });
  return match?.leagueId ?? null;
}

export async function requireLeagueAdminForTeam(
  teamId: string
): Promise<NextResponse | null> {
  const leagueId = await leagueIdForTeam(teamId);
  if (!leagueId) return notFound("Squadra non trovata");
  return requireLeagueAdmin(leagueId);
}

export async function requireLeagueAdminForMatch(
  matchId: string
): Promise<NextResponse | null> {
  const leagueId = await leagueIdForMatch(matchId);
  if (!leagueId) return notFound("Partita non trovata");
  return requireLeagueAdmin(leagueId);
}

export async function requireAdminOrCaptainOfTeam(
  teamId: string
): Promise<NextResponse | null> {
  const session = await getServerSession();
  if (!session) return unauthorized();

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { leagueId: true },
  });
  if (!team) return notFound("Squadra non trovata");
  if (canPerform(session, "team:manage", { leagueId: team.leagueId, teamId })) return null;
  return forbidden();
}

export async function requireAdminOrCaptainOfMatch(
  matchId: string
): Promise<NextResponse | null> {
  const session = await getServerSession();
  if (!session) return unauthorized();

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { leagueId: true, homeTeamId: true, awayTeamId: true },
  });
  if (!match) return notFound("Partita non trovata");

  if (
    canPerform(session, "booking:create", {
      leagueId: match.leagueId,
      matchTeamIds: [match.homeTeamId, match.awayTeamId],
    }) ||
    canPerform(session, "booking:override", { leagueId: match.leagueId })
  ) {
    return null;
  }

  return forbidden();
}

export async function requireMatchEditor(
  matchId: string
): Promise<NextResponse | null> {
  const session = await getServerSession();
  if (!session) return unauthorized();

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      leagueId: true,
      homeTeamId: true,
      awayTeamId: true,
      refereeId: true,
    },
  });
  if (!match) return notFound("Partita non trovata");

  if (
    canPerform(session, "match:edit", {
      leagueId: match.leagueId,
      matchTeamIds: [match.homeTeamId, match.awayTeamId],
      assignedRefereeId: match.refereeId,
    })
  ) {
    return null;
  }

  return forbidden("Puoi modificare soltanto le partite che ti sono assegnate");
}

export async function requireAdminOrCaptainOfPlayer(
  playerId: string
): Promise<NextResponse | null> {
  const session = await getServerSession();
  if (!session) return unauthorized();

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { teamId: true, team: { select: { leagueId: true } } },
  });
  if (!player) return notFound("Giocatore non trovato");
  if (
    canPerform(session, "player:manage", {
      leagueId: player.team.leagueId,
      teamId: player.teamId,
    })
  ) {
    return null;
  }
  return forbidden();
}

export async function requireAdminOrCaptainOfPlayoffSeries(
  seriesId: string
): Promise<NextResponse | null> {
  const session = await getServerSession();
  if (!session) return unauthorized();

  const series = await prisma.playoffSeries.findUnique({
    where: { id: seriesId },
    select: { leagueId: true, homeTeamId: true, awayTeamId: true },
  });
  if (!series) return notFound("Serie non trovata");
  if (
    canPerform(session, "match:edit", {
      leagueId: series.leagueId,
      matchTeamIds: [series.homeTeamId, series.awayTeamId].filter(Boolean) as string[],
    }) ||
    canPerform(session, "booking:create", {
      leagueId: series.leagueId,
      matchTeamIds: [series.homeTeamId, series.awayTeamId].filter(Boolean) as string[],
    })
  ) {
    return null;
  }
  return forbidden();
}

export async function requireCreatorOrLeagueAdmin(
  leagueId: string
): Promise<NextResponse | null> {
  const session = await getServerSession();
  if (!session) return unauthorized();
  if (
    canPerform(session, "media:create", { leagueId }) ||
    canPerform(session, "media:approve", { leagueId })
  ) {
    return null;
  }
  return forbidden("Accesso riservato a creator o admin del torneo");
}
