import { prisma } from "@/lib/prisma";

function dayKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export async function getRefereeMatchday(refereeId: string, leagueId: string) {
  const matches = await prisma.match.findMany({
    where: {
      refereeId,
      leagueId,
      lifecycleStatus: "SCHEDULED",
      resultStatus: { not: "FINAL" },
    },
    orderBy: [{ date: "asc" }, { round: "asc" }],
    take: 12,
    select: {
      id: true,
      round: true,
      date: true,
      venueName: true,
      venueAddress: true,
      resultStatus: true,
      homeSheetConfirmed: true,
      awaySheetConfirmed: true,
      homeTeam: { select: { id: true, name: true, badgeUrl: true } },
      awayTeam: { select: { id: true, name: true, badgeUrl: true } },
    },
  });

  const now = new Date();
  const today = dayKey(now);
  const normalized = matches.map((match) => ({
    ...match,
    isToday: match.date ? dayKey(match.date) === today : false,
  }));

  normalized.sort((a, b) => {
    if (a.isToday !== b.isToday) return a.isToday ? -1 : 1;
    const at = a.date?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bt = b.date?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const aFuture = at >= now.getTime();
    const bFuture = bt >= now.getTime();
    if (aFuture !== bFuture) return aFuture ? -1 : 1;
    return aFuture ? at - bt : bt - at;
  });

  return normalized;
}
