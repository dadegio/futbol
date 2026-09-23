import { prisma } from "@/lib/prisma";

function dayKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export async function getRefereeSchedule(refereeId: string, leagueId: string) {
  const matches = await prisma.match.findMany({
    where: { refereeId, leagueId },
    orderBy: [{ date: "asc" }, { round: "asc" }],
    take: 200,
    select: {
      id: true,
      round: true,
      date: true,
      venueName: true,
      venueAddress: true,
      lifecycleStatus: true,
      resultStatus: true,
      homeGoals: true,
      awayGoals: true,
      homeSheetConfirmed: true,
      awaySheetConfirmed: true,
      homeTeam: { select: { id: true, name: true, badgeUrl: true, colorHex: true, secondaryColorHex: true } },
      awayTeam: { select: { id: true, name: true, badgeUrl: true, colorHex: true, secondaryColorHex: true } },
    },
  });

  const now = new Date();
  const today = dayKey(now);
  const normalized = matches.map((match) => {
    const timestamp = match.date?.getTime() ?? null;
    const isToday = match.date ? dayKey(match.date) === today : false;
    const isFinal = match.resultStatus === "FINAL";
    const isFuture = timestamp !== null && timestamp > now.getTime() && !isToday;
    const needsAction =
      !isFinal &&
      match.lifecycleStatus !== "CANCELLED" &&
      (isToday || (timestamp !== null && timestamp <= now.getTime()));
    return { ...match, isToday, isFinal, isFuture, needsAction };
  });

  const upcoming = normalized.filter(
    (match) =>
      !match.isFinal &&
      match.lifecycleStatus !== "CANCELLED" &&
      (match.isToday || match.isFuture)
  );
  const pending = normalized.filter((match) => match.needsAction);
  const completed = normalized
    .filter((match) => match.isFinal)
    .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
  const nextMatch = upcoming[0] ?? null;

  return {
    matches: normalized,
    upcoming,
    pending,
    completed,
    nextMatch,
    summary: {
      upcoming: upcoming.length,
      pending: pending.length,
      completed: completed.length,
      today: normalized.filter((match) => match.isToday).length,
    },
  };
}

export async function getRefereeMatchday(refereeId: string, leagueId: string) {
  const schedule = await getRefereeSchedule(refereeId, leagueId);
  return [
    ...schedule.pending,
    ...schedule.upcoming.filter((match) => !match.needsAction),
  ].slice(0, 12);
}
