import { prisma } from "@/lib/prisma";
import { AppError } from "@/modules/core/errors";
import { syncPlayoffSeriesWinner } from "@/lib/playoff-progress";
import {
  FUTPOLI_RULES,
  isPlayerEligibleForMatchSheet,
} from "@/lib/tournament-rules";

type SaveMatchResultBody = {
  homeGoals?: number;
  awayGoals?: number;
  playerStats?: Array<{ playerId: string; goals: number; assists: number }>;
  sheetPlayerIds?: string[];
};

type EligiblePlayer = {
  id: string;
  teamId: string;
  status: string | null;
  documentSigned: boolean;
  mediaConsent: boolean;
  firstName: string;
  lastName: string;
};

function asNonNegInt(n: unknown) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;

  const i = Math.floor(x);
  if (i < 0) return null;

  return i;
}

function isEligiblePlayer(player: EligiblePlayer) {
  return isPlayerEligibleForMatchSheet(player);
}

function normalizeResultBody(body: SaveMatchResultBody) {
  const homeGoals = body.homeGoals === undefined ? undefined : asNonNegInt(body.homeGoals);
  const awayGoals = body.awayGoals === undefined ? undefined : asNonNegInt(body.awayGoals);

  if (homeGoals === null) throw new AppError(400, "homeGoals non valido", "INVALID_HOME_GOALS");
  if (awayGoals === null) throw new AppError(400, "awayGoals non valido", "INVALID_AWAY_GOALS");

  const rows = Array.isArray(body.playerStats) ? body.playerStats : [];
  for (const row of rows) {
    if (!row?.playerId) throw new AppError(400, "playerId mancante", "PLAYER_ID_MISSING");

    const goals = asNonNegInt(row.goals);
    const assists = asNonNegInt(row.assists);

    if (goals === null || assists === null) {
      throw new AppError(400, "goals/assists non validi", "INVALID_PLAYER_STATS");
    }
  }

  const requestedSheetIds = Array.isArray(body.sheetPlayerIds)
    ? [...new Set(body.sheetPlayerIds.map((id) => String(id).trim()).filter(Boolean))]
    : [];

  if (requestedSheetIds.length === 0) {
    throw new AppError(400, "Distinta gara mancante: seleziona i giocatori presenti", "MATCH_SHEET_MISSING");
  }

  return { homeGoals, awayGoals, rows, requestedSheetIds };
}

export async function saveMatchResult({
  matchId,
  input,
}: {
  matchId: string;
  input: SaveMatchResultBody;
}) {
  const { homeGoals, awayGoals, rows, requestedSheetIds } = normalizeResultBody(input);

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      leagueId: true,
      homeTeamId: true,
      awayTeamId: true,
      seriesId: true,
      league: {
        select: {
          playoffFormat: true,
        },
      },
    },
  });

  if (!match) throw new AppError(404, "Partita non trovata", "MATCH_NOT_FOUND");

  const playerIds = [...new Set([...rows.map((row) => row.playerId), ...requestedSheetIds])];

  const players: EligiblePlayer[] = playerIds.length
    ? await prisma.player.findMany({
        where: { id: { in: playerIds } },
        select: {
          id: true,
          teamId: true,
          status: true,
          documentSigned: true,
          mediaConsent: true,
          firstName: true,
          lastName: true,
        },
      })
    : [];

  const playerById = new Map<string, EligiblePlayer>(players.map((player) => [player.id, player]));

  for (const playerId of playerIds) {
    const player = playerById.get(playerId);

    if (!player) throw new AppError(400, "Giocatore non valido", "INVALID_PLAYER");

    if (player.teamId !== match.homeTeamId && player.teamId !== match.awayTeamId) {
      throw new AppError(
        400,
        "Un giocatore non appartiene alle squadre della partita",
        "PLAYER_NOT_IN_MATCH"
      );
    }
  }

  const sheetPlayers = requestedSheetIds.map((playerId) => playerById.get(playerId)!);

  const ineligible = sheetPlayers.find((player) => !isEligiblePlayer(player));
  if (ineligible) {
    throw new AppError(
      400,
      `${ineligible.firstName} ${ineligible.lastName} non è autorizzato per la distinta: servono stato Autorizzato, modulo firmato e liberatoria video/foto`,
      "INELIGIBLE_PLAYER"
    );
  }

  const homeSheet = sheetPlayers.filter((player) => player.teamId === match.homeTeamId);
  const awaySheet = sheetPlayers.filter((player) => player.teamId === match.awayTeamId);

  if (
    homeSheet.length < FUTPOLI_RULES.minPlayersInMatchSheet ||
    awaySheet.length < FUTPOLI_RULES.minPlayersInMatchSheet
  ) {
    throw new AppError(
      400,
      `Ogni squadra deve avere almeno ${FUTPOLI_RULES.minPlayersInMatchSheet} giocatori autorizzati in distinta`,
      "MATCH_SHEET_TOO_SHORT"
    );
  }

  const sheetSet = new Set(requestedSheetIds);
  const statOutsideSheet = rows.find((row) => !sheetSet.has(row.playerId));

  if (statOutsideSheet) {
    throw new AppError(
      400,
      "Gol e assist possono essere assegnati solo a giocatori presenti in distinta",
      "STATS_OUTSIDE_SHEET"
    );
  }

  let winnerId: string | null = null;

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: matchId },
      data: {
        refereeCostCents: FUTPOLI_RULES.refereeCostCentsPerMatch,
        ...(homeGoals !== undefined ? { homeGoals } : {}),
        ...(awayGoals !== undefined ? { awayGoals } : {}),
      },
    });

    await tx.matchSheetPlayer.deleteMany({ where: { matchId } });

    await tx.matchSheetPlayer.createMany({
      data: sheetPlayers.map((player) => ({
        matchId,
        playerId: player.id,
        teamId: player.teamId,
      })),
    });

    await tx.matchPlayerStat.deleteMany({ where: { matchId } });

    if (rows.length) {
      await tx.matchPlayerStat.createMany({
        data: rows.map((row) => ({
          matchId,
          playerId: row.playerId,
          goals: Math.floor(row.goals),
          assists: Math.floor(row.assists),
        })),
      });
    }

    if (match.seriesId && match.league.playoffFormat) {
      await tx.playoffSeries.update({
        where: { id: match.seriesId },
        data: {
          winnerId: null,
          penaltiesHome: null,
          penaltiesAway: null,
        },
      });

      winnerId = await syncPlayoffSeriesWinner(tx as any, {
        leagueId: match.leagueId,
        seriesId: match.seriesId,
        format: match.league.playoffFormat,
      });
    }
  });

  return { leagueId: match.leagueId, winnerId };
}
