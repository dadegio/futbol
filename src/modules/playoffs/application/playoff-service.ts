import { generateBracket } from "@/lib/bracket";
import { prisma } from "@/lib/prisma";
import {
  forcePlayoffSeriesWinner,
  syncPlayoffSeriesWinner,
} from "@/lib/playoff-progress";
import { AppError } from "@/modules/core/api";
import { getLeagueTable } from "@/modules/stats/application/league-table-service";
import { PLAYOFF_COUNTS, PLAYOFF_FORMATS } from "@/modules/leagues/domain/league-input";

export async function getPlayoffs(leagueId: string) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      id: true,
      playoffFormat: true,
      playoffTeamCount: true,
      playoffSeeded: true,
    },
  });

  if (!league) throw new AppError(404, "Lega non trovata");

  if (!league.playoffFormat) {
    return { configured: false, planned: false };
  }

  const series = await prisma.playoffSeries.findMany({
    where: { leagueId },
    orderBy: [{ bracketRound: "desc" }, { position: "asc" }],
    include: {
      homeTeam: { select: { id: true, name: true, badgeUrl: true } },
      awayTeam: { select: { id: true, name: true, badgeUrl: true } },
      winner: { select: { id: true, name: true } },
      matches: {
        orderBy: { leg: "asc" },
        select: {
          id: true,
          leg: true,
          homeGoals: true,
          awayGoals: true,
          homeTeamId: true,
          awayTeamId: true,
          date: true,
        },
      },
    },
  });

  return {
    configured: series.length > 0,
    planned: true,
    format: league.playoffFormat,
    teamCount: league.playoffTeamCount,
    seeded: league.playoffSeeded,
    series: series.map((row) => ({
      ...row,
      matches: row.matches.map((match) => ({
        ...match,
        date: match.date?.toISOString() ?? null,
      })),
    })),
  };
}

export async function createPlayoffs(leagueId: string, input: any) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, playoffFormat: true, playoffTeamCount: true, playoffSeeded: true },
  });

  if (!league) throw new AppError(404, "Lega non trovata");

  const format = String(input?.format ?? league.playoffFormat ?? "").trim();
  if (!PLAYOFF_FORMATS.has(format)) {
    throw new AppError(400, "Formato non valido (SINGLE_ELIM o TWO_LEG)");
  }

  const teamCount = Number(input?.teamCount ?? league.playoffTeamCount);
  if (!PLAYOFF_COUNTS.has(teamCount)) {
    throw new AppError(400, "Numero squadre non valido (2, 4, 8 o 16)");
  }

  const autoSeed = input?.autoSeed ?? league.playoffSeeded ?? true;

  const existingSeriesCount = await prisma.playoffSeries.count({ where: { leagueId } });
  if (existingSeriesCount > 0) {
    throw new AppError(400, "Playoff già configurati. Eliminarli prima di crearne di nuovi.");
  }

  const teamsInLeague = await prisma.team.count({
    where: { leagueId, activeInLeague: true },
  });
  if (teamsInLeague < teamCount) {
    throw new AppError(400, `Servono almeno ${teamCount} squadre, ne hai ${teamsInLeague}`);
  }

  let seedTeamIds: string[] | null = null;
  if (autoSeed) {
    seedTeamIds = await getStandingsTeamIds(leagueId, teamCount);
  } else {
    const manualTeamIds: string[] = Array.isArray(input?.manualTeamIds)
      ? input.manualTeamIds
          .map((id: unknown) => String(id).trim())
          .filter((id: string) => id.length > 0)
      : [];

    if (manualTeamIds.length === teamCount) {
      const validTeams = await prisma.team.findMany({
        where: { leagueId, activeInLeague: true, id: { in: manualTeamIds } },
        select: { id: true },
      });
      const validIds = new Set(validTeams.map((team) => team.id));
      const allValid = manualTeamIds.every((id) => validIds.has(id));
      if (!allValid) throw new AppError(400, "Alcune squadre non sono valide per questa lega");
      seedTeamIds = manualTeamIds;
    }
  }

  const bracket = generateBracket(teamCount);

  await prisma.$transaction(async (tx) => {
    await tx.league.update({
      where: { id: leagueId },
      data: {
        playoffFormat: format as "SINGLE_ELIM" | "TWO_LEG",
        playoffTeamCount: teamCount,
        playoffSeeded: Boolean(autoSeed),
      },
    });

    const seriesIdMap = new Map<string, string>();

    for (const series of bracket) {
      const created = await tx.playoffSeries.create({
        data: {
          leagueId,
          bracketRound: series.bracketRound,
          position: series.position,
          homeSeed: series.homeSeed,
          awaySeed: series.awaySeed,
          homeTeamId: series.homeSeed && seedTeamIds ? seedTeamIds[series.homeSeed - 1] ?? null : null,
          awayTeamId: series.awaySeed && seedTeamIds ? seedTeamIds[series.awaySeed - 1] ?? null : null,
        },
      });
      seriesIdMap.set(`${series.bracketRound}-${series.position}`, created.id);
    }

    for (const series of bracket) {
      if (series.feedsIntoPosition === null) continue;
      const nextRound = series.bracketRound / 2;
      const feedsIntoId = seriesIdMap.get(`${nextRound}-${series.feedsIntoPosition}`);
      const currentId = seriesIdMap.get(`${series.bracketRound}-${series.position}`);
      if (feedsIntoId && currentId) {
        await tx.playoffSeries.update({
          where: { id: currentId },
          data: { feedsIntoSeriesId: feedsIntoId },
        });
      }
    }

    const firstRound = teamCount / 2;
    for (const series of bracket) {
      if (series.bracketRound !== firstRound) continue;
      const seriesId = seriesIdMap.get(`${series.bracketRound}-${series.position}`);
      const homeTeamId = series.homeSeed && seedTeamIds ? seedTeamIds[series.homeSeed - 1] : null;
      const awayTeamId = series.awaySeed && seedTeamIds ? seedTeamIds[series.awaySeed - 1] : null;

      if (seriesId && homeTeamId && awayTeamId) {
        await tx.match.create({
          data: {
            leagueId,
            round: 0,
            homeTeamId,
            awayTeamId,
            seriesId,
            leg: 1,
          },
        });

        if (format === "TWO_LEG") {
          await tx.match.create({
            data: {
              leagueId,
              round: 0,
              homeTeamId: awayTeamId,
              awayTeamId: homeTeamId,
              seriesId,
              leg: 2,
            },
          });
        }
      }
    }
  });

  return { ok: true, format, teamCount };
}

export async function deletePlayoffs(leagueId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.match.deleteMany({ where: { leagueId, seriesId: { not: null } } });
    await tx.playoffSeries.updateMany({
      where: { leagueId },
      data: { feedsIntoSeriesId: null },
    });
    await tx.playoffSeries.deleteMany({ where: { leagueId } });
    await tx.league.update({
      where: { id: leagueId },
      data: {
        playoffFormat: null,
        playoffTeamCount: null,
        playoffSeeded: true,
      },
    });
  });

  return { ok: true };
}

export async function advancePlayoffSeries(leagueId: string, input: any) {
  const seriesId = String(input?.seriesId ?? "").trim();
  const manualWinnerId = input?.winnerId ? String(input.winnerId).trim() : null;

  if (!seriesId) throw new AppError(400, "seriesId mancante");

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { playoffFormat: true },
  });

  if (!league?.playoffFormat) throw new AppError(400, "Playoff non configurati");

  const result = await prisma.$transaction((tx) => {
    if (manualWinnerId) {
      return forcePlayoffSeriesWinner(tx, {
        leagueId,
        seriesId,
        winnerId: manualWinnerId,
        format: league.playoffFormat!,
      });
    }

    return syncPlayoffSeriesWinner(tx, {
      leagueId,
      seriesId,
      format: league.playoffFormat!,
    });
  });

  if (!result) {
    throw new AppError(
      400,
      "Risultato non determinabile automaticamente. Seleziona manualmente la squadra che passa il turno."
    );
  }

  return { ok: true, winnerId: result };
}

export async function assignPlayoffSeriesTeams(leagueId: string, seriesId: string, input: any) {
  const series = await prisma.playoffSeries.findUnique({
    where: { id: seriesId },
    select: { id: true, leagueId: true, bracketRound: true },
  });

  if (!series || series.leagueId !== leagueId) throw new AppError(404, "Serie non trovata");

  const homeTeamId =
    input?.homeTeamId === undefined || input?.homeTeamId === null
      ? undefined
      : String(input.homeTeamId).trim();
  const awayTeamId =
    input?.awayTeamId === undefined || input?.awayTeamId === null
      ? undefined
      : String(input.awayTeamId).trim();

  const teamIds = [homeTeamId, awayTeamId].filter(
    (id): id is string => typeof id === "string" && id.length > 0
  );
  if (teamIds.length > 0) {
    const teams = await prisma.team.findMany({
      where: { leagueId, activeInLeague: true, id: { in: teamIds } },
      select: { id: true },
    });
    if (teams.length !== teamIds.length) throw new AppError(400, "Squadra non valida per questa lega");
  }

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { playoffFormat: true },
  });

  if (!league?.playoffFormat) throw new AppError(400, "Playoff non configurati");

  await prisma.$transaction(async (tx) => {
    await tx.playoffSeries.update({
      where: { id: seriesId },
      data: {
        ...(homeTeamId !== undefined ? { homeTeamId } : {}),
        ...(awayTeamId !== undefined ? { awayTeamId } : {}),
      },
    });

    const updated = await tx.playoffSeries.findUnique({
      where: { id: seriesId },
      select: { homeTeamId: true, awayTeamId: true },
    });

    if (updated?.homeTeamId && updated?.awayTeamId) {
      const existingMatches = await tx.match.count({ where: { seriesId } });
      if (existingMatches === 0) {
        await tx.match.create({
          data: {
            leagueId,
            round: 0,
            homeTeamId: updated.homeTeamId,
            awayTeamId: updated.awayTeamId,
            seriesId,
            leg: 1,
          },
        });

        if (league.playoffFormat === "TWO_LEG") {
          await tx.match.create({
            data: {
              leagueId,
              round: 0,
              homeTeamId: updated.awayTeamId,
              awayTeamId: updated.homeTeamId,
              seriesId,
              leg: 2,
            },
          });
        }
      }
    }
  });

  return { ok: true };
}

export async function savePlayoffSeriesPenalties(leagueId: string, seriesId: string, input: any) {
  const penaltiesHome = input?.penaltiesHome;
  const penaltiesAway = input?.penaltiesAway;

  if (
    !Number.isInteger(penaltiesHome) || penaltiesHome < 0 ||
    !Number.isInteger(penaltiesAway) || penaltiesAway < 0 ||
    penaltiesHome === penaltiesAway
  ) {
    throw new AppError(400, "Inserisci due valori interi non negativi e diversi per i rigori");
  }

  const series = await prisma.playoffSeries.findUnique({
    where: { id: seriesId },
    select: { id: true, leagueId: true },
  });

  if (!series || series.leagueId !== leagueId) throw new AppError(404, "Serie non trovata");

  await prisma.playoffSeries.update({
    where: { id: seriesId },
    data: { penaltiesHome, penaltiesAway },
  });

  return { ok: true };
}

async function getStandingsTeamIds(leagueId: string, limit: number) {
  const table = await getLeagueTable(leagueId);
  return table.slice(0, limit).map((row) => row.teamId);
}
