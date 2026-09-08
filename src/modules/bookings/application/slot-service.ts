import { prisma } from "@/lib/prisma";
import { getCaptainBookingWindowStatus } from "@/lib/booking-window";
import { getFieldSlotOccurrences, getSlotWeekWindow } from "@/lib/field-slots";
import { AppError } from "@/modules/core/api";

export async function getLeagueMatchSlots({
  leagueId,
  matchId,
  adminBypass,
}: {
  leagueId: string;
  matchId: string | null;
  adminBypass: boolean;
}) {
  if (!matchId) {
    throw new AppError(
      400,
      "Specifica la partita per vedere gli slot della sua settimana"
    );
  }

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true },
  });
  if (!league) throw new AppError(404, "Torneo non trovato");

  const currentMatch = await prisma.match.findFirst({
    where: { id: matchId, leagueId },
    select: {
      id: true,
      round: true,
      date: true,
      slotEnd: true,
      slotWeekStart: true,
      venueKey: true,
      venueName: true,
      venueAddress: true,
    },
  });
  if (!currentMatch) throw new AppError(404, "Partita non trovata");

  const weekAnchor = currentMatch.slotWeekStart ?? currentMatch.date;
  if (!weekAnchor) {
    throw new AppError(
      409,
      "Questa partita non ha ancora una settimana assegnata. Rigenera il calendario impostando l'inizio della programmazione."
    );
  }

  const matchWeek = getSlotWeekWindow(weekAnchor);
  const bookingWindowStatus = getCaptainBookingWindowStatus(weekAnchor);
  const bookingWindow = {
    opensAt: bookingWindowStatus.opensAt,
    closesAt: bookingWindowStatus.closesAt,
    isOpen: adminBypass || bookingWindowStatus.isOpen,
    adminBypass,
  };

  const fields = await prisma.field.findMany({
    where: { leagueId, active: true },
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
    orderBy: { name: "asc" },
  });
  const occurrences = getFieldSlotOccurrences({
    from: matchWeek.startsAt,
    weeks: 1,
    fields,
  }).filter((slot) => slot.startsAt.getTime() < matchWeek.endsAt.getTime());

  const occupiedMatches = await prisma.match.findMany({
    where: {
      venueKey: { not: null },
      date: { gte: matchWeek.startsAt, lt: matchWeek.endsAt },
    },
    select: { id: true, leagueId: true, date: true, venueKey: true },
  });
  const occupiedBySlot = new Map(
    occupiedMatches
      .filter((match) => match.date && match.venueKey)
      .map((match) => [`${match.venueKey}:${match.date!.toISOString()}`, match])
  );

  const slots = occurrences.map((slot) => {
    const occupied = occupiedBySlot.get(
      `${slot.venueKey}:${slot.startsAt.toISOString()}`
    );
    const isCurrentMatch = occupied?.id === matchId;
    return {
      key: slot.key,
      venueKey: slot.venueKey,
      venueName: slot.venueName,
      address: slot.address,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      available: !occupied || isCurrentMatch,
      isCurrentMatch,
      occupiedByLeague: occupied?.leagueId ?? null,
    };
  });

  return {
    timeZone: "Europe/Rome",
    bookingWindow,
    fields,
    matchWeek: {
      round: currentMatch.round,
      startsAt: matchWeek.startsAt,
      endsAt: matchWeek.endsAt,
    },
    currentBooking:
      currentMatch.date && currentMatch.venueKey
        ? {
            startsAt: currentMatch.date,
            endsAt: currentMatch.slotEnd,
            venueKey: currentMatch.venueKey,
            venueName: currentMatch.venueName,
            address: currentMatch.venueAddress,
          }
        : null,
    slots,
  };
}