import { prisma } from "@/lib/prisma";
import {
  formatRomeMatchDate,
  isRomeSunday,
  nextWeekRomeDateKeys,
  romeDateKey,
} from "@/modules/notifications/domain/reminder-window";
import { createNotification } from "./notification-service";

type ReminderRole = "CAPTAIN" | "COACH" | "REFEREE";

function roleCopy(
  role: ReminderRole,
  matchLabel: string,
  when: string,
  venue: string
) {
  if (role === "COACH") {
    return {
      title: "📋 Prepara la formazione",
      body: `${matchLabel} · ${when} · ${venue}. Apri la Coach Area e prepara la formazione.`,
    };
  }
  if (role === "REFEREE") {
    return {
      title: "🟨 Gara assegnata questa settimana",
      body: `${matchLabel} · ${when} · ${venue}. Controlla i dettagli della gara nella tua area arbitro.`,
    };
  }
  return {
    title: "⚽ Partita questa settimana",
    body: `${matchLabel} · ${when} · ${venue}. Controlla distinta e dettagli della gara.`,
  };
}

export async function runWeeklyMatchReminders(
  now = new Date(),
  options: { force?: boolean } = {}
) {
  if (!options.force && !isRomeSunday(now)) {
    return { ok: true, skipped: true, reason: "NOT_SUNDAY", matches: 0, created: 0 };
  }

  const targetDateKeys = new Set(nextWeekRomeDateKeys(now));
  const horizon = new Date(now.getTime() + 15 * 86_400_000);

  const candidates = await prisma.match.findMany({
    where: {
      date: { gt: now, lt: horizon },
      lifecycleStatus: "SCHEDULED",
    },
    orderBy: { date: "asc" },
    select: {
      id: true,
      leagueId: true,
      round: true,
      date: true,
      venueName: true,
      venueAddress: true,
      homeTeam: {
        select: {
          id: true,
          name: true,
          captain: { select: { id: true } },
          captainAssignment: { select: { userId: true } },
          coachAssignment: { select: { userId: true } },
        },
      },
      awayTeam: {
        select: {
          id: true,
          name: true,
          captain: { select: { id: true } },
          captainAssignment: { select: { userId: true } },
          coachAssignment: { select: { userId: true } },
        },
      },
      referee: {
        select: {
          account: { select: { id: true } },
        },
      },
    },
  });

  const matches = candidates.filter(
    (match) => match.date && targetDateKeys.has(romeDateKey(match.date))
  );
  const weekKey = [...targetDateKeys][0] ?? "next-week";
  let created = 0;

  for (const match of matches) {
    if (!match.date) continue;
    const recipients = new Map<string, ReminderRole>();
    const add = (userId: string | null | undefined, role: ReminderRole) => {
      if (userId) recipients.set(userId, role);
    };

    add(match.homeTeam.captainAssignment?.userId ?? match.homeTeam.captain?.id, "CAPTAIN");
    add(match.awayTeam.captainAssignment?.userId ?? match.awayTeam.captain?.id, "CAPTAIN");
    add(match.homeTeam.coachAssignment?.userId, "COACH");
    add(match.awayTeam.coachAssignment?.userId, "COACH");
    add(match.referee?.account?.id, "REFEREE");

    const matchLabel = `${match.homeTeam.name} vs ${match.awayTeam.name}`;
    const when = formatRomeMatchDate(match.date);
    const venue =
      [match.venueName, match.venueAddress].filter(Boolean).join(" · ") ||
      "Campo da definire";

    for (const [userId, role] of recipients) {
      const copy = roleCopy(role, matchLabel, when, venue);
      const notification = await createNotification({
        userId,
        leagueId: match.leagueId,
        matchId: match.id,
        kind: "MATCH_WEEKLY_REMINDER",
        title: copy.title,
        body: copy.body,
        href: `/leagues/${match.leagueId}/matches/${match.id}`,
        dedupeKey: `weekly:${weekKey}:${match.id}:${userId}`,
      });
      if (notification) created += 1;
    }
  }

  return {
    ok: true,
    skipped: false,
    matches: matches.length,
    created,
    weekStart: weekKey,
  };
}
