import "server-only";

import { determineSeriesWinner } from "@/lib/bracket";

type Tx = any;

function getWinnerFromPenalties(series: {
  homeTeamId: string | null;
  awayTeamId: string | null;
  penaltiesHome: number | null;
  penaltiesAway: number | null;
}) {
  if (!series.homeTeamId || !series.awayTeamId) return null;
  if (series.penaltiesHome === null || series.penaltiesAway === null) return null;
  if (series.penaltiesHome === series.penaltiesAway) return null;

  return series.penaltiesHome > series.penaltiesAway
    ? series.homeTeamId
    : series.awayTeamId;
}

async function advanceWinnerToNextSeries(
  tx: Tx,
  params: {
    leagueId: string;
    seriesId: string;
    winnerId: string;
    format: "SINGLE_ELIM" | "TWO_LEG";
    feedsIntoSeriesId: string | null;
    position: number;
  }
) {
  const { leagueId, winnerId, format, feedsIntoSeriesId, position } = params;

  if (!feedsIntoSeriesId) {
    return winnerId;
  }

  const slotField = position % 2 === 0 ? "homeTeamId" : "awayTeamId";

  await tx.playoffSeries.update({
    where: { id: feedsIntoSeriesId },
    data: { [slotField]: winnerId },
  });

  const nextSeries = await tx.playoffSeries.findUnique({
    where: { id: feedsIntoSeriesId },
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
      homeTeamId: true,
      awayTeamId: true,
      penaltiesHome: true,
      penaltiesAway: true,
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

  const winnerId =
    determineSeriesWinner(series.matches, format) ??
    getWinnerFromPenalties(series);

  if (!winnerId) return null;

  if (series.winnerId !== winnerId) {
    await tx.playoffSeries.update({
      where: { id: seriesId },
      data: { winnerId },
    });
  }

  return advanceWinnerToNextSeries(tx, {
    leagueId,
    seriesId,
    winnerId,
    format,
    feedsIntoSeriesId: series.feedsIntoSeriesId,
    position: series.position,
  });
}

export async function forcePlayoffSeriesWinner(
  tx: Tx,
  params: {
    leagueId: string;
    seriesId: string;
    winnerId: string;
    format: "SINGLE_ELIM" | "TWO_LEG";
  }
) {
  const { leagueId, seriesId, winnerId, format } = params;

  const series = await tx.playoffSeries.findUnique({
    where: { id: seriesId },
    select: {
      id: true,
      leagueId: true,
      position: true,
      homeTeamId: true,
      awayTeamId: true,
      feedsIntoSeriesId: true,
    },
  });

  if (!series || series.leagueId !== leagueId) {
    throw new Error("Serie playoff non trovata");
  }

  if (winnerId !== series.homeTeamId && winnerId !== series.awayTeamId) {
    throw new Error("Il vincitore selezionato non appartiene a questa serie");
  }

  await tx.playoffSeries.update({
    where: { id: seriesId },
    data: { winnerId },
  });

  return advanceWinnerToNextSeries(tx, {
    leagueId,
    seriesId,
    winnerId,
    format,
    feedsIntoSeriesId: series.feedsIntoSeriesId,
    position: series.position,
  });
}