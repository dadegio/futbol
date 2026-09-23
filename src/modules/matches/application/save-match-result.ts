import { prisma } from "@/lib/prisma";
import { AppError } from "@/modules/core/errors";
import {
  FUTPOLI_RULES,
  isPlayerEligibleForMatchSheet,
} from "@/modules/players/domain/tournament-rules";

type SaveMatchResultBody = {
  homeGoals?: number;
  awayGoals?: number;
  playerStats?: Array<{ playerId: string; goals: number; assists: number }>;
  sheetPlayerIds?: string[];
  mvpPlayerId?: string | null;
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

  const mvpPlayerId = body.mvpPlayerId == null ? null : String(body.mvpPlayerId).trim() || null;

  return { homeGoals, awayGoals, rows, requestedSheetIds, mvpPlayerId };
}

export async function saveMatchResult({
  matchId,
  input,
}: {
  matchId: string;
  input: SaveMatchResultBody;
}) {
  const { homeGoals, awayGoals, rows, requestedSheetIds, mvpPlayerId } = normalizeResultBody(input);

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      leagueId: true,
      homeTeamId: true,
      awayTeamId: true,
      seriesId: true,
      resultStatus: true,
      lifecycleStatus: true,
    },
  });

  if (!match) throw new AppError(404, "Partita non trovata", "MATCH_NOT_FOUND");
  if (match.resultStatus === "FINAL") throw new AppError(409, "Risultato definitivo: riapri prima la partita", "RESULT_FINAL");
  if (match.lifecycleStatus === "CANCELLED") throw new AppError(409, "Partita annullata", "MATCH_CANCELLED");

  const playerIds = [...new Set([...rows.map((row) => row.playerId), ...requestedSheetIds, ...(mvpPlayerId ? [mvpPlayerId] : [])])];

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

  const homeScorerGoals = rows.reduce((sum, row) =>
    playerById.get(row.playerId)?.teamId === match.homeTeamId ? sum + Math.floor(row.goals) : sum, 0);
  const awayScorerGoals = rows.reduce((sum, row) =>
    playerById.get(row.playerId)?.teamId === match.awayTeamId ? sum + Math.floor(row.goals) : sum, 0);

  if (homeGoals !== undefined && homeScorerGoals !== homeGoals) {
    throw new AppError(
      400,
      `I marcatori della squadra di casa totalizzano ${homeScorerGoals} gol, ma il risultato indica ${homeGoals}`,
      "HOME_SCORER_TOTAL_MISMATCH"
    );
  }
  if (awayGoals !== undefined && awayScorerGoals !== awayGoals) {
    throw new AppError(
      400,
      `I marcatori della squadra ospite totalizzano ${awayScorerGoals} gol, ma il risultato indica ${awayGoals}`,
      "AWAY_SCORER_TOTAL_MISMATCH"
    );
  }

  const sheetSet = new Set(requestedSheetIds);
  const statOutsideSheet = rows.find((row) => !sheetSet.has(row.playerId));

  if (mvpPlayerId && !sheetSet.has(mvpPlayerId)) {
    throw new AppError(400, "L'MVP deve essere un giocatore presente in distinta", "MVP_NOT_IN_SHEET");
  }

  if (statOutsideSheet) {
    throw new AppError(
      400,
      "Gol e assist possono essere assegnati solo a giocatori presenti in distinta",
      "STATS_OUTSIDE_SHEET"
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: matchId },
      data: {
        ...(homeGoals !== undefined ? { homeGoals } : {}),
        ...(awayGoals !== undefined ? { awayGoals } : {}),
        resultStatus: "DRAFT",
        finalizedAt: null,
        homeSheetConfirmed: false,
        awaySheetConfirmed: false,
        mvpPlayerId,
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

  });

  return { leagueId: match.leagueId, winnerId: null, resultStatus: "DRAFT" as const };
}
