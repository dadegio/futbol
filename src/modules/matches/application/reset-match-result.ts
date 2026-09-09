import { prisma } from "@/lib/prisma";
import { AppError } from "@/modules/core/errors";

type Tx = any;

async function rollbackPlayoffProgress(tx: Tx, seriesId: string) {
  const series = await tx.playoffSeries.findUnique({
    where: { id: seriesId },
    select: {
      id: true,
      position: true,
      winnerId: true,
      feedsIntoSeriesId: true,
    },
  });

  if (!series) return { downstreamReset: false };

  const previousWinnerId = series.winnerId;

  await tx.playoffSeries.update({
    where: { id: series.id },
    data: {
      winnerId: null,
      penaltiesHome: null,
      penaltiesAway: null,
    },
  });

  if (!series.feedsIntoSeriesId || !previousWinnerId) {
    return { downstreamReset: false };
  }

  const downstream = await tx.playoffSeries.findUnique({
    where: { id: series.feedsIntoSeriesId },
    select: {
      id: true,
      winnerId: true,
      homeTeamId: true,
      awayTeamId: true,
      matches: {
        select: {
          id: true,
          homeGoals: true,
          awayGoals: true,
          _count: { select: { sheetPlayers: true, stats: true } },
        },
      },
    },
  });

  if (!downstream) return { downstreamReset: false };

  const downstreamHasRecordedData =
    downstream.winnerId !== null ||
    downstream.matches.some(
      (match: {
        homeGoals: number | null;
        awayGoals: number | null;
        _count: { sheetPlayers: number; stats: number };
      }) =>
        match.homeGoals !== null ||
        match.awayGoals !== null ||
        match._count.sheetPlayers > 0 ||
        match._count.stats > 0
    );

  if (downstreamHasRecordedData) {
    throw new AppError(
      409,
      "Non puoi resettare questa gara perché il turno playoff successivo contiene già distinta o risultato. Resetta prima le gare del turno successivo.",
      "PLAYOFF_DOWNSTREAM_ALREADY_STARTED"
    );
  }

  // Il match del turno successivo viene creato automaticamente quando entrambi
  // i partecipanti sono noti. Se uno dei due qualificati viene rimesso in
  // discussione, quel match non è più valido e può essere ricreato in seguito.
  await tx.match.deleteMany({ where: { seriesId: downstream.id } });

  const slotField = series.position % 2 === 0 ? "homeTeamId" : "awayTeamId";
  const currentSlot = slotField === "homeTeamId" ? downstream.homeTeamId : downstream.awayTeamId;

  await tx.playoffSeries.update({
    where: { id: downstream.id },
    data: {
      ...(currentSlot === previousWinnerId ? { [slotField]: null } : {}),
      winnerId: null,
      penaltiesHome: null,
      penaltiesAway: null,
    },
  });

  return { downstreamReset: true };
}

export async function resetMatchResult(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      leagueId: true,
      seriesId: true,
      homeGoals: true,
      awayGoals: true,
      _count: { select: { sheetPlayers: true, stats: true } },
    },
  });

  if (!match) throw new AppError(404, "Partita non trovata", "MATCH_NOT_FOUND");

  const hadRecordedData =
    match.homeGoals !== null ||
    match.awayGoals !== null ||
    match._count.sheetPlayers > 0 ||
    match._count.stats > 0;

  const result = await prisma.$transaction(async (tx) => {
    const deletedStats = await tx.matchPlayerStat.deleteMany({ where: { matchId } });
    const deletedSheet = await tx.matchSheetPlayer.deleteMany({ where: { matchId } });

    await tx.match.update({
      where: { id: matchId },
      data: {
        homeGoals: null,
        awayGoals: null,
      },
    });

    const playoff = match.seriesId
      ? await rollbackPlayoffProgress(tx, match.seriesId)
      : { downstreamReset: false };

    return {
      clearedStats: deletedStats.count,
      clearedSheetPlayers: deletedSheet.count,
      playoffDownstreamReset: playoff.downstreamReset,
    };
  });

  return {
    ok: true,
    leagueId: match.leagueId,
    hadRecordedData,
    ...result,
  };
}
