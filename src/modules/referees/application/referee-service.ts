import { prisma } from "@/lib/prisma";
import { rebalanceLeagueReferees } from "@/modules/referees/application/rebalance-league-referees";
import { generateTemporaryPassword, slugifyUsername } from "@/lib/credentials";
import {
  effectiveMatchEnd,
  refereeAllowsStart,
  refereeHasConflict,
} from "@/modules/referees/domain/referee-availability";
import { hashPassword } from "@/lib/session";
import { AppError } from "@/modules/core/errors";

type AvailabilityInput = { weekday: number; hour: number; minute: number };

function normalizeAvailability(value: unknown): AvailabilityInput[] | null {
  if (!Array.isArray(value)) return null;
  const normalized: AvailabilityInput[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const raw = item as Record<string, unknown>;
    const weekday = Number(raw.weekday);
    const hour = Number(raw.hour);
    const minute = Number(raw.minute);
    if (
      !Number.isInteger(weekday) ||
      weekday < 0 ||
      weekday > 6 ||
      !Number.isInteger(hour) ||
      hour < 0 ||
      hour > 23 ||
      !Number.isInteger(minute) ||
      minute < 0 ||
      minute > 59
    ) {
      return null;
    }
    const key = `${weekday}:${hour}:${minute}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({ weekday, hour, minute });
  }
  return normalized;
}

const availabilitySelect = { id: true, weekday: true, hour: true, minute: true };

export async function listLeagueReferees({
  leagueId,
  matchId,
}: {
  leagueId: string;
  matchId: string | null;
}) {
  const referees = await prisma.referee.findMany({
    where: { leagueId, ...(matchId ? { active: true } : {}) },
    select: {
      id: true,
      name: true,
      active: true,
      teamId: true,
      team: { select: { id: true, name: true } },
      availabilities: {
        select: availabilitySelect,
        orderBy: [{ weekday: "asc" }, { hour: "asc" }, { minute: "asc" }],
      },
      account: { select: { id: true, username: true } },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  if (!matchId) return referees;

  const match = await prisma.match.findFirst({
    where: { id: matchId, leagueId },
    select: {
      id: true,
      date: true,
      slotEnd: true,
      homeTeamId: true,
      awayTeamId: true,
    },
  });
  if (!match) throw new AppError(404, "Partita non trovata");

  const teamCompatible = referees.filter(
    (referee) =>
      referee.teamId !== match.homeTeamId && referee.teamId !== match.awayTeamId
  );
  if (!match.date) return teamCompatible;

  const startsAt = match.date;
  const endsAt = effectiveMatchEnd(startsAt, match.slotEnd);
  const otherMatches = await prisma.match.findMany({
    where: { leagueId, id: { not: match.id }, date: { not: null } },
    select: {
      id: true,
      date: true,
      slotEnd: true,
      homeTeamId: true,
      awayTeamId: true,
      refereeId: true,
    },
  });

  return teamCompatible.filter(
    (referee) =>
      refereeAllowsStart(referee.availabilities, startsAt) &&
      !refereeHasConflict({
        refereeId: referee.id,
        teamId: referee.teamId,
        startsAt,
        endsAt,
        otherMatches,
      })
  );
}

async function assertValidTeam(leagueId: string, teamId: string | null | undefined) {
  if (!teamId) return;
  const team = await prisma.team.findFirst({
    where: { id: teamId, leagueId, activeInLeague: true },
    select: { id: true },
  });
  if (!team) throw new AppError(400, "Squadra di appartenenza non valida");
}

export async function createReferee({
  leagueId,
  input,
}: {
  leagueId: string;
  input: Record<string, unknown>;
}) {
  const firstName = String(input.firstName ?? "").trim().replace(/\s+/g, " ");
  const lastName = String(input.lastName ?? "").trim().replace(/\s+/g, " ");
  const name = `${firstName} ${lastName}`.trim();
  const teamId = input.teamId ? String(input.teamId).trim() : null;

  if (!firstName || !lastName) {
    throw new AppError(400, "Inserisci nome e cognome dell'arbitro");
  }
  await assertValidTeam(leagueId, teamId);

  try {
    const referee = await prisma.referee.create({
      data: { leagueId, name, teamId },
      select: {
        id: true,
        name: true,
        active: true,
        teamId: true,
        team: { select: { id: true, name: true } },
        availabilities: { select: availabilitySelect },
      },
    });
    await rebalanceLeagueReferees(leagueId);
    return referee;
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new AppError(409, "Questo arbitro è già presente nell'elenco");
    }
    throw error;
  }
}

export async function updateReferee({
  leagueId,
  input,
}: {
  leagueId: string;
  input: Record<string, unknown>;
}) {
  const id = String(input.id ?? "").trim();
  if (!id) throw new AppError(400, "Arbitro mancante");

  const referee = await prisma.referee.findFirst({
    where: { id, leagueId },
    select: { id: true },
  });
  if (!referee) throw new AppError(404, "Arbitro non trovato");

  const name =
    input.name === undefined
      ? undefined
      : String(input.name).trim().replace(/\s+/g, " ");
  const active = input.active === undefined ? undefined : Boolean(input.active);
  const teamId =
    input.teamId === undefined
      ? undefined
      : input.teamId
        ? String(input.teamId).trim()
        : null;
  const availability =
    input.availability === undefined
      ? undefined
      : normalizeAvailability(input.availability);

  if (name !== undefined && name.length < 3) {
    throw new AppError(400, "Inserisci nome e cognome dell'arbitro");
  }
  if (input.availability !== undefined && availability === null) {
    throw new AppError(
      400,
      "Una o più disponibilità dell'arbitro non sono valide"
    );
  }
  await assertValidTeam(leagueId, teamId);

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.referee.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(active !== undefined ? { active } : {}),
          ...(teamId !== undefined ? { teamId } : {}),
        },
      });

      if (availability !== undefined && availability !== null) {
        await tx.refereeAvailability.deleteMany({ where: { refereeId: id } });
        if (availability.length > 0) {
          await tx.refereeAvailability.createMany({
            data: availability.map((slot) => ({ refereeId: id, ...slot })),
          });
        }
      }

      const updated = await tx.referee.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          name: true,
          active: true,
          teamId: true,
          team: { select: { id: true, name: true } },
          availabilities: {
            select: availabilitySelect,
            orderBy: [{ weekday: "asc" }, { hour: "asc" }, { minute: "asc" }],
          },
          account: { select: { id: true, username: true } },
        },
      });

      const assignedMatches = await tx.match.findMany({
        where: {
          leagueId,
          refereeId: id,
          refereeManualOverride: false,
          homeGoals: null,
          awayGoals: null,
        },
        orderBy: [{ date: "asc" }, { round: "asc" }],
        select: {
          id: true,
          date: true,
          slotEnd: true,
          homeTeamId: true,
          awayTeamId: true,
          refereeId: true,
        },
      });
      const invalidIds: string[] = [];

      if (!updated.active) {
        invalidIds.push(...assignedMatches.map((match) => match.id));
      } else {
        const assignedIds = assignedMatches.map((match) => match.id);
        const otherMatches = await tx.match.findMany({
          where: {
            leagueId,
            date: { not: null },
            ...(assignedIds.length ? { id: { notIn: assignedIds } } : {}),
          },
          select: {
            id: true,
            date: true,
            slotEnd: true,
            homeTeamId: true,
            awayTeamId: true,
            refereeId: true,
          },
        });
        const acceptedAssigned: typeof otherMatches = [];

        for (const match of assignedMatches) {
          const playsThisMatch =
            Boolean(updated.teamId) &&
            (updated.teamId === match.homeTeamId || updated.teamId === match.awayTeamId);
          if (playsThisMatch) {
            invalidIds.push(match.id);
            continue;
          }
          if (!match.date) {
            acceptedAssigned.push(match);
            continue;
          }
          const startsAt = match.date;
          const endsAt = effectiveMatchEnd(startsAt, match.slotEnd);
          const invalidTime = !refereeAllowsStart(updated.availabilities, startsAt);
          const conflict = refereeHasConflict({
            refereeId: updated.id,
            teamId: updated.teamId,
            startsAt,
            endsAt,
            otherMatches: [...otherMatches, ...acceptedAssigned],
          });
          if (invalidTime || conflict) invalidIds.push(match.id);
          else acceptedAssigned.push(match);
        }
      }

      if (invalidIds.length > 0) {
        await tx.match.updateMany({
          where: { id: { in: invalidIds } },
          data: { refereeId: null },
        });
      }
      return { updated, releasedAssignments: invalidIds.length };
    });

    const automatic = await rebalanceLeagueReferees(leagueId);
    return {
      ...result.updated,
      releasedAssignments: result.releasedAssignments,
      automatic,
    };
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new AppError(
        409,
        "Esiste già un arbitro con questo nome o una disponibilità duplicata"
      );
    }
    throw error;
  }
}

export async function deleteReferee({
  leagueId,
  refereeId,
}: {
  leagueId: string;
  refereeId: string;
}) {
  if (!refereeId) throw new AppError(400, "Arbitro mancante");
  const referee = await prisma.referee.findFirst({
    where: { id: refereeId, leagueId },
    select: { id: true },
  });
  if (!referee) throw new AppError(404, "Arbitro non trovato");

  const completedMatches = await prisma.match.count({
    where: {
      leagueId,
      refereeId,
      OR: [{ homeGoals: { not: null } }, { awayGoals: { not: null } }],
    },
  });
  if (completedMatches > 0) {
    throw new AppError(
      409,
      "Questo arbitro compare in partite già concluse. Per conservare lo storico puoi disattivarlo, ma non eliminarlo."
    );
  }

  const releasedAssignments = await prisma.$transaction(async (tx) => {
    const released = await tx.match.updateMany({
      where: { leagueId, refereeId },
      data: { refereeId: null },
    });
    await tx.user.deleteMany({ where: { refereeId } });
    await tx.referee.delete({ where: { id: refereeId } });
    return released.count;
  });
  const automatic = await rebalanceLeagueReferees(leagueId);
  return { ok: true, releasedAssignments, automatic };
}

export async function createRefereeCredentials({
  leagueId,
  refereeId,
}: {
  leagueId: string;
  refereeId: string;
}) {
  const referee = await prisma.referee.findFirst({
    where: { id: refereeId, leagueId },
    select: {
      id: true,
      name: true,
      account: { select: { username: true } },
    },
  });
  if (!referee) throw new AppError(404, "Arbitro non trovato");
  if (referee.account) {
    throw new AppError(409, `L'arbitro ha già l'account ${referee.account.username}`);
  }

  const base = `arbitro.${slugifyUsername(referee.name) || referee.id.slice(0, 8)}`;
  let username = base;
  let suffix = 2;
  while (await prisma.user.findUnique({ where: { username } })) {
    username = `${base}.${suffix++}`;
  }

  const password = generateTemporaryPassword();
  const account = await prisma.user.create({
    data: {
      username,
      passwordHash: hashPassword(password),
      role: "REFEREE",
      refereeId: referee.id,
    },
    select: { id: true, username: true },
  });

  return { account, password, passwordShownOnce: true };
}