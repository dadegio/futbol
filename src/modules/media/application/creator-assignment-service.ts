import { prisma } from "@/lib/prisma";
import { AppError } from "@/modules/core/errors";
import {
  findCreatorAssignmentConflicts,
  normalizeCreatorIds,
} from "@/modules/media/domain/creator-assignment";

export async function getCreatorAssignmentBoard(leagueId: string) {
  const [creators, teams, matches] = await Promise.all([
    prisma.creatorProfile.findMany({
      where: { leagueId },
      orderBy: [{ active: "desc" }, { displayName: "asc" }],
      select: {
        id: true,
        displayName: true,
        roleLabel: true,
        avatarUrl: true,
        active: true,
        preferredTeamId: true,
        preferredTeam: {
          select: { id: true, name: true, badgeUrl: true },
        },
      },
    }),
    prisma.team.findMany({
      where: { leagueId, activeInLeague: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, badgeUrl: true },
    }),
    prisma.match.findMany({
      where: { leagueId },
      orderBy: [{ round: "asc" }, { date: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        round: true,
        date: true,
        slotEnd: true,
        slotWeekStart: true,
        lifecycleStatus: true,
        homeTeam: { select: { id: true, name: true, badgeUrl: true } },
        awayTeam: { select: { id: true, name: true, badgeUrl: true } },
        creatorAssignments: {
          select: { creatorId: true },
        },
      },
    }),
  ]);

  return { creators, teams, matches };
}

export async function updateCreatorPreference({
  leagueId,
  creatorId,
  preferredTeamId,
}: {
  leagueId: string;
  creatorId: string;
  preferredTeamId: string | null;
}) {
  const creator = await prisma.creatorProfile.findFirst({
    where: { id: creatorId, leagueId },
    select: { id: true },
  });
  if (!creator) throw new AppError(404, "Creator non trovato in questo torneo");

  if (preferredTeamId) {
    const team = await prisma.team.findFirst({
      where: { id: preferredTeamId, leagueId, activeInLeague: true },
      select: { id: true },
    });
    if (!team) {
      throw new AppError(400, "La squadra preferita non appartiene al torneo attivo");
    }
  }

  return prisma.creatorProfile.update({
    where: { id: creatorId },
    data: { preferredTeamId },
    select: {
      id: true,
      displayName: true,
      preferredTeamId: true,
      preferredTeam: { select: { id: true, name: true, badgeUrl: true } },
    },
  });
}

type RoundAssignmentInput = {
  matchId: string;
  creatorIds: string[];
};

export async function replaceRoundCreatorAssignments({
  leagueId,
  round,
  assignments,
}: {
  leagueId: string;
  round: number;
  assignments: RoundAssignmentInput[];
}) {
  if (!Number.isInteger(round) || round < 1) {
    throw new AppError(400, "Giornata non valida");
  }

  const matches = await prisma.match.findMany({
    where: { leagueId, round },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      date: true,
      slotEnd: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  });

  if (matches.length === 0) {
    throw new AppError(404, `Nessuna partita trovata nella giornata ${round}`);
  }

  const expectedIds = new Set(matches.map((match) => match.id));
  const receivedIds = new Set(assignments.map((assignment) => assignment.matchId));
  if (
    assignments.length !== matches.length ||
    receivedIds.size !== matches.length ||
    [...receivedIds].some((matchId) => !expectedIds.has(matchId))
  ) {
    throw new AppError(
      400,
      "Invia l'assegnazione completa di tutte le partite della giornata"
    );
  }

  const normalizedAssignments = assignments.map((assignment) => ({
    matchId: assignment.matchId,
    creatorIds: normalizeCreatorIds(assignment.creatorIds),
  }));

  const requestedCreatorIds = Array.from(
    new Set(normalizedAssignments.flatMap((assignment) => assignment.creatorIds))
  );

  const creators = requestedCreatorIds.length
    ? await prisma.creatorProfile.findMany({
        where: {
          leagueId,
          active: true,
          id: { in: requestedCreatorIds },
        },
        select: { id: true, displayName: true },
      })
    : [];

  if (creators.length !== requestedCreatorIds.length) {
    throw new AppError(
      400,
      "Uno o più creator selezionati non sono attivi in questo torneo"
    );
  }

  const assignmentByMatch = new Map(
    normalizedAssignments.map((assignment) => [assignment.matchId, assignment.creatorIds])
  );

  const otherAssignedMatches = requestedCreatorIds.length
    ? await prisma.match.findMany({
        where: {
          leagueId,
          round: { not: round },
          creatorAssignments: {
            some: { creatorId: { in: requestedCreatorIds } },
          },
        },
        select: {
          id: true,
          date: true,
          slotEnd: true,
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } },
          creatorAssignments: {
            where: { creatorId: { in: requestedCreatorIds } },
            select: { creatorId: true },
          },
        },
      })
    : [];

  const currentRoundIds = new Set(matches.map((match) => match.id));
  const conflictCandidates = [
    ...matches.map((match) => ({
      matchId: match.id,
      startsAt: match.date,
      endsAt: match.slotEnd,
      creatorIds: assignmentByMatch.get(match.id) ?? [],
    })),
    ...otherAssignedMatches.map((match) => ({
      matchId: match.id,
      startsAt: match.date,
      endsAt: match.slotEnd,
      creatorIds: match.creatorAssignments.map((assignment) => assignment.creatorId),
    })),
  ];
  const conflicts = findCreatorAssignmentConflicts(conflictCandidates).filter(
    (conflict) =>
      currentRoundIds.has(conflict.firstMatchId) ||
      currentRoundIds.has(conflict.secondMatchId)
  );

  if (conflicts.length > 0) {
    const conflict = conflicts[0];
    const creatorName =
      creators.find((creator) => creator.id === conflict.creatorId)?.displayName ??
      "Il creator";
    const allMatches = [...matches, ...otherAssignedMatches];
    const firstMatch = allMatches.find((match) => match.id === conflict.firstMatchId);
    const secondMatch = allMatches.find((match) => match.id === conflict.secondMatchId);
    const firstLabel = firstMatch
      ? `${firstMatch.homeTeam.name} - ${firstMatch.awayTeam.name}`
      : "prima partita";
    const secondLabel = secondMatch
      ? `${secondMatch.homeTeam.name} - ${secondMatch.awayTeam.name}`
      : "seconda partita";
    throw new AppError(
      409,
      `${creatorName} risulta assegnato a due partite sovrapposte: ${firstLabel} e ${secondLabel}`
    );
  }

  const matchIds = matches.map((match) => match.id);
  const rows = normalizedAssignments.flatMap((assignment) =>
    assignment.creatorIds.map((creatorId) => ({
      creatorId,
      matchId: assignment.matchId,
    }))
  );

  await prisma.$transaction(async (tx) => {
    await tx.creatorMatchAssignment.deleteMany({
      where: { matchId: { in: matchIds } },
    });
    if (rows.length > 0) {
      await tx.creatorMatchAssignment.createMany({
        data: rows,
        skipDuplicates: true,
      });
    }
  });

  return {
    round,
    matches: matches.length,
    assignments: rows.length,
  };
}
