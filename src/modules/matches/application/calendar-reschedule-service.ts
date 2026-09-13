import { prisma } from "@/lib/prisma";
import { AppError } from "@/modules/core/errors";
import {
  getSlotWeekDistance,
  getSlotWeekWindow,
  shiftSlotWeek,
} from "@/modules/fields/domain/field-slots";
import { rebalanceLeagueReferees } from "@/modules/referees/application/rebalance-league-referees";

function parseCalendarDate(value: unknown) {
  const raw = String(value ?? "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);

  if (!match) {
    throw new AppError(400, "Seleziona una data valida per la nuova settimana");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new AppError(400, "Data di ripianificazione non valida");
  }

  return date;
}

export async function rescheduleLeagueSchedule(
  leagueId: string,
  input: Record<string, unknown>
) {
  const fromRound = Number(input?.fromRound ?? 1);

  if (!Number.isInteger(fromRound) || fromRound <= 0) {
    throw new AppError(400, "Giornata di partenza non valida");
  }

  const requestedDate = parseCalendarDate(input?.newStartDate);
  const requestedWeek = getSlotWeekWindow(requestedDate);
  const matches = await prisma.match.findMany({
    where: {
      leagueId,
      seriesId: null,
      round: { gte: fromRound },
    },
    orderBy: [{ round: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      round: true,
      date: true,
      slotWeekStart: true,
      venueKey: true,
      bookedAt: true,
      homeGoals: true,
      awayGoals: true,
      resultStatus: true,
      lifecycleStatus: true,
      refereeId: true,
      refereeManualOverride: true,
      homeSheetConfirmed: true,
      awaySheetConfirmed: true,
    },
  });

  if (matches.length === 0) {
    throw new AppError(404, "Nessuna partita trovata dalla giornata selezionata");
  }

  const firstRoundMatches = matches.filter((match) => match.round === fromRound);
  if (firstRoundMatches.length === 0) {
    throw new AppError(400, `La giornata ${fromRound} non esiste nel calendario`);
  }

  const firstAnchor = firstRoundMatches
    .map((match) => match.slotWeekStart ?? match.date)
    .find((date): date is Date => Boolean(date));

  if (!firstAnchor) {
    throw new AppError(
      409,
      `La giornata ${fromRound} non ha una settimana assegnata. Impostala prima di posticipare il calendario.`
    );
  }

  const currentWeek = getSlotWeekWindow(firstAnchor);
  const shiftWeeks = getSlotWeekDistance(currentWeek.startsAt, requestedWeek.startsAt);

  if (shiftWeeks <= 0) {
    throw new AppError(
      400,
      "La nuova settimana deve essere successiva a quella attualmente assegnata"
    );
  }

  const withoutWeek = matches.filter((match) => !(match.slotWeekStart ?? match.date));
  if (withoutWeek.length > 0) {
    throw new AppError(
      409,
      `Non posso posticipare: ${withoutWeek.length} partite non hanno una settimana assegnata`
    );
  }

  const protectedMatches = matches.filter(
    (match) =>
      match.lifecycleStatus !== "SCHEDULED" ||
      match.resultStatus !== null ||
      match.homeGoals !== null ||
      match.awayGoals !== null
  );

  if (protectedMatches.length > 0) {
    throw new AppError(
      409,
      `Non posso posticipare: ${protectedMatches.length} partite dalla giornata ${fromRound} hanno già risultato o uno stato speciale`
    );
  }

  const matchIds = matches.map((match) => match.id);
  const statsCount = await prisma.matchPlayerStat.count({
    where: { matchId: { in: matchIds } },
  });

  if (statsCount > 0) {
    throw new AppError(
      409,
      `Non posso posticipare: sono già presenti ${statsCount} record di marcatori/assist nelle partite interessate`
    );
  }

  const bookingsReleased = matches.filter(
    (match) => Boolean(match.date || match.venueKey || match.bookedAt)
  ).length;
  const confirmationsReset = matches.filter(
    (match) => match.homeSheetConfirmed || match.awaySheetConfirmed
  ).length;
  const manualRefereesKept = matches.filter(
    (match) => match.refereeManualOverride && match.refereeId
  ).length;
  const affectedRounds = [...new Set(matches.map((match) => match.round))];

  await prisma.$transaction(
    matches.map((match) => {
      const anchor = match.slotWeekStart ?? match.date!;
      const shiftedWeek = shiftSlotWeek(anchor, shiftWeeks);

      return prisma.match.update({
        where: { id: match.id },
        data: {
          slotWeekStart: shiftedWeek.startsAt,
          date: null,
          slotEnd: null,
          venueKey: null,
          venueName: null,
          venueAddress: null,
          bookedByUserId: null,
          bookedAt: null,
          homeSheetConfirmed: false,
          awaySheetConfirmed: false,
          ...(!match.refereeManualOverride ? { refereeId: null } : {}),
        },
      });
    })
  );

  await rebalanceLeagueReferees(leagueId);

  return {
    updated: matches.length,
    fromRound,
    affectedRounds: affectedRounds.length,
    shiftWeeks,
    previousWeekStart: currentWeek.startsAt,
    newWeekStart: requestedWeek.startsAt,
    bookingsReleased,
    confirmationsReset,
    manualRefereesKept,
  };
}
