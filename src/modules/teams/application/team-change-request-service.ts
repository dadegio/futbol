import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";
import { AppError } from "@/modules/core/errors";
import { addPlayerToTeam, deletePlayer, swapTeamPlayerNumbers, updatePlayer } from "@/modules/players/application/player-service";
import { updateTeam } from "@/modules/teams/application/team-service";

type RequestType =
  | "TEAM_UPDATE"
  | "PLAYER_ADD"
  | "PLAYER_UPDATE"
  | "PLAYER_REMOVE"
  | "PLAYER_NUMBER_SWAP";

const TEAM_FIELDS = [
  "name",
  "badgeUrl",
  "description",
  "colorHex",
  "secondaryColorHex",
  "kitHomeUrl",
  "kitAwayUrl",
  "kitGoalkeeperUrl",
] as const;
const PLAYER_FIELDS = ["firstName", "lastName", "number", "position"] as const;
const PLAYER_PHOTO_FIELDS = ["photoUrl", "photoZoom", "photoPositionX", "photoPositionY"] as const;

function isLeagueAdmin(actor: SessionUser | null, leagueId: string) {
  return Boolean(actor && (actor.role === "ADMIN" || (actor.role === "LEAGUE_ADMIN" && actor.leagueId === leagueId)));
}

function isCaptainOf(actor: SessionUser | null, teamId: string) {
  return Boolean(actor?.role === "CAPTAIN" && actor.teamId === teamId);
}

function pick(input: Record<string, unknown>, fields: readonly string[]) {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(input, field)) out[field] = input[field];
  }
  return out;
}

export function containsPlayerPhotoMutation(input: Record<string, unknown>) {
  return PLAYER_PHOTO_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(input, field));
}

export async function getTeamRosterLockState(teamId: string, now = new Date()) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, leagueId: true },
  });
  if (!team) throw new AppError(404, "Squadra non trovata");

  const lockMatch = await prisma.match.findFirst({
    where: {
      leagueId: team.leagueId,
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      AND: [
        {
          OR: [
            { resultStatus: "FINAL" },
            { lifecycleStatus: "SCHEDULED", date: { lte: now } },
          ],
        },
      ],
    },
    orderBy: [{ date: "asc" }, { round: "asc" }],
    select: { id: true, round: true, date: true, finalizedAt: true, resultStatus: true },
  });

  const firstUpcoming = lockMatch
    ? null
    : await prisma.match.findFirst({
        where: {
          leagueId: team.leagueId,
          lifecycleStatus: "SCHEDULED",
          date: { gt: now },
          OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
        },
        orderBy: [{ date: "asc" }, { round: "asc" }],
        select: { id: true, round: true, date: true },
      });

  return {
    locked: Boolean(lockMatch),
    leagueId: team.leagueId,
    lockedAt: lockMatch?.date?.toISOString() ?? lockMatch?.finalizedAt?.toISOString() ?? null,
    lockMatchId: lockMatch?.id ?? null,
    lockRound: lockMatch?.round ?? null,
    firstUpcoming: firstUpcoming
      ? { id: firstUpcoming.id, round: firstUpcoming.round, date: firstUpcoming.date?.toISOString() ?? null }
      : null,
  };
}

async function assertTargetPlayer(teamId: string, playerId: string) {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { id: true, teamId: true },
  });
  if (!player || player.teamId !== teamId) throw new AppError(404, "Giocatore non trovato nella squadra");
}

export async function createLockedTeamChangeRequest({
  teamId,
  actor,
  type,
  input,
  targetPlayerId,
  reason,
}: {
  teamId: string;
  actor: SessionUser | null;
  type: RequestType;
  input: Record<string, unknown>;
  targetPlayerId?: string | null;
  reason?: string | null;
}) {
  const lock = await getTeamRosterLockState(teamId);
  if (!isCaptainOf(actor, teamId)) throw new AppError(403, "Richiesta riservata al capitano della squadra");
  if (!lock.locked) throw new AppError(409, "La rosa non è ancora bloccata: puoi modificare direttamente la squadra");

  let payload: Record<string, unknown>;
  if (type === "TEAM_UPDATE") payload = pick(input, TEAM_FIELDS);
  else if (type === "PLAYER_ADD" || type === "PLAYER_UPDATE") {
    if (containsPlayerPhotoMutation(input)) {
      throw new AppError(403, "Le foto profilo dei giocatori possono essere gestite solo dall'admin");
    }
    payload = pick(input, PLAYER_FIELDS);
  } else if (type === "PLAYER_NUMBER_SWAP") {
    payload = pick(input, ["aPlayerId", "bPlayerId"]);
  } else payload = {};

  if ((type === "PLAYER_UPDATE" || type === "PLAYER_REMOVE") && targetPlayerId) {
    await assertTargetPlayer(teamId, targetPlayerId);
  }

  const duplicate = await prisma.teamChangeRequest.findFirst({
    where: {
      teamId,
      requestedById: actor!.userId,
      type: type as never,
      status: "PENDING",
      ...(targetPlayerId ? { targetPlayerId } : {}),
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new AppError(409, "Esiste già una richiesta in attesa per questa modifica");
  }

  return prisma.teamChangeRequest.create({
    data: {
      leagueId: lock.leagueId,
      teamId,
      requestedById: actor!.userId,
      targetPlayerId: targetPlayerId || null,
      type: type as never,
      payload: payload as never,
      reason: reason?.trim() || null,
    },
    include: {
      requestedBy: { select: { id: true, username: true } },
    },
  });
}

export async function listTeamChangeRequests({ teamId, actor }: { teamId: string; actor: SessionUser | null }) {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { leagueId: true } });
  if (!team) throw new AppError(404, "Squadra non trovata");
  if (!isLeagueAdmin(actor, team.leagueId) && !isCaptainOf(actor, teamId)) throw new AppError(403, "Non autorizzato");

  return prisma.teamChangeRequest.findMany({
    where: {
      teamId,
      ...(isCaptainOf(actor, teamId) ? { requestedById: actor!.userId } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      requestedBy: { select: { id: true, username: true } },
      reviewedBy: { select: { id: true, username: true } },
    },
  });
}

export async function reviewTeamChangeRequest({
  requestId,
  actor,
  decision,
  reviewNote,
}: {
  requestId: string;
  actor: SessionUser | null;
  decision: "APPROVED" | "REJECTED";
  reviewNote?: string | null;
}) {
  const request = await prisma.teamChangeRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new AppError(404, "Richiesta non trovata");
  if (!isLeagueAdmin(actor, request.leagueId)) throw new AppError(403, "Solo l'admin può approvare o rifiutare la richiesta");
  if (request.status !== "PENDING") throw new AppError(409, "La richiesta è già stata valutata");

  if (decision === "REJECTED") {
    return prisma.teamChangeRequest.update({
      where: { id: requestId },
      data: { status: "REJECTED", reviewedById: actor!.userId, reviewedAt: new Date(), reviewNote: reviewNote?.trim() || null },
    });
  }

  const payload = (request.payload ?? {}) as Record<string, unknown>;
  if (request.type === "TEAM_UPDATE") {
    await updateTeam({ teamId: request.teamId, input: payload });
  } else if (request.type === "PLAYER_ADD") {
    await addPlayerToTeam({ teamId: request.teamId, input: payload, session: actor });
  } else if (request.type === "PLAYER_UPDATE") {
    if (!request.targetPlayerId) throw new AppError(400, "Giocatore della richiesta mancante");
    await updatePlayer({ playerId: request.targetPlayerId, input: payload, session: actor });
  } else if (request.type === "PLAYER_REMOVE") {
    if (!request.targetPlayerId) throw new AppError(400, "Giocatore della richiesta mancante");
    await deletePlayer(request.targetPlayerId);
  } else if (request.type === "PLAYER_NUMBER_SWAP") {
    await swapTeamPlayerNumbers({
      teamId: request.teamId,
      aPlayerId: String(payload.aPlayerId ?? ""),
      bPlayerId: String(payload.bPlayerId ?? ""),
    });
  }

  return prisma.teamChangeRequest.update({
    where: { id: requestId },
    data: { status: "APPROVED", reviewedById: actor!.userId, reviewedAt: new Date(), reviewNote: reviewNote?.trim() || null },
  });
}
