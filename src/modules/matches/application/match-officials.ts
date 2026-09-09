import { prisma } from "@/lib/prisma";
import { AppError } from "@/modules/core/errors";
import { rebalanceLeagueReferees } from "@/modules/referees/application/rebalance-league-referees";
import {
  effectiveMatchEnd,
  refereeAllowsStart,
  refereeHasConflict,
} from "@/modules/referees/domain/referee-availability";

export async function getAdminRefereeState(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      leagueId: true,
      date: true,
      slotEnd: true,
      homeTeamId: true,
      awayTeamId: true,
      refereeId: true,
      refereeManualOverride: true,
      homeGoals: true,
      awayGoals: true,
      referee: { select: { id: true, name: true, active: true } },
    },
  });

  if (!match) throw new AppError(404, "Partita non trovata", "MATCH_NOT_FOUND");

  const referees = await prisma.referee.findMany({
    where: { leagueId: match.leagueId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      active: true,
      teamId: true,
      team: { select: { id: true, name: true } },
      availabilities: {
        select: { weekday: true, hour: true, minute: true },
      },
    },
  });

  const otherMatches = match.date
    ? await prisma.match.findMany({
        where: {
          leagueId: match.leagueId,
          id: { not: match.id },
          date: { not: null },
        },
        select: {
          id: true,
          date: true,
          slotEnd: true,
          homeTeamId: true,
          awayTeamId: true,
          refereeId: true,
        },
      })
    : [];

  const startsAt = match.date;
  const endsAt = startsAt ? effectiveMatchEnd(startsAt, match.slotEnd) : null;

  const options = referees.map((referee) => {
    const warnings: string[] = [];
    if (!referee.active) warnings.push("Arbitro disattivato");
    if (referee.teamId === match.homeTeamId || referee.teamId === match.awayTeamId) {
      warnings.push(
        referee.team?.name
          ? `Gioca in ${referee.team.name}`
          : "Gioca in una delle due squadre"
      );
    }
    if (startsAt && endsAt) {
      if (!refereeAllowsStart(referee.availabilities, startsAt)) {
        warnings.push("Non disponibile in questo orario");
      }
      if (
        refereeHasConflict({
          refereeId: referee.id,
          teamId: referee.teamId,
          startsAt,
          endsAt,
          otherMatches,
        })
      ) {
        warnings.push("Ha un conflitto con un'altra gara o con la propria squadra");
      }
    }
    return {
      id: referee.id,
      name: referee.name,
      active: referee.active,
      warnings,
      compatible: warnings.length === 0,
    };
  });

  return {
    leagueId: match.leagueId,
    mode: match.refereeManualOverride ? "manual" : "automatic",
    referee: match.referee,
    refereeId: match.refereeId,
    completed: match.homeGoals !== null || match.awayGoals !== null,
    referees: options,
  };
}

export async function updateMatchOfficials({
  matchId,
  input,
}: {
  matchId: string;
  input: Record<string, unknown>;
}) {
  const mode = input?.mode === "manual" ? "manual" : "automatic";

  const existing = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      leagueId: true,
      refereeId: true,
      homeGoals: true,
      awayGoals: true,
    },
  });
  if (!existing) throw new AppError(404, "Partita non trovata", "MATCH_NOT_FOUND");

  if (mode === "manual") {
    const refereeId = input?.refereeId ? String(input.refereeId).trim() : null;
    if (refereeId) {
      const referee = await prisma.referee.findFirst({
        where: { id: refereeId, leagueId: existing.leagueId },
        select: { id: true },
      });
      if (!referee) throw new AppError(400, "Arbitro non valido per questo torneo", "INVALID_REFEREE");
    }

    await prisma.match.update({
      where: { id: matchId },
      data: {
        refereeManualOverride: true,
        refereeId,
      },
    });
    await rebalanceLeagueReferees(existing.leagueId);
  } else {
    const completed = existing.homeGoals !== null || existing.awayGoals !== null;
    await prisma.match.update({
      where: { id: matchId },
      data: {
        refereeManualOverride: false,
        ...(completed ? {} : { refereeId: null }),
      },
    });
    if (!completed) await rebalanceLeagueReferees(existing.leagueId);
  }

  return getAdminRefereeState(matchId);
}
