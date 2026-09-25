import "server-only";

import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";

const teamSelect = {
  id: true,
  name: true,
  badgeUrl: true,
  colorHex: true,
  secondaryColorHex: true,
} as const;

export async function getCoachDashboard(session: SessionUser | null, leagueId: string) {
  if (!session || session.role !== "COACH") return null;

  const assignment = await prisma.coachAssignment.findFirst({
    where: { userId: session.userId, leagueId },
    include: {
      league: { select: { id: true, name: true } },
      team: { select: teamSelect },
    },
  });
  if (!assignment) return null;

  const teamId = assignment.teamId;
  const [players, matches] = await Promise.all([
    prisma.player.findMany({
      where: { teamId },
      orderBy: [{ number: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        number: true,
        position: true,
        photoUrl: true,
        photoZoom: true,
        photoPositionX: true,
        photoPositionY: true,
      },
    }),
    prisma.match.findMany({
      where: {
        leagueId,
        OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      },
      orderBy: [{ date: "asc" }, { round: "asc" }],
      take: 100,
      select: {
        id: true,
        round: true,
        date: true,
        venueName: true,
        lifecycleStatus: true,
        resultStatus: true,
        homeTeamId: true,
        awayTeamId: true,
        homeGoals: true,
        awayGoals: true,
        mvpPlayerId: true,
        homeTeam: { select: teamSelect },
        awayTeam: { select: teamSelect },
      },
    }),
  ]);

  const finished = matches.filter((match) => match.resultStatus === "FINAL");
  const future = matches
    .filter((match) =>
      match.resultStatus !== "FINAL" &&
      match.lifecycleStatus !== "CANCELLED" &&
      (!match.date || match.date.getTime() >= Date.now())
    )
    .sort((a, b) => {
      const at = a.date?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bt = b.date?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return at - bt || a.round - b.round;
    });

  const finishedIds = finished.map((match) => match.id);
  const [stats, appearances] = await Promise.all([
    finishedIds.length
      ? prisma.matchPlayerStat.findMany({
          where: { matchId: { in: finishedIds }, player: { teamId } },
          select: { playerId: true, goals: true, assists: true, yellowCards: true, redCards: true },
        })
      : Promise.resolve([]),
    finishedIds.length
      ? prisma.matchSheetPlayer.findMany({
          where: { matchId: { in: finishedIds }, teamId },
          select: { playerId: true },
        })
      : Promise.resolve([]),
  ]);

  const totals = new Map<string, { appearances: number; goals: number; assists: number; yellowCards: number; redCards: number; mvp: number }>();
  for (const player of players) totals.set(player.id, { appearances: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0, mvp: 0 });
  for (const row of appearances) {
    const current = totals.get(row.playerId);
    if (current) current.appearances += 1;
  }
  for (const row of stats) {
    const current = totals.get(row.playerId);
    if (current) {
      current.goals += row.goals;
      current.assists += row.assists;
      current.yellowCards += row.yellowCards;
      current.redCards += row.redCards;
    }
  }
  for (const match of finished) {
    if (!match.mvpPlayerId) continue;
    const current = totals.get(match.mvpPlayerId);
    if (current) current.mvp += 1;
  }

  const playerCards = players
    .map((player) => ({
      ...player,
      stats: totals.get(player.id) ?? { appearances: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0, mvp: 0 },
    }))
    .sort((a, b) =>
      (b.stats.goals + b.stats.assists) - (a.stats.goals + a.stats.assists) ||
      b.stats.mvp - a.stats.mvp ||
      a.number - b.number
    );

  const recent = [...finished]
    .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
    .slice(0, 5)
    .map((match) => {
      const isHome = match.homeTeamId === teamId;
      const goalsFor = isHome ? match.homeGoals ?? 0 : match.awayGoals ?? 0;
      const goalsAgainst = isHome ? match.awayGoals ?? 0 : match.homeGoals ?? 0;
      return {
        id: match.id,
        round: match.round,
        date: match.date,
        goalsFor,
        goalsAgainst,
        outcome: goalsFor > goalsAgainst ? "W" : goalsFor < goalsAgainst ? "L" : "D",
        opponent: isHome ? match.awayTeam : match.homeTeam,
      };
    });

  const nextMatch = future[0]
    ? {
        ...future[0],
        opponent: future[0].homeTeamId === teamId ? future[0].awayTeam : future[0].homeTeam,
        isHome: future[0].homeTeamId === teamId,
      }
    : null;

  return {
    league: assignment.league,
    team: assignment.team,
    rosterCount: players.length,
    playerCards,
    recent,
    nextMatch,
    upcomingCount: future.length,
  };
}
