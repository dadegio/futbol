import { prisma } from "@/lib/prisma";
import { getSlotWeekWindow } from "@/modules/fields/domain/field-slots";
import {
  deriveMatchOperationalState,
  type MatchOperationalStatus,
} from "@/modules/matches/domain/match-operational-status";
import {
  effectiveMatchEnd,
  refereeAllowsStart,
  refereeHasConflict,
} from "@/modules/referees/domain/referee-availability";
import { AppError } from "@/modules/core/errors";

export type AdminOperationalMatch = {
  id: string;
  round: number;
  phase: "league" | "playoff";
  leg: number | null;
  date: string | null;
  slotEnd: string | null;
  venueKey: string | null;
  venueName: string | null;
  venueAddress: string | null;
  referee: { id: string; name: string } | null;
  refereeManualOverride: boolean;
  homeTeam: { id: string; name: string; badgeUrl: string | null };
  awayTeam: { id: string; name: string; badgeUrl: string | null };
  homeGoals: number | null;
  awayGoals: number | null;
  homeSheetCount: number;
  awaySheetCount: number;
  status: MatchOperationalStatus;
  issues: ReturnType<typeof deriveMatchOperationalState>["issues"];
  inCurrentWeek: boolean;
};

export async function getLeagueAdminOperations(leagueId: string) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, name: true },
  });
  if (!league) throw new AppError(404, "Torneo non trovato");

  const matches = await prisma.match.findMany({
    where: { leagueId },
    orderBy: [{ date: "asc" }, { round: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      round: true,
      date: true,
      slotEnd: true,
      venueKey: true,
      venueName: true,
      venueAddress: true,
      refereeId: true,
      refereeManualOverride: true,
      homeGoals: true,
      awayGoals: true,
      seriesId: true,
      leg: true,
      homeTeamId: true,
      awayTeamId: true,
      homeTeam: { select: { id: true, name: true, badgeUrl: true } },
      awayTeam: { select: { id: true, name: true, badgeUrl: true } },
      referee: {
        select: {
          id: true,
          name: true,
          active: true,
          teamId: true,
          availabilities: { select: { weekday: true, hour: true, minute: true } },
        },
      },
      sheetPlayers: { select: { teamId: true } },
    },
  });

  const now = new Date();
  const currentWeek = getSlotWeekWindow(now);
  const windows = matches.map((match) => ({
    id: match.id,
    date: match.date,
    slotEnd: match.slotEnd,
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    refereeId: match.refereeId,
  }));

  const items: AdminOperationalMatch[] = matches.map((match) => {
    const homeSheetCount = match.sheetPlayers.filter((row) => row.teamId === match.homeTeamId).length;
    const awaySheetCount = match.sheetPlayers.filter((row) => row.teamId === match.awayTeamId).length;

    let refereeConflict = false;
    if (match.date && match.referee) {
      const endsAt = effectiveMatchEnd(match.date, match.slotEnd);
      refereeConflict =
        !match.referee.active ||
        match.referee.teamId === match.homeTeamId ||
        match.referee.teamId === match.awayTeamId ||
        !refereeAllowsStart(match.referee.availabilities, match.date) ||
        refereeHasConflict({
          refereeId: match.referee.id,
          teamId: match.referee.teamId,
          startsAt: match.date,
          endsAt,
          otherMatches: windows.filter((candidate) => candidate.id !== match.id),
        });
    }

    const operational = deriveMatchOperationalState({
      date: match.date,
      venueKey: match.venueKey,
      refereeId: match.refereeId,
      homeGoals: match.homeGoals,
      awayGoals: match.awayGoals,
      homeSheetCount,
      awaySheetCount,
      refereeConflict,
      now,
    });

    const inCurrentWeek = Boolean(
      match.date &&
        match.date.getTime() >= currentWeek.startsAt.getTime() &&
        match.date.getTime() < currentWeek.endsAt.getTime()
    );

    return {
      id: match.id,
      round: match.round,
      phase: match.seriesId ? "playoff" : "league",
      leg: match.leg,
      date: match.date?.toISOString() ?? null,
      slotEnd: match.slotEnd?.toISOString() ?? null,
      venueKey: match.venueKey,
      venueName: match.venueName,
      venueAddress: match.venueAddress,
      referee: match.referee ? { id: match.referee.id, name: match.referee.name } : null,
      refereeManualOverride: match.refereeManualOverride,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      homeGoals: match.homeGoals,
      awayGoals: match.awayGoals,
      homeSheetCount,
      awaySheetCount,
      status: operational.status,
      issues: operational.issues,
      inCurrentWeek,
    };
  });

  const attention = items.filter((match) => match.issues.length > 0 && match.status !== "COMPLETED");
  const upcoming = items.filter((match) => match.date && new Date(match.date).getTime() >= now.getTime() && match.status !== "COMPLETED");

  return {
    league,
    generatedAt: now.toISOString(),
    week: {
      startsAt: currentWeek.startsAt.toISOString(),
      endsAt: currentWeek.endsAt.toISOString(),
    },
    totals: {
      matches: items.length,
      attention: attention.length,
      withoutSlot: items.filter((match) => match.issues.some((issue) => issue.code === "NO_SLOT" || issue.code === "NO_FIELD")).length,
      withoutReferee: items.filter((match) => match.issues.some((issue) => issue.code === "NO_REFEREE")).length,
      refereeConflicts: items.filter((match) => match.issues.some((issue) => issue.code === "REFEREE_CONFLICT")).length,
      overdueResults: items.filter((match) => match.issues.some((issue) => issue.code === "RESULT_OVERDUE")).length,
      ready: items.filter((match) => match.status === "READY").length,
      completed: items.filter((match) => match.status === "COMPLETED").length,
      currentWeek: items.filter((match) => match.inCurrentWeek).length,
      upcoming: upcoming.length,
    },
    matches: items,
  };
}
