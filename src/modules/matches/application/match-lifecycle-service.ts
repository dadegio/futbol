import { prisma } from "@/lib/prisma";
import { AppError } from "@/modules/core/errors";
import { FUTPOLI_RULES } from "@/modules/players/domain/tournament-rules";
import { syncPlayoffSeriesWinner } from "@/modules/playoffs/application/playoff-progress";
import { rollbackPlayoffProgress } from "./reset-match-result";

function cleanOptionalUrl(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    return url.toString();
  } catch {
    throw new AppError(400, "URL non valido", "INVALID_URL");
  }
}

export async function finalizeMatchResult(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      leagueId: true,
      homeGoals: true,
      awayGoals: true,
      homeSheetConfirmed: true,
      awaySheetConfirmed: true,
      lifecycleStatus: true,
      resultStatus: true,
      seriesId: true,
      league: { select: { playoffFormat: true } },
    },
  });
  if (!match) throw new AppError(404, "Partita non trovata", "MATCH_NOT_FOUND");
  if (match.resultStatus === "FINAL") {
    throw new AppError(409, "Il risultato è già definitivo", "RESULT_FINAL");
  }
  if (match.lifecycleStatus !== "SCHEDULED") {
    throw new AppError(409, "La partita deve essere programmata per poter essere finalizzata", "MATCH_NOT_SCHEDULED");
  }
  if (match.homeGoals === null || match.awayGoals === null) {
    throw new AppError(400, "Inserisci prima il risultato", "RESULT_MISSING");
  }
  if (!match.homeSheetConfirmed || !match.awaySheetConfirmed) {
    throw new AppError(400, "Conferma entrambe le distinte prima di finalizzare", "SHEETS_NOT_CONFIRMED");
  }

  let winnerId: string | null = null;
  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: matchId },
      data: { resultStatus: "FINAL", finalizedAt: new Date() },
    });
    if (match.seriesId && match.league.playoffFormat) {
      winnerId = await syncPlayoffSeriesWinner(tx as never, {
        leagueId: match.leagueId,
        seriesId: match.seriesId,
        format: match.league.playoffFormat,
      });
    }
  });
  return { ok: true, leagueId: match.leagueId, winnerId };
}

export async function reopenMatchResult(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, leagueId: true, seriesId: true, resultStatus: true },
  });
  if (!match) throw new AppError(404, "Partita non trovata", "MATCH_NOT_FOUND");
  if (match.resultStatus !== "FINAL") {
    throw new AppError(409, "Solo un risultato definitivo può essere riaperto", "RESULT_NOT_FINAL");
  }

  await prisma.$transaction(async (tx) => {
    if (match.seriesId) {
      await rollbackPlayoffProgress(tx, match.seriesId);
    }
    await tx.match.update({
      where: { id: matchId },
      data: {
        resultStatus: "DRAFT",
        finalizedAt: null,
        homeSheetConfirmed: false,
        awaySheetConfirmed: false,
        mvpPlayerId: null,
      },
    });
  });
  return { ok: true, leagueId: match.leagueId };
}

export async function setMatchSheetConfirmation(
  matchId: string,
  team: "home" | "away",
  confirmed: boolean
) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      leagueId: true,
      resultStatus: true,
      lifecycleStatus: true,
      homeTeamId: true,
      awayTeamId: true,
    },
  });
  if (!match) throw new AppError(404, "Partita non trovata", "MATCH_NOT_FOUND");
  if (match.resultStatus === "FINAL") {
    throw new AppError(409, "Risultato definitivo: riapri prima la partita", "RESULT_FINAL");
  }
  if (match.lifecycleStatus !== "SCHEDULED") {
    throw new AppError(409, "La distinta può essere confermata solo per una partita programmata", "MATCH_NOT_SCHEDULED");
  }

  if (confirmed) {
    const teamId = team === "home" ? match.homeTeamId : match.awayTeamId;
    const count = await prisma.matchSheetPlayer.count({ where: { matchId, teamId } });
    if (count < FUTPOLI_RULES.minPlayersInMatchSheet) {
      throw new AppError(
        400,
        `Servono almeno ${FUTPOLI_RULES.minPlayersInMatchSheet} giocatori in distinta prima della conferma`,
        "MATCH_SHEET_TOO_SHORT"
      );
    }
  }

  await prisma.match.update({
    where: { id: matchId },
    data: team === "home" ? { homeSheetConfirmed: confirmed } : { awaySheetConfirmed: confirmed },
  });
  return { ok: true, leagueId: match.leagueId };
}

export async function updateMatchLifecycle(
  matchId: string,
  action: "postpone" | "cancel" | "restore"
) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      leagueId: true,
      date: true,
      originalDate: true,
      lifecycleStatus: true,
      resultStatus: true,
    },
  });
  if (!match) throw new AppError(404, "Partita non trovata", "MATCH_NOT_FOUND");
  if (match.resultStatus === "FINAL" && action !== "restore") {
    throw new AppError(409, "Riapri prima il risultato definitivo", "RESULT_FINAL");
  }
  if (match.resultStatus === "DRAFT" && action !== "restore") {
    throw new AppError(409, "Resetta prima la bozza di risultato per rinviare o annullare la gara", "DRAFT_RESULT_EXISTS");
  }

  const data = action === "postpone"
    ? {
        lifecycleStatus: "POSTPONED" as const,
        originalDate: match.originalDate ?? match.date,
        date: null,
        slotEnd: null,
        slotWeekStart: null,
        venueKey: null,
        venueName: null,
        venueAddress: null,
        bookedByUserId: null,
        bookedAt: null,
        refereeId: null,
        refereeManualOverride: false,
      }
    : action === "cancel"
      ? {
          lifecycleStatus: "CANCELLED" as const,
          originalDate: match.originalDate ?? match.date,
          date: null,
          slotEnd: null,
          slotWeekStart: null,
          venueKey: null,
          venueName: null,
          venueAddress: null,
          bookedByUserId: null,
          bookedAt: null,
          refereeId: null,
          refereeManualOverride: false,
        }
      : {
          lifecycleStatus: "SCHEDULED" as const,
          date: match.originalDate ?? match.date,
          originalDate: null,
        };

  await prisma.match.update({ where: { id: matchId }, data });
  return { ok: true, leagueId: match.leagueId, lifecycleStatus: data.lifecycleStatus };
}

export async function updateMatchExtras(
  matchId: string,
  input: { mvpPlayerId?: unknown; replayUrl?: unknown; highlightsUrl?: unknown }
) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      leagueId: true,
      homeTeamId: true,
      awayTeamId: true,
      resultStatus: true,
    },
  });
  if (!match) throw new AppError(404, "Partita non trovata", "MATCH_NOT_FOUND");
  if (match.resultStatus !== "FINAL") {
    throw new AppError(409, "MVP e contenuti possono essere associati solo a un risultato definitivo", "RESULT_NOT_FINAL");
  }

  let mvpPlayerId: string | null | undefined;
  if (input.mvpPlayerId !== undefined) {
    const candidate = String(input.mvpPlayerId ?? "").trim();
    if (!candidate) {
      mvpPlayerId = null;
    } else {
      const player = await prisma.player.findUnique({
        where: { id: candidate },
        select: { teamId: true },
      });
      if (!player || (player.teamId !== match.homeTeamId && player.teamId !== match.awayTeamId)) {
        throw new AppError(400, "MVP non valido per questa partita", "INVALID_MVP");
      }
      const appearance = await prisma.matchSheetPlayer.count({ where: { matchId, playerId: candidate } });
      if (appearance === 0) {
        throw new AppError(400, "L'MVP deve essere un giocatore presente in distinta", "MVP_NOT_IN_SHEET");
      }
      mvpPlayerId = candidate;
    }
  }

  const replayUrl = input.replayUrl === undefined ? undefined : cleanOptionalUrl(input.replayUrl);
  const highlightsUrl = input.highlightsUrl === undefined ? undefined : cleanOptionalUrl(input.highlightsUrl);

  await prisma.match.update({
    where: { id: matchId },
    data: {
      ...(mvpPlayerId !== undefined ? { mvpPlayerId } : {}),
      ...(replayUrl !== undefined ? { replayUrl } : {}),
      ...(highlightsUrl !== undefined ? { highlightsUrl } : {}),
    },
  });
  return { ok: true, leagueId: match.leagueId };
}
