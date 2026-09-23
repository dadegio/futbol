import { prisma } from "@/lib/prisma";
import {
  canEditAdminPlayerDetails,
  canSeeAdminPlayerDetails,
  sanitizePlayerForRole,
} from "@/modules/players/application/player-visibility";
import type { SessionUser } from "@/lib/session";
import { FUTPOLI_RULES } from "@/modules/players/domain/tournament-rules";
import { AppError } from "@/modules/core/errors";

const PLAYER_STATUSES = new Set([
  "PENDING",
  "IN_REVIEW",
  "AUTHORIZED",
  "BLOCKED",
  "SUSPENDED",
  "RETIRED",
]);

function asNullableDate(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === "") return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function asBool(value: unknown) {
  return value === true;
}

function asClampedNumber(value: unknown, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return undefined;
  return Math.min(max, Math.max(min, number));
}

function asClampedInt(value: unknown, min: number, max: number) {
  const number = asClampedNumber(value, min, max);
  return number === undefined ? undefined : Math.round(number);
}

function toNonNegativeInt(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const integer = Math.floor(number);
  return integer < 0 ? null : integer;
}

const playerDetailSelect = {
  id: true,
  firstName: true,
  lastName: true,
  number: true,
  position: true,
  photoUrl: true,
  photoZoom: true,
  photoPositionX: true,
  photoPositionY: true,
  isTeamCaptain: true,
  fiscalCode: true,
  birthDate: true,
  documentSigned: true,
  signedAt: true,
  privacyConsent: true,
  internalPhotoConsent: true,
  publicPhotoConsent: true,
  mediaConsent: true,
  healthDeclaration: true,
  wildcardUsed: true,
  status: true,
  statusNote: true,
  teamId: true,
  team: {
    select: {
      id: true,
      name: true,
      badgeUrl: true,
      leagueId: true,
      league: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} as const;

export async function listLeaguePlayers({
  leagueId,
  query,
  statusFilter,
  session,
}: {
  leagueId: string;
  query: string | null;
  statusFilter: string | null;
  session: SessionUser | null;
}) {
  const qRaw = (query ?? "").trim();
  const normalizedStatus = (statusFilter ?? "").trim();
  const qNum = Number(qRaw);
  const isNum = Number.isInteger(qNum) && qNum > 0;

  const players = await prisma.player.findMany({
    where: {
      team: { leagueId, activeInLeague: true },
      ...(qRaw
        ? {
            OR: [
              { firstName: { contains: qRaw, mode: "insensitive" as const } },
              { lastName: { contains: qRaw, mode: "insensitive" as const } },
              { team: { name: { contains: qRaw, mode: "insensitive" as const } } },
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
      photoZoom: true,
      photoPositionX: true,
      photoPositionY: true,
      isTeamCaptain: true,
      documentSigned: true,
      mediaConsent: true,
      wildcardUsed: true,
      status: true,
      statusNote: true,
      teamId: true,
      team: {
        select: {
          id: true,
          name: true,
          badgeUrl: true,
        },
      },
    },
  });

  const sanitized = players.map((player) =>
    sanitizePlayerForRole(player, session, leagueId)
  );

  if (!normalizedStatus) return sanitized;

  return sanitized.filter((player) => {
    if (normalizedStatus === "ok") return player.isEligibleForMatchSheet === true;
    if (normalizedStatus === "todo") return player.isEligibleForMatchSheet !== true;
    return true;
  });
}

export async function getPlayerDetail({
  playerId,
  session,
}: {
  playerId: string;
  session: SessionUser | null;
}) {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: playerDetailSelect,
  });

  if (!player) throw new AppError(404, "Giocatore non trovato");

  return sanitizePlayerForRole(player, session, player.team.leagueId);
}

export async function updatePlayer({
  playerId,
  input,
  session,
}: {
  playerId: string;
  input: Record<string, unknown>;
  session: SessionUser | null;
}) {
  const existing = await prisma.player.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      teamId: true,
      team: { select: { leagueId: true } },
    },
  });

  if (!existing) throw new AppError(404, "Giocatore non trovato");

  const canEditAdminFields = canEditAdminPlayerDetails(
    session,
    existing.team.leagueId
  );

  const attemptsPhotoChange = ["photoUrl", "photoZoom", "photoPositionX", "photoPositionY"]
    .some((field) => Object.prototype.hasOwnProperty.call(input, field));
  if (attemptsPhotoChange && !canEditAdminFields) {
    throw new AppError(403, "Le foto profilo dei giocatori possono essere gestite solo dall'admin");
  }

  const firstName =
    input.firstName !== undefined ? String(input.firstName).trim() : undefined;
  const lastName =
    input.lastName !== undefined ? String(input.lastName).trim() : undefined;
  const number = input.number !== undefined ? Number(input.number) : undefined;
  const position =
    input.position === undefined
      ? undefined
      : input.position === null
        ? null
        : String(input.position).trim() || null;
  const photoUrl =
    input.photoUrl === undefined
      ? undefined
      : input.photoUrl === null
        ? null
        : String(input.photoUrl).trim() || null;
  const photoZoom =
    input.photoZoom === undefined
      ? undefined
      : asClampedNumber(input.photoZoom, 0.75, 2);
  const photoPositionX =
    input.photoPositionX === undefined
      ? undefined
      : asClampedInt(input.photoPositionX, 0, 100);
  const photoPositionY =
    input.photoPositionY === undefined
      ? undefined
      : asClampedInt(input.photoPositionY, 0, 100);
  const isTeamCaptain =
    input.isTeamCaptain === undefined ? undefined : asBool(input.isTeamCaptain);
  const fiscalCode =
    input.fiscalCode === undefined
      ? undefined
      : String(input.fiscalCode).trim() || null;
  const birthDate = asNullableDate(input.birthDate);
  const signedAt = asNullableDate(input.signedAt);
  const documentSigned =
    input.documentSigned === undefined ? undefined : asBool(input.documentSigned);
  const privacyConsent =
    input.privacyConsent === undefined ? undefined : asBool(input.privacyConsent);
  const internalPhotoConsent =
    input.internalPhotoConsent === undefined
      ? undefined
      : asBool(input.internalPhotoConsent);
  const publicPhotoConsent =
    input.publicPhotoConsent === undefined
      ? undefined
      : asBool(input.publicPhotoConsent);
  const mediaConsent =
    input.mediaConsent === undefined ? undefined : asBool(input.mediaConsent);
  const healthDeclaration =
    input.healthDeclaration === undefined
      ? undefined
      : asBool(input.healthDeclaration);
  const wildcardUsed =
    input.wildcardUsed === undefined ? undefined : asBool(input.wildcardUsed);
  const status =
    input.status === undefined
      ? undefined
      : String(input.status).trim().toUpperCase();
  const statusNote =
    input.statusNote === undefined
      ? undefined
      : String(input.statusNote).trim() || null;

  if (firstName !== undefined && !firstName) {
    throw new AppError(400, "Nome non valido");
  }
  if (lastName !== undefined && !lastName) {
    throw new AppError(400, "Cognome non valido");
  }
  if (
    number !== undefined &&
    (!Number.isInteger(number) || number <= 0 || number > 99)
  ) {
    throw new AppError(400, "Numero maglia non valido");
  }
  if (input.photoZoom !== undefined && photoZoom === undefined) {
    throw new AppError(400, "Zoom foto non valido");
  }
  if (input.photoPositionX !== undefined && photoPositionX === undefined) {
    throw new AppError(400, "Posizione orizzontale foto non valida");
  }
  if (input.photoPositionY !== undefined && photoPositionY === undefined) {
    throw new AppError(400, "Posizione verticale foto non valida");
  }
  if (input.birthDate !== undefined && birthDate === undefined) {
    throw new AppError(400, "Data di nascita non valida");
  }
  if (input.signedAt !== undefined && signedAt === undefined) {
    throw new AppError(400, "Data firma non valida");
  }
  if (status !== undefined && !PLAYER_STATUSES.has(status)) {
    throw new AppError(400, "Stato giocatore non valido");
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (canEditAdminFields && isTeamCaptain === true) {
        await tx.player.updateMany({
          where: {
            teamId: existing.teamId,
            id: { not: playerId },
            isTeamCaptain: true,
          },
          data: { isTeamCaptain: false },
        });
      }

      return tx.player.update({
        where: { id: playerId },
        data: {
          ...(firstName !== undefined ? { firstName } : {}),
          ...(lastName !== undefined ? { lastName } : {}),
          ...(number !== undefined ? { number } : {}),
          ...(position !== undefined ? { position } : {}),
          ...(photoUrl !== undefined ? { photoUrl } : {}),
          ...(photoZoom !== undefined ? { photoZoom } : {}),
          ...(photoPositionX !== undefined ? { photoPositionX } : {}),
          ...(photoPositionY !== undefined ? { photoPositionY } : {}),
          ...(canEditAdminFields && isTeamCaptain !== undefined
            ? { isTeamCaptain }
            : {}),
          ...(canEditAdminFields && fiscalCode !== undefined ? { fiscalCode } : {}),
          ...(canEditAdminFields && birthDate !== undefined ? { birthDate } : {}),
          ...(canEditAdminFields && signedAt !== undefined ? { signedAt } : {}),
          ...(canEditAdminFields && documentSigned !== undefined
            ? { documentSigned }
            : {}),
          ...(canEditAdminFields && privacyConsent !== undefined
            ? { privacyConsent }
            : {}),
          ...(canEditAdminFields && internalPhotoConsent !== undefined
            ? { internalPhotoConsent }
            : {}),
          ...(canEditAdminFields && publicPhotoConsent !== undefined
            ? { publicPhotoConsent }
            : {}),
          ...(canEditAdminFields && mediaConsent !== undefined
            ? { mediaConsent }
            : {}),
          ...(canEditAdminFields && healthDeclaration !== undefined
            ? { healthDeclaration }
            : {}),
          ...(canEditAdminFields && wildcardUsed !== undefined
            ? { wildcardUsed }
            : {}),
          ...(canEditAdminFields && status !== undefined
            ? { status: status as never }
            : {}),
          ...(canEditAdminFields && statusNote !== undefined ? { statusNote } : {}),
        },
        select: playerDetailSelect,
      });
    });

    return sanitizePlayerForRole(updated, session, existing.team.leagueId);
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new AppError(409, "Numero maglia già usato in questa squadra");
    }
    throw error;
  }
}

export async function deletePlayer(playerId: string) {
  const existing = await prisma.player.findUnique({
    where: { id: playerId },
    select: { id: true },
  });
  if (!existing) throw new AppError(404, "Giocatore non trovato");

  await prisma.player.delete({ where: { id: playerId } });
  return { ok: true };
}

export async function addPlayerToTeam({
  teamId,
  input,
  session = null,
}: {
  teamId: string;
  input: Record<string, unknown>;
  session?: SessionUser | null;
}) {
  const firstName = String(input.firstName ?? "").trim();
  const lastName = String(input.lastName ?? "").trim();
  const number = toNonNegativeInt(input.number);
  const position = input.position ? String(input.position).trim() : null;

  const teamAccess = await prisma.team.findUnique({
    where: { id: teamId },
    select: { leagueId: true },
  });
  if (!teamAccess) throw new AppError(400, "Squadra non valida");
  const canEditAdminFields = canEditAdminPlayerDetails(session, teamAccess.leagueId);
  if (Object.prototype.hasOwnProperty.call(input, "photoUrl") && !canEditAdminFields) {
    throw new AppError(403, "La foto profilo del giocatore può essere inserita solo dall'admin");
  }
  const photoUrl = canEditAdminFields && input.photoUrl ? String(input.photoUrl).trim() : null;

  if (!teamId) throw new AppError(400, "teamId mancante nella route");
  if (!firstName || !lastName) {
    throw new AppError(400, "Nome e cognome sono obbligatori");
  }
  if (number === null || number > 99) {
    throw new AppError(400, "Numero maglia non valido (0-99)");
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { players: { select: { id: true } } },
  });
  if (!team) throw new AppError(400, "Squadra non valida");
  if (team.players.length >= FUTPOLI_RULES.maxPlayersPerTeam) {
    throw new AppError(
      400,
      `Rosa completa: massimo ${FUTPOLI_RULES.maxPlayersPerTeam} giocatori`
    );
  }

  try {
    return await prisma.player.create({
      data: {
        firstName,
        lastName,
        number,
        position: position || null,
        photoUrl: photoUrl || null,
        team: { connect: { id: teamId } },
      },
    });
  } catch {
    throw new AppError(
      400,
      "Numero maglia già usato in questa squadra (o dati non validi)"
    );
  }
}

export async function swapTeamPlayerNumbers({
  teamId,
  aPlayerId,
  bPlayerId,
}: {
  teamId: string;
  aPlayerId: string;
  bPlayerId: string;
}) {
  if (!aPlayerId || !bPlayerId) {
    throw new AppError(400, "playerId mancanti");
  }
  if (aPlayerId === bPlayerId) {
    throw new AppError(400, "Seleziona due giocatori diversi");
  }

  const players = await prisma.player.findMany({
    where: { id: { in: [aPlayerId, bPlayerId] } },
    select: { id: true, teamId: true, number: true },
  });
  const a = players.find((player) => player.id === aPlayerId);
  const b = players.find((player) => player.id === bPlayerId);

  if (!a || !b) throw new AppError(404, "Giocatore non trovato");
  if (a.teamId !== teamId || b.teamId !== teamId) {
    throw new AppError(400, "I giocatori non appartengono a questa squadra");
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.player.update({
        where: { id: aPlayerId },
        data: { number: -1 },
      });
      await tx.player.update({
        where: { id: bPlayerId },
        data: { number: a.number },
      });
      await tx.player.update({
        where: { id: aPlayerId },
        data: { number: b.number },
      });
    });
  } catch {
    throw new AppError(500, "Errore scambio numeri");
  }

  return { ok: true };
}

export async function getPlayerStats({
  playerId,
  session,
}: {
  playerId: string;
  session: SessionUser | null;
}) {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      teamId: true,
      team: { select: { leagueId: true } },
    },
  });
  if (!player) throw new AppError(404, "Giocatore non trovato");

  const showAdminDetails = canSeeAdminPlayerDetails(
    session,
    player.team.leagueId
  );

  const [aggregate, sheetEntries, recentStats, appearances, mvpAwards] = await Promise.all([
    prisma.matchPlayerStat.aggregate({
      where: { playerId, match: { resultStatus: "FINAL" } },
      _sum: { goals: true, assists: true },
    }),
    prisma.matchSheetPlayer.findMany({
      where: { playerId, match: { resultStatus: "FINAL" } },
      orderBy: [{ match: { date: "desc" } }, { createdAt: "desc" }],
      take: 8,
      select: {
        matchId: true,
        match: {
          select: {
            id: true,
            date: true,
            homeGoals: true,
            awayGoals: true,
            homeTeam: { select: { name: true } },
            awayTeam: { select: { name: true } },
          },
        },
      },
    }),
    prisma.matchPlayerStat.findMany({
      where: { playerId, match: { resultStatus: "FINAL" } },
      select: { matchId: true, goals: true, assists: true },
    }),
    prisma.matchSheetPlayer.count({ where: { playerId, match: { resultStatus: "FINAL" } } }),
    prisma.match.count({ where: { mvpPlayerId: playerId, resultStatus: "FINAL" } }),
  ]);

  const statsByMatch = new Map<string, { goals: number; assists: number }>(
    recentStats.map((row) => [
      row.matchId,
      { goals: row.goals, assists: row.assists },
    ])
  );

  return {
    goals: aggregate._sum.goals ?? 0,
    assists: aggregate._sum.assists ?? 0,
    appearances,
    mvpAwards,
    ...(showAdminDetails
      ? { feeCents: appearances * FUTPOLI_RULES.playerFeeCentsPerAppearance }
      : {}),
    recentMatches: sheetEntries.map((entry) => {
      const stat = statsByMatch.get(entry.matchId);
      return {
        matchId: entry.match.id,
        date: entry.match.date,
        homeTeamName: entry.match.homeTeam.name,
        awayTeamName: entry.match.awayTeam.name,
        homeGoals: entry.match.homeGoals,
        awayGoals: entry.match.awayGoals,
        goals: stat?.goals ?? 0,
        assists: stat?.assists ?? 0,
      };
    }),
  };
}