import "server-only";

import { determineSeriesWinner } from "@/lib/bracket";

type Tx = any;

export async function syncPlayoffSeriesWinner(
  tx: Tx,
  params: {
    leagueId: string;
    seriesId: string;
    format: "SINGLE_ELIM" | "TWO_LEG";
  }
) {
  const { leagueId, seriesId, format } = params;

  const series = await tx.playoffSeries.findUnique({
    where: { id: seriesId },
    select: {
      id: true,
      leagueId: true,
      position: true,
      winnerId: true,
      feedsIntoSeriesId: true,
      matches: {
        orderBy: { leg: "asc" },
        select: {
          homeTeamId: true,
          awayTeamId: true,
          homeGoals: true,
          awayGoals: true,
          leg: true,
        },
      },
    },
  });

  if (!series || series.leagueId !== leagueId) {
    throw new Error("Serie playoff non trovata");
  }

  const winnerId = determineSeriesWinner(series.matches, format);
  if (!winnerId) return null;

  if (series.winnerId !== winnerId) {
    await tx.playoffSeries.update({
      where: { id: seriesId },
      data: { winnerId },
    });
  }

  if (!series.feedsIntoSeriesId) {
    return winnerId;
  }

  const slotField = series.position % 2 === 0 ? "homeTeamId" : "awayTeamId";

  await tx.playoffSeries.update({
    where: { id: series.feedsIntoSeriesId },
    data: { [slotField]: winnerId },
  });

  const nextSeries = await tx.playoffSeries.findUnique({
    where: { id: series.feedsIntoSeriesId },
    select: {
      id: true,
      homeTeamId: true,
      awayTeamId: true,
    },
  });

  if (!nextSeries?.homeTeamId || !nextSeries?.awayTeamId) {
    return winnerId;
  }

  const existingMatches = await tx.match.count({
    where: { seriesId: nextSeries.id },
  });

  if (existingMatches > 0) {
    return winnerId;
  }

  await tx.match.create({
    data: {
      leagueId,
      round: 0,
      homeTeamId: nextSeries.homeTeamId,
      awayTeamId: nextSeries.awayTeamId,
      seriesId: nextSeries.id,
      leg: 1,
    },
  });

  if (format === "TWO_LEG") {
    await tx.match.create({
      data: {
        leagueId,
        round: 0,
        homeTeamId: nextSeries.awayTeamId,
        awayTeamId: nextSeries.homeTeamId,
        seriesId: nextSeries.id,
        leg: 2,
      },
    });
  }

  return winnerId;
}