import "server-only";

import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";
import { writeAuditLog } from "@/modules/audit/application/audit-service";
import { AppError } from "@/modules/core/errors";
import {
  COACH_LINEUP_LOCK_MINUTES,
  assignPlayersToFormation,
  isCoachFormation,
  lineupDeadline,
  type CoachFormation,
} from "@/modules/coaches/domain/coach-formations";
import {
  FUTPOLI_RULES,
  isPlayerEligibleForMatchSheet,
} from "@/modules/players/domain/tournament-rules";

type EntryStatus = "STARTER" | "BENCH";

function isEditable(match: {
  date: Date | null;
  lifecycleStatus: string;
  resultStatus: string | null;
}) {
  if (match.lifecycleStatus === "CANCELLED" || match.resultStatus === "FINAL") return false;
  if (match.lifecycleStatus === "POSTPONED") return true;
  const deadline = lineupDeadline(match.date);
  return !deadline || Date.now() < deadline.getTime();
}

async function getContext(
  session: SessionUser | null,
  leagueId: string,
  matchId: string
) {
  if (!session || session.role !== "COACH") {
    throw new AppError(403, "Accesso riservato agli allenatori");
  }

  const assignment = await prisma.coachAssignment.findFirst({
    where: { userId: session.userId, leagueId },
    select: {
      teamId: true,
      team: {
        select: {
          id: true,
          name: true,
          badgeUrl: true,
          colorHex: true,
          secondaryColorHex: true,
          kitHomeUrl: true,
          kitAwayUrl: true,
          kitGoalkeeperUrl: true,
        },
      },
    },
  });
  if (!assignment) throw new AppError(403, "Non sei associato a una squadra in questo torneo");

  const match = await prisma.match.findFirst({
    where: {
      id: matchId,
      leagueId,
      OR: [{ homeTeamId: assignment.teamId }, { awayTeamId: assignment.teamId }],
    },
    select: {
      id: true,
      round: true,
      date: true,
      venueName: true,
      lifecycleStatus: true,
      resultStatus: true,
      homeTeamId: true,
      awayTeamId: true,
      homeTeam: {
        select: {
          id: true,
          name: true,
          badgeUrl: true,
          colorHex: true,
          secondaryColorHex: true,
        },
      },
      awayTeam: {
        select: {
          id: true,
          name: true,
          badgeUrl: true,
          colorHex: true,
          secondaryColorHex: true,
        },
      },
    },
  });
  if (!match) throw new AppError(404, "Partita non trovata per questa squadra");

  return { assignment, match };
}

export async function getCoachLineupData(
  session: SessionUser | null,
  leagueId: string,
  matchId: string
) {
  const { assignment, match } = await getContext(session, leagueId, matchId);

  const [players, lineup, finishedMatches] = await Promise.all([
    prisma.player.findMany({
      where: { teamId: assignment.teamId },
      orderBy: [{ number: "asc" }, { lastName: "asc" }],
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
        status: true,
        documentSigned: true,
        mediaConsent: true,
      },
    }),
    prisma.matchLineup.findUnique({
      where: {
        matchId_teamId: {
          matchId,
          teamId: assignment.teamId,
        },
      },
      select: {
        id: true,
        formation: true,
        updatedAt: true,
        players: {
          orderBy: [{ status: "asc" }, { sortOrder: "asc" }],
          select: {
            playerId: true,
            status: true,
            positionX: true,
            positionY: true,
            sortOrder: true,
          },
        },
      },
    }),
    prisma.match.findMany({
      where: {
        leagueId,
        resultStatus: "FINAL",
        OR: [{ homeTeamId: assignment.teamId }, { awayTeamId: assignment.teamId }],
      },
      select: {
        id: true,
        mvpPlayerId: true,
      },
    }),
  ]);

  const finishedIds = finishedMatches.map((finishedMatch) => finishedMatch.id);
  const [statRows, appearanceRows] = await Promise.all([
    finishedIds.length
      ? prisma.matchPlayerStat.findMany({
          where: {
            matchId: { in: finishedIds },
            player: { teamId: assignment.teamId },
          },
          select: {
            playerId: true,
            goals: true,
            assists: true,
          },
        })
      : Promise.resolve([]),
    finishedIds.length
      ? prisma.matchSheetPlayer.findMany({
          where: {
            matchId: { in: finishedIds },
            teamId: assignment.teamId,
          },
          select: {
            playerId: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const playerStats = new Map<
    string,
    { appearances: number; goals: number; assists: number; mvp: number }
  >();

  for (const player of players) {
    playerStats.set(player.id, {
      appearances: 0,
      goals: 0,
      assists: 0,
      mvp: 0,
    });
  }

  for (const row of appearanceRows) {
    const value = playerStats.get(row.playerId);
    if (value) value.appearances += 1;
  }

  for (const row of statRows) {
    const value = playerStats.get(row.playerId);
    if (value) {
      value.goals += row.goals;
      value.assists += row.assists;
    }
  }

  for (const finishedMatch of finishedMatches) {
    if (!finishedMatch.mvpPlayerId) continue;
    const value = playerStats.get(finishedMatch.mvpPlayerId);
    if (value) value.mvp += 1;
  }

  const drafts = await prisma.coachLineupDraft.findMany({
    where: { matchId, teamId: assignment.teamId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, formation: true, players: true, updatedAt: true },
  });

  const isHome = match.homeTeamId === assignment.teamId;

  return {
    team: assignment.team,
    opponent: isHome ? match.awayTeam : match.homeTeam,
    match: {
      id: match.id,
      round: match.round,
      date: match.date,
      venueName: match.venueName,
      lifecycleStatus: match.lifecycleStatus,
      resultStatus: match.resultStatus,
      isHome,
    },
    editable: isEditable(match),
    deadline: lineupDeadline(match.date),
    lockMinutes: COACH_LINEUP_LOCK_MINUTES,
    maxStarters: 8,
    maxCalled: FUTPOLI_RULES.maxPlayersPerTeam,
    players: players.map((player) => ({
      id: player.id,
      firstName: player.firstName,
      lastName: player.lastName,
      number: player.number,
      position: player.position,
      photoUrl: player.photoUrl,
      photoZoom: player.photoZoom,
      photoPositionX: player.photoPositionX,
      photoPositionY: player.photoPositionY,
      eligible: isPlayerEligibleForMatchSheet(player),
      stats: playerStats.get(player.id) ?? {
        appearances: 0,
        goals: 0,
        assists: 0,
        mvp: 0,
      },
    })),
    drafts: drafts.map((draft) => ({
      ...draft,
      updatedAt: draft.updatedAt,
    })),
    lineup: lineup
      ? {
          id: lineup.id,
          formation: lineup.formation,
          updatedAt: lineup.updatedAt,
          players: lineup.players,
        }
      : {
          id: null,
          formation: "3-3-1",
          updatedAt: null,
          players: [],
        },
  };
}

function clampCoordinate(value: unknown, min: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

export async function saveCoachLineup({
  session,
  leagueId,
  matchId,
  input,
}: {
  session: SessionUser | null;
  leagueId: string;
  matchId: string;
  input: Record<string, unknown>;
}) {
  const { assignment, match } = await getContext(session, leagueId, matchId);

  if (!isEditable(match)) {
    throw new AppError(
      409,
      `Formazione bloccata ${COACH_LINEUP_LOCK_MINUTES} minuti prima del calcio d'inizio`
    );
  }

  const formation = String(input.formation ?? "3-3-1");
  if (!isCoachFormation(formation)) throw new AppError(400, "Modulo non valido");

  if (!Array.isArray(input.players)) throw new AppError(400, "Lista giocatori non valida");

  const rawPlayers = input.players as Array<Record<string, unknown>>;
  if (rawPlayers.length > FUTPOLI_RULES.maxPlayersPerTeam) {
    throw new AppError(
      400,
      `Puoi convocare al massimo ${FUTPOLI_RULES.maxPlayersPerTeam} giocatori`
    );
  }

  const seen = new Set<string>();
  const normalized = rawPlayers.map((row, index) => {
    const playerId = String(row.playerId ?? "");
    const rawStatus = String(row.status ?? "");
    if (!playerId || seen.has(playerId)) {
      throw new AppError(400, "Giocatore duplicato o non valido");
    }
    seen.add(playerId);

    if (rawStatus !== "STARTER" && rawStatus !== "BENCH") {
      throw new AppError(400, "Stato giocatore non valido");
    }
    const status = rawStatus as EntryStatus;

    return {
      playerId,
      status,
      positionX: status === "STARTER" ? clampCoordinate(row.positionX, 4, 96) : null,
      positionY: status === "STARTER" ? clampCoordinate(row.positionY, 5, 95) : null,
      sortOrder: index,
    };
  });

  const starters = normalized.filter((entry) => entry.status === "STARTER");
  if (starters.length > 8) {
    throw new AppError(400, "A calcio a 8 puoi schierare al massimo 8 titolari");
  }

  const validPlayers = await prisma.player.findMany({
    where: {
      id: { in: [...seen] },
      teamId: assignment.teamId,
    },
    select: {
      id: true,
      status: true,
      documentSigned: true,
      mediaConsent: true,
      position: true,
    },
  });

  if (validPlayers.length !== seen.size) {
    throw new AppError(400, "Uno o più giocatori non appartengono alla squadra");
  }

  if (validPlayers.some((player) => !isPlayerEligibleForMatchSheet(player))) {
    throw new AppError(400, "La formazione contiene giocatori non idonei alla distinta");
  }

  const playerById = new Map(validPlayers.map((player) => [player.id, player]));

  const automaticAssignments =
    formation === "MANUAL"
      ? null
      : assignPlayersToFormation(
          starters.map((starter) => ({
            playerId: starter.playerId,
            position: playerById.get(starter.playerId)?.position ?? null,
          })),
          formation as Exclude<CoachFormation, "MANUAL">
        );

  if (formation !== "MANUAL" && !automaticAssignments) {
    throw new AppError(
      400,
      "Il modulo scelto non ha abbastanza slot compatibili con i ruoli dei titolari. Usa Libero per forzare una disposizione fuori ruolo."
    );
  }

  const withPositions = normalized.map((entry, index) => {
    if (entry.status !== "STARTER") return entry;

    const point =
      formation === "MANUAL"
        ? null
        : automaticAssignments?.[entry.playerId] ?? null;

    return {
      ...entry,
      positionX:
        formation === "MANUAL"
          ? entry.positionX ?? 50
          : point?.x ?? 50,
      positionY:
        formation === "MANUAL"
          ? entry.positionY ?? 50
          : point?.y ?? 50,
      sortOrder: index,
    };
  });

  const saved = await prisma.$transaction(async (tx) => {
    const lineup = await tx.matchLineup.upsert({
      where: {
        matchId_teamId: {
          matchId,
          teamId: assignment.teamId,
        },
      },
      create: {
        matchId,
        teamId: assignment.teamId,
        formation,
      },
      update: {
        formation,
      },
    });

    await tx.matchLineupPlayer.deleteMany({
      where: { lineupId: lineup.id },
    });

    if (withPositions.length) {
      await tx.matchLineupPlayer.createMany({
        data: withPositions.map((entry) => ({
          lineupId: lineup.id,
          playerId: entry.playerId,
          status: entry.status,
          positionX: entry.positionX,
          positionY: entry.positionY,
          sortOrder: entry.sortOrder,
        })),
      });
    }

    return tx.matchLineup.findUniqueOrThrow({
      where: { id: lineup.id },
      select: {
        id: true,
        formation: true,
        updatedAt: true,
        players: {
          orderBy: [{ status: "asc" }, { sortOrder: "asc" }],
          select: {
            playerId: true,
            status: true,
            positionX: true,
            positionY: true,
            sortOrder: true,
          },
        },
      },
    });
  });

  await writeAuditLog({
    leagueId,
    actor: session,
    action: "coach.lineup_saved",
    entityType: "match",
    entityId: matchId,
    summary: `Formazione ${assignment.team.name} salvata`,
    metadata: {
      teamId: assignment.teamId,
      formation,
      starters: starters.length,
      bench: normalized.length - starters.length,
    },
  });

  return saved;
}

function normalizeDraftPlayers(value: unknown) {
  if (!Array.isArray(value)) throw new AppError(400, "Giocatori bozza non validi");
  return value.map((raw, index) => {
    const row = raw as Record<string, unknown>;
    const playerId = String(row.playerId ?? "");
    const status = String(row.status ?? "");
    if (!playerId || (status !== "STARTER" && status !== "BENCH")) {
      throw new AppError(400, "Giocatore bozza non valido");
    }
    return {
      playerId,
      status,
      positionX: status === "STARTER" ? clampCoordinate(row.positionX, 4, 96) ?? 50 : null,
      positionY: status === "STARTER" ? clampCoordinate(row.positionY, 5, 95) ?? 50 : null,
      sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : index,
    };
  });
}

export async function saveCoachLineupDraft({ session, leagueId, matchId, input }: {
  session: SessionUser | null; leagueId: string; matchId: string; input: Record<string, unknown>;
}) {
  const { assignment } = await getContext(session, leagueId, matchId);
  const name = String(input.name ?? "").trim().slice(0, 60);
  if (!name) throw new AppError(400, "Dai un nome alla formazione di prova");
  const formation = String(input.formation ?? "3-3-1");
  if (!isCoachFormation(formation)) throw new AppError(400, "Modulo non valido");
  const players = normalizeDraftPlayers(input.players);
  const ids = [...new Set(players.map((player) => player.playerId))];
  if (ids.length !== players.length || players.filter((p) => p.status === "STARTER").length > 8 || players.length > FUTPOLI_RULES.maxPlayersPerTeam) {
    throw new AppError(400, "Bozza non valida");
  }
  const valid = await prisma.player.count({ where: { id: { in: ids }, teamId: assignment.teamId } });
  if (valid !== ids.length) throw new AppError(400, "La bozza contiene giocatori non validi");
  const id = String(input.id ?? "");
  if (id) {
    const existing = await prisma.coachLineupDraft.findFirst({ where: { id, matchId, teamId: assignment.teamId } });
    if (!existing) throw new AppError(404, "Bozza non trovata");
    return prisma.coachLineupDraft.update({ where: { id }, data: { name, formation, players } });
  }
  return prisma.coachLineupDraft.create({ data: { matchId, teamId: assignment.teamId, name, formation, players } });
}

export async function deleteCoachLineupDraft({ session, leagueId, matchId, draftId }: {
  session: SessionUser | null; leagueId: string; matchId: string; draftId: string;
}) {
  const { assignment } = await getContext(session, leagueId, matchId);
  const existing = await prisma.coachLineupDraft.findFirst({ where: { id: draftId, matchId, teamId: assignment.teamId } });
  if (!existing) throw new AppError(404, "Bozza non trovata");
  await prisma.coachLineupDraft.delete({ where: { id: draftId } });
  return { ok: true };
}
