import { prisma } from "@/lib/prisma";
import { AppError } from "@/modules/core/errors";
import { findCreatorAssignmentConflicts } from "@/modules/media/domain/creator-assignment";
import type {
  CreatorAssignmentRole,
  CreatorCoverageRole,
} from "@/modules/media/domain/creator-assignment";

const COVERAGE_ROLES = new Set<CreatorCoverageRole>(["PHOTO", "VIDEO", "BOTH"]);

function normalizeCreatorId(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function creatorCanCoverRole(
  coverageRole: CreatorCoverageRole,
  assignmentRole: CreatorAssignmentRole
) {
  return coverageRole === "BOTH" || coverageRole === assignmentRole;
}

export async function getCreatorAssignmentBoard(leagueId: string) {
  const [league, creators, teams, matches] = await Promise.all([
    prisma.league.findUnique({
      where: { id: leagueId },
      select: { id: true, veoTeamId: true },
    }),
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
        coverageRole: true,
        weeklyAssignmentLimit: true,
        preferredTeam: {
          select: { id: true, name: true, badgeUrl: true },
        },
        _count: { select: { matchAssignments: true } },
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
          select: { creatorId: true, role: true },
        },
      },
    }),
  ]);

  if (!league) throw new AppError(404, "Torneo non trovato");
  return { veoTeamId: league.veoTeamId, creators, teams, matches };
}

export async function updateCreatorAssignmentSettings({
  leagueId,
  creatorId,
  preferredTeamId,
  coverageRole,
  weeklyAssignmentLimit,
}: {
  leagueId: string;
  creatorId: string;
  preferredTeamId?: string | null;
  coverageRole?: CreatorCoverageRole;
  weeklyAssignmentLimit?: number;
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

  if (coverageRole !== undefined && !COVERAGE_ROLES.has(coverageRole)) {
    throw new AppError(400, "Ruolo copertura creator non valido");
  }
  if (
    weeklyAssignmentLimit !== undefined &&
    (!Number.isInteger(weeklyAssignmentLimit) ||
      weeklyAssignmentLimit < 1 ||
      weeklyAssignmentLimit > 7)
  ) {
    throw new AppError(400, "Il limite settimanale deve essere compreso tra 1 e 7");
  }

  return prisma.creatorProfile.update({
    where: { id: creatorId },
    data: {
      ...(preferredTeamId !== undefined ? { preferredTeamId } : {}),
      ...(coverageRole !== undefined ? { coverageRole } : {}),
      ...(weeklyAssignmentLimit !== undefined ? { weeklyAssignmentLimit } : {}),
    },
    select: {
      id: true,
      displayName: true,
      preferredTeamId: true,
      coverageRole: true,
      weeklyAssignmentLimit: true,
      preferredTeam: { select: { id: true, name: true, badgeUrl: true } },
    },
  });
}

export async function updateLeagueVeoTeam({
  leagueId,
  veoTeamId,
}: {
  leagueId: string;
  veoTeamId: string | null;
}) {
  if (veoTeamId) {
    const team = await prisma.team.findFirst({
      where: { id: veoTeamId, leagueId, activeInLeague: true },
      select: { id: true },
    });
    if (!team) throw new AppError(400, "La squadra VEO non appartiene al torneo attivo");
  }

  return prisma.league.update({
    where: { id: leagueId },
    data: { veoTeamId },
    select: { id: true, veoTeamId: true },
  });
}

type RoundAssignmentInput = {
  matchId: string;
  photoCreatorId: string | null;
  videoCreatorId: string | null;
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

  const [league, matches] = await Promise.all([
    prisma.league.findUnique({
      where: { id: leagueId },
      select: { veoTeamId: true },
    }),
    prisma.match.findMany({
      where: { leagueId, round },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        date: true,
        slotEnd: true,
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
      },
    }),
  ]);

  if (!league) throw new AppError(404, "Torneo non trovato");
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
    photoCreatorId: normalizeCreatorId(assignment.photoCreatorId),
    videoCreatorId: normalizeCreatorId(assignment.videoCreatorId),
  }));

  for (const assignment of normalizedAssignments) {
    if (
      assignment.photoCreatorId &&
      assignment.videoCreatorId &&
      assignment.photoCreatorId === assignment.videoCreatorId
    ) {
      throw new AppError(
        400,
        "Fotografo e videomaker devono essere due persone diverse sulla stessa partita"
      );
    }
  }

  const requestedCreatorIds = Array.from(
    new Set(
      normalizedAssignments.flatMap((assignment) =>
        [assignment.photoCreatorId, assignment.videoCreatorId].filter(
          (value): value is string => Boolean(value)
        )
      )
    )
  );

  const creators = requestedCreatorIds.length
    ? await prisma.creatorProfile.findMany({
        where: { leagueId, active: true, id: { in: requestedCreatorIds } },
        select: {
          id: true,
          displayName: true,
          coverageRole: true,
          weeklyAssignmentLimit: true,
        },
      })
    : [];

  if (creators.length !== requestedCreatorIds.length) {
    throw new AppError(
      400,
      "Uno o più creator selezionati non sono attivi in questo torneo"
    );
  }

  const creatorById = new Map(creators.map((creator) => [creator.id, creator]));
  const usage = new Map<string, number>();
  for (const assignment of normalizedAssignments) {
    const pairs: Array<[CreatorAssignmentRole, string | null]> = [
      ["PHOTO", assignment.photoCreatorId],
      ["VIDEO", assignment.videoCreatorId],
    ];
    for (const [role, creatorId] of pairs) {
      if (!creatorId) continue;
      const creator = creatorById.get(creatorId)!;
      if (!creatorCanCoverRole(creator.coverageRole, role)) {
        throw new AppError(
          400,
          `${creator.displayName} non è configurato per il ruolo ${role === "PHOTO" ? "foto" : "video"}`
        );
      }
      usage.set(creatorId, (usage.get(creatorId) ?? 0) + 1);
    }
  }

  for (const creator of creators) {
    const used = usage.get(creator.id) ?? 0;
    if (used > creator.weeklyAssignmentLimit) {
      throw new AppError(
        409,
        `${creator.displayName} supera il limite settimanale: ${used}/${creator.weeklyAssignmentLimit} partite`
      );
    }
  }

  const assignmentByMatch = new Map(
    normalizedAssignments.map((assignment) => [
      assignment.matchId,
      [assignment.photoCreatorId, assignment.videoCreatorId].filter(
        (value): value is string => Boolean(value)
      ),
    ])
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
  const conflicts = findCreatorAssignmentConflicts([
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
  ]).filter(
    (conflict) =>
      currentRoundIds.has(conflict.firstMatchId) ||
      currentRoundIds.has(conflict.secondMatchId)
  );

  if (conflicts.length > 0) {
    const conflict = conflicts[0];
    const creatorName =
      creatorById.get(conflict.creatorId)?.displayName ?? "Il creator";
    const allMatches = [...matches, ...otherAssignedMatches];
    const firstMatch = allMatches.find((match) => match.id === conflict.firstMatchId);
    const secondMatch = allMatches.find((match) => match.id === conflict.secondMatchId);
    throw new AppError(
      409,
      `${creatorName} risulta assegnato a due partite sovrapposte: ${firstMatch ? `${firstMatch.homeTeam.name} - ${firstMatch.awayTeam.name}` : "prima partita"} e ${secondMatch ? `${secondMatch.homeTeam.name} - ${secondMatch.awayTeam.name}` : "seconda partita"}`
    );
  }

  const matchIds = matches.map((match) => match.id);
  const rows = normalizedAssignments.flatMap((assignment) => [
    ...(assignment.photoCreatorId
      ? [{ creatorId: assignment.photoCreatorId, matchId: assignment.matchId, role: "PHOTO" as const }]
      : []),
    ...(assignment.videoCreatorId
      ? [{ creatorId: assignment.videoCreatorId, matchId: assignment.matchId, role: "VIDEO" as const }]
      : []),
  ]);

  await prisma.$transaction(async (tx) => {
    await tx.creatorMatchAssignment.deleteMany({
      where: { matchId: { in: matchIds } },
    });
    if (rows.length > 0) {
      await tx.creatorMatchAssignment.createMany({ data: rows });
    }
  });

  const matchById = new Map(matches.map((match) => [match.id, match]));
  const isVeoMatch = (matchId: string) => {
    const match = matchById.get(matchId);
    return Boolean(
      match &&
        league.veoTeamId &&
        (match.homeTeam.id === league.veoTeamId || match.awayTeam.id === league.veoTeamId)
    );
  };
  const photoAssignments = normalizedAssignments.filter(
    (assignment) => assignment.photoCreatorId
  ).length;
  const requiredVideoMatches = normalizedAssignments.filter(
    (assignment) => !isVeoMatch(assignment.matchId)
  );
  const videoAssignments = requiredVideoMatches.filter(
    (assignment) => assignment.videoCreatorId
  ).length;

  return {
    round,
    matches: matches.length,
    assignments: rows.length,
    photoAssignments,
    videoAssignments,
    veoMatches: normalizedAssignments.length - requiredVideoMatches.length,
    missingPhoto: matches.length - photoAssignments,
    missingVideo: requiredVideoMatches.length - videoAssignments,
  };
}
