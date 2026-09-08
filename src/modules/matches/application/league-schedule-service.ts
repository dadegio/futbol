import { prisma } from "@/lib/prisma";
import { generateRoundRobin } from "@/modules/matches/domain/scheduler";
import { rebalanceLeagueReferees } from "@/lib/automatic-referees";
import {
  getFirstFullSlotWeek,
  getFieldSlotOccurrences,
  getRoundSlotWeek,
  getSlotWeekWindow,
} from "@/lib/field-slots";
import {
  effectiveMatchEnd,
  refereeAllowsStart,
  refereeHasConflict,
} from "@/lib/referee-availability";
import { AppError } from "@/modules/core/api";

type SchedulePhase = "league" | "playoff" | "all";

type RefereeVisibilityOptions = {
  canSeeRefereeName: boolean;
};

function phaseWhere(phase: string | null): { seriesId?: null | { not: string } } {
  const normalized = (phase ?? "league") as SchedulePhase;
  if (normalized === "playoff") return { seriesId: { not: null as unknown as string } };
  if (normalized === "all") return {};
  return { seriesId: null };
}

export async function getLeagueSchedule({
  leagueId,
  phase,
  canSeeRefereeName,
}: {
  leagueId: string;
  phase: string | null;
} & RefereeVisibilityOptions) {
  const matches = await prisma.match.findMany({
    where: { leagueId, ...phaseWhere(phase) },
    orderBy: [{ round: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      leagueId: true,
      round: true,
      date: true,
      slotEnd: true,
      slotWeekStart: true,
      venueKey: true,
      venueName: true,
      venueAddress: true,
      referee: {
        select: {
          id: true,
          name: true,
        },
      },
      homeGoals: true,
      awayGoals: true,
      seriesId: true,
      leg: true,
      homeTeam: {
        select: {
          id: true,
          name: true,
          badgeUrl: true,
          colorHex: true,
          secondaryColorHex: true,
        },
      },
      awayTeam: {
        select: {
          id: true,
          name: true,
          badgeUrl: true,
          colorHex: true,
          secondaryColorHex: true,
        },
      },
    },
  });

  return matches.map((match) => ({
    ...match,
    referee: match.referee
      ? { id: match.referee.id, name: canSeeRefereeName ? match.referee.name : null }
      : null,
  }));
}

export async function createLeagueSchedule({
  leagueId,
  input,
}: {
  leagueId: string;
  input: Record<string, unknown>;
}) {
  const mode = String(input?.mode ?? "");

  if (mode === "manual") {
    return createManualMatch(leagueId, input);
  }

  return generateLeagueSchedule(leagueId, input);
}

async function createManualMatch(leagueId: string, input: Record<string, unknown>) {
  const round = Number(input?.round);
  const homeTeamId = String(input?.homeTeamId ?? "").trim();
  const awayTeamId = String(input?.awayTeamId ?? "").trim();
  const dateRaw = input?.date ? String(input.date).trim() : null;

  if (!Number.isInteger(round) || round <= 0) {
    throw new AppError(400, "Giornata non valida");
  }

  if (!homeTeamId || !awayTeamId) {
    throw new AppError(400, "Squadre mancanti");
  }

  if (homeTeamId === awayTeamId) {
    throw new AppError(400, "Una squadra non può giocare contro se stessa");
  }

  const teams = await prisma.team.findMany({
    where: {
      leagueId,
      activeInLeague: true,
      id: { in: [homeTeamId, awayTeamId] },
    },
    select: { id: true },
  });

  if (teams.length !== 2) {
    throw new AppError(400, "Squadre non valide per questa lega");
  }

  const date = dateRaw ? new Date(dateRaw) : null;

  if (dateRaw && Number.isNaN(date?.getTime())) {
    throw new AppError(400, "Data partita non valida");
  }

  const manualEnd = date ? effectiveMatchEnd(date, null) : null;

  try {
    const match = await prisma.match.create({
      data: {
        leagueId,
        round,
        homeTeamId,
        awayTeamId,
        refereeId: null,
        ...(date ? { date, slotEnd: manualEnd, slotWeekStart: getSlotWeekWindow(date).startsAt } : {}),
      },
    });

    if (date) await rebalanceLeagueReferees(leagueId);
    const updated = await prisma.match.findUnique({
      where: { id: match.id },
      include: { referee: { select: { id: true, name: true } } },
    });

    return updated ?? match;
  } catch {
    throw new AppError(400, "Partita duplicata o dati non validi");
  }
}

async function generateLeagueSchedule(leagueId: string, input: Record<string, unknown>) {
  const random = input?.random !== false;
  const doubleRound = input?.doubleRound !== false;
  const replace = input?.replace === true;
  const alternateHomeAway = input?.alternateHomeAway !== false;
  const schedulingMode = input?.schedulingMode === "fixed_slots" ? "fixed_slots" : "captain_booking";

  const seed =
    input?.seed === undefined || input?.seed === null || String(input.seed).trim() === ""
      ? undefined
      : Number(input.seed);

  if (seed !== undefined && !Number.isFinite(seed)) {
    throw new AppError(400, "Seed non valido");
  }

  const firstDateTime =
    input?.firstDateTime === undefined || input?.firstDateTime === null
      ? null
      : String(input.firstDateTime).trim();

  let firstKickoff: Date | null = null;

  if (firstDateTime) {
    firstKickoff = new Date(firstDateTime);

    if (Number.isNaN(firstKickoff.getTime())) {
      throw new AppError(400, "Data di inizio non valida");
    }
  }

  if (!firstKickoff) {
    throw new AppError(
      400,
      "Seleziona data e ora di inizio: serve per collegare ogni giornata alla propria settimana"
    );
  }

  const firstSlotWeek = getFirstFullSlotWeek(firstKickoff);

  const teams = await prisma.team.findMany({
    where: { leagueId, activeInLeague: true },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    select: { id: true },
  });

  const teamIds = teams.map((team) => team.id);

  if (teamIds.length < 2) {
    throw new AppError(
      400,
      `Servono almeno 2 squadre attive per generare il calendario. Al momento ne risultano ${teamIds.length}.`
    );
  }

  const existingMatches = await prisma.match.findMany({
    where: { leagueId, seriesId: null },
    select: {
      id: true,
      homeGoals: true,
      awayGoals: true,
    },
  });

  if (existingMatches.length > 0 && !replace) {
    throw new AppError(409, "Calendario già presente: usa Rigenera calendario per sostituirlo");
  }

  const existingMatchIds = existingMatches.map((match) => match.id);

  const [statsCount, sheetPlayersCount] =
    existingMatchIds.length > 0
      ? await Promise.all([
          prisma.matchPlayerStat.count({
            where: { matchId: { in: existingMatchIds } },
          }),
          prisma.matchSheetPlayer.count({
            where: { matchId: { in: existingMatchIds } },
          }),
        ])
      : [0, 0];

  const lockedByResult = existingMatches.filter(
    (match) => match.homeGoals !== null || match.awayGoals !== null
  );

  const hasProtectedData = lockedByResult.length > 0 || statsCount > 0 || sheetPlayersCount > 0;

  if (replace && hasProtectedData) {
    throw new AppError(
      400,
      `Non posso rigenerare: ci sono partite già compilate con risultati, statistiche o distinte (${lockedByResult.length}/${statsCount}/${sheetPlayersCount})`
    );
  }

  const pairings = generateRoundRobin(teamIds, {
    random,
    seed,
    alternateHomeAway,
    doubleRound,
  });

  const assignedSlots = new Map<string, ReturnType<typeof getFieldSlotOccurrences>[number]>();

  const activeFields =
    schedulingMode === "fixed_slots"
      ? await prisma.field.findMany({
          where: { leagueId, active: true },
          select: {
            id: true,
            name: true,
            address: true,
            slots: {
              select: {
                id: true,
                weekday: true,
                hour: true,
                minute: true,
                durationMinutes: true,
              },
            },
          },
          orderBy: { name: "asc" },
        })
      : [];

  if (schedulingMode === "fixed_slots" && activeFields.length === 0) {
    throw new AppError(
      409,
      "Inserisci almeno un campo attivo dalla pagina Admin prima di usare la programmazione automatica"
    );
  }

  if (schedulingMode === "fixed_slots") {
    const rounds = [...new Set(pairings.map((pairing) => pairing.round))];

    for (const round of rounds) {
      const week = getRoundSlotWeek(firstSlotWeek.startsAt, round);
      const roundPairings = pairings
        .map((pairing, index) => ({ pairing, index }))
        .filter(({ pairing }) => pairing.round === round);
      const occurrences = getFieldSlotOccurrences({
        from: week.startsAt,
        weeks: 1,
        fields: activeFields,
      }).filter((slot) => slot.startsAt.getTime() < week.endsAt.getTime());

      const occupied = await prisma.match.findMany({
        where: {
          venueKey: { not: null },
          date: {
            gte: week.startsAt,
            lt: week.endsAt,
          },
          ...(existingMatchIds.length ? { id: { notIn: existingMatchIds } } : {}),
        },
        select: { venueKey: true, date: true },
      });
      const occupiedKeys = new Set(
        occupied
          .filter((match) => match.venueKey && match.date)
          .map((match) => `${match.venueKey}:${match.date!.toISOString()}`)
      );
      const available = occurrences.filter(
        (slot) => !occupiedKeys.has(`${slot.venueKey}:${slot.startsAt.toISOString()}`)
      );

      if (available.length < roundPairings.length) {
        throw new AppError(
          409,
          `La settimana della giornata ${round} non ha abbastanza slot liberi (${available.length}/${roundPairings.length})`
        );
      }

      roundPairings.forEach(({ pairing, index }, slotIndex) => {
        const pairingKey = `${pairing.round}:${pairing.homeTeamId}:${pairing.awayTeamId}:${index}`;
        assignedSlots.set(pairingKey, available[slotIndex]);
      });
    }
  }

  const referees = await prisma.referee.findMany({
    where: { leagueId, active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      teamId: true,
      availabilities: { select: { weekday: true, hour: true, minute: true } },
    },
  });

  const protectedMatches = await prisma.match.findMany({
    where: {
      leagueId,
      date: { not: null },
      ...(existingMatchIds.length ? { id: { notIn: existingMatchIds } } : {}),
    },
    select: {
      id: true,
      date: true,
      slotEnd: true,
      homeTeamId: true,
      awayTeamId: true,
      refereeId: true,
    },
  });

  const plannedMatches = pairings.map((pairing, index) => {
    const pairingKey = `${pairing.round}:${pairing.homeTeamId}:${pairing.awayTeamId}:${index}`;
    const slot = assignedSlots.get(pairingKey);
    return {
      pairing,
      index,
      slot,
      slotWeek: getRoundSlotWeek(firstSlotWeek.startsAt, pairing.round),
      date: slot?.startsAt ?? null,
      slotEnd: slot?.endsAt ?? null,
    };
  });

  const alreadyAssigned: Array<{
    id: string;
    date: Date | null;
    slotEnd: Date | null;
    homeTeamId: string;
    awayTeamId: string;
    refereeId: string | null;
  }> = [];

  function refereeForPlannedMatch(planned: (typeof plannedMatches)[number]) {
    if (!planned.date || !planned.slotEnd || referees.length === 0) return null;
    const startsAt = planned.date;
    const endsAt = planned.slotEnd;
    const otherPlannedTeamMatches = plannedMatches
      .filter((candidate) => candidate.index !== planned.index && candidate.date)
      .map((candidate) => ({
        id: `planned-${candidate.index}`,
        date: candidate.date,
        slotEnd: candidate.slotEnd,
        homeTeamId: candidate.pairing.homeTeamId,
        awayTeamId: candidate.pairing.awayTeamId,
        refereeId: null,
      }));

    for (let offset = 0; offset < referees.length; offset += 1) {
      const referee = referees[(planned.index + offset) % referees.length];
      if (!referee) continue;
      if (referee.teamId === planned.pairing.homeTeamId || referee.teamId === planned.pairing.awayTeamId) continue;
      if (!refereeAllowsStart(referee.availabilities, startsAt)) continue;
      if (
        refereeHasConflict({
          refereeId: referee.id,
          teamId: referee.teamId,
          startsAt,
          endsAt,
          otherMatches: [...protectedMatches, ...otherPlannedTeamMatches, ...alreadyAssigned],
        })
      ) continue;
      alreadyAssigned.push({
        id: `assigned-${planned.index}`,
        date: startsAt,
        slotEnd: endsAt,
        homeTeamId: planned.pairing.homeTeamId,
        awayTeamId: planned.pairing.awayTeamId,
        refereeId: referee.id,
      });
      return referee.id;
    }
    return null;
  }

  const matchData = plannedMatches.map((planned) => ({
    leagueId,
    round: planned.pairing.round,
    homeTeamId: planned.pairing.homeTeamId,
    awayTeamId: planned.pairing.awayTeamId,
    slotWeekStart: planned.slotWeek.startsAt,
    refereeId: refereeForPlannedMatch(planned),
    ...(planned.slot
      ? {
          date: planned.slot.startsAt,
          slotEnd: planned.slot.endsAt,
          venueKey: planned.slot.venueKey,
          venueName: planned.slot.venueName,
          venueAddress: planned.slot.address,
          bookedAt: new Date(),
        }
      : {}),
  }));

  try {
    await prisma.$transaction([
      ...(replace
        ? [
            prisma.match.deleteMany({
              where: { leagueId, seriesId: null },
            }),
          ]
        : []),
      prisma.match.createMany({ data: matchData }),
    ]);
    await rebalanceLeagueReferees(leagueId);
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new AppError(
        409,
        "Uno degli slot è stato occupato durante la generazione. Riprova per ricalcolare il calendario."
      );
    }

    throw error;
  }

  const rounds = pairings.length ? Math.max(...pairings.map((pairing) => pairing.round)) : 0;

  return {
    created: pairings.length,
    rounds,
    scheduled: assignedSlots.size === pairings.length && pairings.length > 0,
    schedulingMode,
    programStartsAt: firstSlotWeek.startsAt,
  };
}
