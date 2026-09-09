import { prisma } from "@/lib/prisma";
import { AppError } from "@/modules/core/errors";
import { getCaptainBookingWindowStatus } from "@/modules/bookings/domain/booking-window";
import {
  findFieldSlot,
  getSlotWeekWindow,
  isWithinSlotWeek,
} from "@/modules/fields/domain/field-slots";
import { rebalanceLeagueReferees } from "@/modules/referees/application/rebalance-league-referees";
import {
  effectiveMatchEnd,
  matchOverlapsWindow,
  refereeAllowsStart,
  refereeHasConflict,
} from "@/modules/referees/domain/referee-availability";
import type { SessionUser } from "@/lib/session";

type RefereeForAssignment = {
  id: string;
  name: string;
  teamId: string | null;
  availabilities: Array<{ weekday: number; hour: number; minute: number }>;
};

type MatchWindowForAssignment = {
  id: string;
  date: Date | null;
  slotEnd: Date | null;
  homeTeamId: string;
  awayTeamId: string;
  refereeId: string | null;
  refereeManualOverride?: boolean;
};

function isPlayed(match: { homeGoals: number | null; awayGoals: number | null }) {
  return match.homeGoals !== null || match.awayGoals !== null;
}

function isCaptain(session: SessionUser) {
  return session.role === "CAPTAIN";
}

function assertCaptainBookingWindow(session: SessionUser, weekAnchor: Date | null) {
  if (!isCaptain(session)) return;
  if (!weekAnchor || !getCaptainBookingWindowStatus(weekAnchor).isOpen) {
    throw new AppError(
      403,
      "Le prenotazioni dei capitani sono aperte solo da mercoledì a sabato della settimana precedente alla partita",
      "BOOKING_WINDOW_CLOSED"
    );
  }
}

function buildBalancedRefereePicker({
  referees,
  otherMatches,
  homeTeamId,
  awayTeamId,
  startsAt,
  endsAt,
  currentRefereeId,
}: {
  referees: RefereeForAssignment[];
  otherMatches: MatchWindowForAssignment[];
  homeTeamId: string;
  awayTeamId: string;
  startsAt: Date;
  endsAt: Date;
  currentRefereeId: string | null;
}) {
  const load = new Map<string, number>();
  for (const other of otherMatches) {
    if (other.refereeId) load.set(other.refereeId, (load.get(other.refereeId) ?? 0) + 1);
  }

  const ordered = [...referees].sort(
    (left, right) =>
      (load.get(left.id) ?? 0) - (load.get(right.id) ?? 0) ||
      left.name.localeCompare(right.name)
  );

  const compatible = (referee: RefereeForAssignment) =>
    referee.teamId !== homeTeamId &&
    referee.teamId !== awayTeamId &&
    refereeAllowsStart(referee.availabilities, startsAt) &&
    !refereeHasConflict({
      refereeId: referee.id,
      teamId: referee.teamId,
      startsAt,
      endsAt,
      otherMatches,
    });

  const current = ordered.find((referee) => referee.id === currentRefereeId && compatible(referee));
  return current ?? ordered.find(compatible) ?? null;
}

async function releaseAffiliatedRefereeAssignments({
  tx,
  matchId,
  referees,
  otherMatches,
  homeTeamId,
  awayTeamId,
  startsAt,
  endsAt,
}: {
  tx: any;
  matchId: string;
  referees: RefereeForAssignment[];
  otherMatches: MatchWindowForAssignment[];
  homeTeamId: string;
  awayTeamId: string;
  startsAt: Date;
  endsAt: Date;
}) {
  const affiliatedRefereeIds = new Set(
    referees
      .filter((referee) => referee.teamId === homeTeamId || referee.teamId === awayTeamId)
      .map((referee) => referee.id)
  );

  const releaseIds = otherMatches
    .filter(
      (other) =>
        !other.refereeManualOverride &&
        Boolean(other.refereeId) &&
        affiliatedRefereeIds.has(other.refereeId!) &&
        matchOverlapsWindow(other, startsAt, endsAt)
    )
    .map((other) => other.id);

  if (releaseIds.length) {
    await tx.match.updateMany({
      where: { id: { in: releaseIds, not: matchId } },
      data: { refereeId: null },
    });
    for (const other of otherMatches) {
      if (releaseIds.includes(other.id)) other.refereeId = null;
    }
  }

  return releaseIds;
}

function assertNoTeamOverlap({
  otherMatches,
  homeTeamId,
  awayTeamId,
  startsAt,
  endsAt,
}: {
  otherMatches: MatchWindowForAssignment[];
  homeTeamId: string;
  awayTeamId: string;
  startsAt: Date;
  endsAt: Date;
}) {
  const conflict = otherMatches.some(
    (other) =>
      (other.homeTeamId === homeTeamId ||
        other.awayTeamId === homeTeamId ||
        other.homeTeamId === awayTeamId ||
        other.awayTeamId === awayTeamId) &&
      matchOverlapsWindow(other, startsAt, endsAt)
  );

  if (conflict) {
    throw new AppError(409, "Una delle due squadre ha già una partita in questo intervallo", "TEAM_CONFLICT");
  }
}

export async function bookMatchSlot({
  matchId,
  venueKey,
  startsAt,
  session,
}: {
  matchId: string;
  venueKey: string;
  startsAt: Date;
  session: SessionUser;
}) {
  if (!venueKey || Number.isNaN(startsAt.getTime())) {
    throw new AppError(400, "Campo o orario non validi", "INVALID_BOOKING_INPUT");
  }

  try {
    const booking = await prisma.$transaction(
      async (tx) => {
        const match = await tx.match.findUnique({
          where: { id: matchId },
          select: {
            id: true,
            leagueId: true,
            homeTeamId: true,
            awayTeamId: true,
            homeGoals: true,
            awayGoals: true,
            date: true,
            slotWeekStart: true,
            refereeId: true,
            refereeManualOverride: true,
          },
        });

        if (!match) throw new AppError(404, "Partita non trovata", "MATCH_NOT_FOUND");
        assertCaptainBookingWindow(session, match.slotWeekStart ?? match.date);
        if (isPlayed(match)) {
          throw new AppError(400, "Non puoi spostare una partita già conclusa", "MATCH_ALREADY_PLAYED");
        }

        const field = await tx.field.findFirst({
          where: {
            id: venueKey,
            leagueId: match.leagueId,
            active: true,
          },
          select: {
            id: true,
            name: true,
            address: true,
            slots: {
              select: {
                id: true,
                weekday: true,
                hour: true,
                minute: true,
                durationMinutes: true,
              },
            },
          },
        });
        if (!field) throw new AppError(409, "Il campo scelto non è più disponibile", "FIELD_NOT_AVAILABLE");

        const slot = findFieldSlot(field, startsAt);
        if (!slot) throw new AppError(400, "Lo slot scelto non fa parte degli orari disponibili", "INVALID_SLOT");
        if (slot.startsAt.getTime() <= Date.now()) {
          throw new AppError(400, "Non puoi prenotare uno slot già iniziato", "SLOT_ALREADY_STARTED");
        }

        const weekAnchor = match.slotWeekStart ?? match.date;
        if (!weekAnchor) {
          throw new AppError(
            409,
            "La partita non ha una settimana assegnata: rigenera il calendario impostando l'inizio della programmazione",
            "MATCH_WEEK_MISSING"
          );
        }
        if (!isWithinSlotWeek(slot.startsAt, weekAnchor)) {
          throw new AppError(
            400,
            "Puoi prenotare soltanto uno slot della settimana assegnata a questa giornata",
            "SLOT_OUTSIDE_MATCH_WEEK"
          );
        }

        const [referees, otherMatches] = await Promise.all([
          tx.referee.findMany({
            where: { leagueId: match.leagueId, active: true },
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              teamId: true,
              availabilities: { select: { weekday: true, hour: true, minute: true } },
            },
          }),
          tx.match.findMany({
            where: { leagueId: match.leagueId, id: { not: matchId }, date: { not: null } },
            select: {
              id: true,
              date: true,
              slotEnd: true,
              homeTeamId: true,
              awayTeamId: true,
              refereeId: true,
              refereeManualOverride: true,
            },
          }),
        ]);

        assertNoTeamOverlap({
          otherMatches,
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
        });

        const releaseIds = await releaseAffiliatedRefereeAssignments({
          tx,
          matchId,
          referees,
          otherMatches,
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
        });

        const assigned = buildBalancedRefereePicker({
          referees,
          otherMatches,
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          currentRefereeId: match.refereeId,
        });

        const assignedRefereeId = match.refereeManualOverride ? match.refereeId : assigned?.id ?? null;

        const updated = await tx.match.update({
          where: { id: matchId },
          data: {
            date: slot.startsAt,
            slotEnd: slot.endsAt,
            venueKey: slot.venueKey,
            venueName: slot.venueName,
            venueAddress: slot.address,
            bookedByUserId: session.userId,
            bookedAt: new Date(),
            refereeId: assignedRefereeId,
          },
          select: {
            id: true,
            leagueId: true,
            date: true,
            slotEnd: true,
            venueKey: true,
            venueName: true,
            venueAddress: true,
            bookedAt: true,
            referee: { select: { id: true } },
          },
        });

        return { ...updated, releasedRefereeAssignments: releaseIds.length };
      },
      { isolationLevel: "Serializable" }
    );

    await rebalanceLeagueReferees(booking.leagueId);
    const refreshed = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        leagueId: true,
        date: true,
        slotEnd: true,
        venueKey: true,
        venueName: true,
        venueAddress: true,
        bookedAt: true,
        referee: { select: { id: true } },
      },
    });

    return refreshed ?? booking;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "P2002" || code === "P2034") {
      throw new AppError(
        409,
        "La disponibilità è cambiata mentre prenotavi: aggiorna gli slot e riprova",
        "BOOKING_CHANGED"
      );
    }
    throw error;
  }
}

export async function clearMatchBooking({
  matchId,
  session,
}: {
  matchId: string;
  session: SessionUser;
}) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      leagueId: true,
      venueKey: true,
      homeGoals: true,
      awayGoals: true,
      refereeManualOverride: true,
      slotWeekStart: true,
      date: true,
    },
  });

  if (!match) throw new AppError(404, "Partita non trovata", "MATCH_NOT_FOUND");
  assertCaptainBookingWindow(session, match.slotWeekStart ?? match.date);

  if (isPlayed(match)) {
    throw new AppError(400, "Non puoi liberare il campo di una partita già conclusa", "MATCH_ALREADY_PLAYED");
  }

  if (!match.venueKey) return { ok: true, leagueId: match.leagueId };

  await prisma.match.update({
    where: { id: matchId },
    data: {
      date: null,
      slotEnd: null,
      venueKey: null,
      venueName: null,
      venueAddress: null,
      bookedByUserId: null,
      bookedAt: null,
      ...(!match.refereeManualOverride ? { refereeId: null } : {}),
    },
  });
  await rebalanceLeagueReferees(match.leagueId);

  return { ok: true, leagueId: match.leagueId };
}

export async function updateMatchDate({
  matchId,
  date,
}: {
  matchId: string;
  date: Date | null;
}) {
  const existing = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      leagueId: true,
      homeTeamId: true,
      awayTeamId: true,
      refereeId: true,
      refereeManualOverride: true,
      homeGoals: true,
      awayGoals: true,
    },
  });

  if (!existing) throw new AppError(404, "Partita non trovata", "MATCH_NOT_FOUND");
  if (isPlayed(existing)) {
    throw new AppError(400, "Non puoi spostare una partita già conclusa", "MATCH_ALREADY_PLAYED");
  }

  if (!date) {
    await prisma.match.update({
      where: { id: matchId },
      data: {
        date: null,
        slotEnd: null,
        venueKey: null,
        venueName: null,
        venueAddress: null,
        bookedByUserId: null,
        bookedAt: null,
        ...(!existing.refereeManualOverride ? { refereeId: null } : {}),
      },
    });
    await rebalanceLeagueReferees(existing.leagueId);
    return { leagueId: existing.leagueId, referee: null };
  }

  const startsAt = date;
  const endsAt = effectiveMatchEnd(startsAt, null);

  const result = await prisma.$transaction(async (tx) => {
    const [referees, otherMatches] = await Promise.all([
      tx.referee.findMany({
        where: { leagueId: existing.leagueId, active: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          teamId: true,
          availabilities: { select: { weekday: true, hour: true, minute: true } },
        },
      }),
      tx.match.findMany({
        where: { leagueId: existing.leagueId, id: { not: matchId }, date: { not: null } },
        select: {
          id: true,
          date: true,
          slotEnd: true,
          homeTeamId: true,
          awayTeamId: true,
          refereeId: true,
          refereeManualOverride: true,
        },
      }),
    ]);

    assertNoTeamOverlap({
      otherMatches,
      homeTeamId: existing.homeTeamId,
      awayTeamId: existing.awayTeamId,
      startsAt,
      endsAt,
    });

    const releaseIds = await releaseAffiliatedRefereeAssignments({
      tx,
      matchId,
      referees,
      otherMatches,
      homeTeamId: existing.homeTeamId,
      awayTeamId: existing.awayTeamId,
      startsAt,
      endsAt,
    });

    const assigned = buildBalancedRefereePicker({
      referees,
      otherMatches,
      homeTeamId: existing.homeTeamId,
      awayTeamId: existing.awayTeamId,
      startsAt,
      endsAt,
      currentRefereeId: existing.refereeId,
    });

    const assignedRefereeId = existing.refereeManualOverride ? existing.refereeId : assigned?.id ?? null;
    const updated = await tx.match.update({
      where: { id: matchId },
      data: {
        date: startsAt,
        slotEnd: endsAt,
        venueKey: null,
        venueName: null,
        venueAddress: null,
        bookedByUserId: null,
        bookedAt: null,
        slotWeekStart: getSlotWeekWindow(startsAt).startsAt,
        refereeId: assignedRefereeId,
      },
      select: { referee: { select: { id: true } } },
    });

    return { leagueId: existing.leagueId, referee: updated.referee, releasedRefereeAssignments: releaseIds.length };
  });

  await rebalanceLeagueReferees(existing.leagueId);
  const refreshed = await prisma.match.findUnique({
    where: { id: matchId },
    select: { referee: { select: { id: true } } },
  });

  return { ...result, leagueId: existing.leagueId, referee: refreshed?.referee ?? null };
}
