import { prisma } from "@/lib/prisma";
import {
  canSeeAdminPlayerDetails,
  sanitizePlayerForRole,
} from "@/modules/players/application/player-visibility";
import type { SessionUser } from "@/lib/session";
import {
  FUTPOLI_RULES,
  isPlayerEligibleForMatchSheet,
} from "@/modules/players/domain/tournament-rules";
import { AppError } from "@/modules/core/errors";
import { calculateLeagueTable } from "@/modules/stats/domain/league-table";

function normalizedNullableText(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return String(value).trim() || null;
}

function normalizedColor(value: unknown) {
  const text = normalizedNullableText(value);
  return typeof text === "string" ? text.toUpperCase() : text;
}

function assertColor(color: string | null | undefined, label: string) {
  if (color !== undefined && color !== null && !/^#[0-9A-F]{6}$/.test(color)) {
    throw new AppError(400, label);
  }
}

export async function listLeagueTeams(
  leagueId: string,
  session: SessionUser | null = null
) {
  const showAdminDetails = canSeeAdminPlayerDetails(session, leagueId);
  const now = new Date();

  const [teams, finalMatches, upcomingMatches, adminPlayers] = await Promise.all([
    prisma.team.findMany({
      where: { leagueId, activeInLeague: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        badgeUrl: true,
        description: true,
        colorHex: true,
        secondaryColorHex: true,
        activeInLeague: true,
        leagueId: true,
        _count: { select: { players: true } },
      },
    }),
    prisma.match.findMany({
      where: {
        leagueId,
        seriesId: null,
        resultStatus: "FINAL",
        homeGoals: { not: null },
        awayGoals: { not: null },
      },
      select: {
        homeTeamId: true,
        awayTeamId: true,
        homeGoals: true,
        awayGoals: true,
      },
    }),
    prisma.match.findMany({
      where: {
        leagueId,
        lifecycleStatus: "SCHEDULED",
        date: { gte: now },
      },
      orderBy: [{ date: "asc" }, { round: "asc" }],
      select: {
        id: true,
        round: true,
        date: true,
        seriesId: true,
        homeTeamId: true,
        awayTeamId: true,
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
      },
    }),
    showAdminDetails
      ? prisma.player.findMany({
          where: { team: { leagueId, activeInLeague: true } },
          select: {
            teamId: true,
            status: true,
            documentSigned: true,
            mediaConsent: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const table = calculateLeagueTable(
    teams.map((team) => ({ id: team.id, name: team.name, badgeUrl: team.badgeUrl })),
    finalMatches
  );
  const standingByTeam = new Map(table.map((row, index) => [row.teamId, { ...row, position: index + 1 }]));

  const nextByTeam = new Map<string, {
    id: string;
    round: number;
    date: string | null;
    phase: "league" | "playoff";
    opponent: { id: string; name: string };
    home: boolean;
  }>();

  for (const match of upcomingMatches) {
    if (!nextByTeam.has(match.homeTeamId)) {
      nextByTeam.set(match.homeTeamId, {
        id: match.id,
        round: match.round,
        date: match.date?.toISOString() ?? null,
        phase: match.seriesId ? "playoff" : "league",
        opponent: match.awayTeam,
        home: true,
      });
    }
    if (!nextByTeam.has(match.awayTeamId)) {
      nextByTeam.set(match.awayTeamId, {
        id: match.id,
        round: match.round,
        date: match.date?.toISOString() ?? null,
        phase: match.seriesId ? "playoff" : "league",
        opponent: match.homeTeam,
        home: false,
      });
    }
  }

  const adminByTeam = new Map<string, { eligiblePlayers: number; attentionPlayers: number }>();
  if (showAdminDetails) {
    for (const player of adminPlayers) {
      const current = adminByTeam.get(player.teamId) ?? { eligiblePlayers: 0, attentionPlayers: 0 };
      if (isPlayerEligibleForMatchSheet(player)) current.eligiblePlayers += 1;
      else current.attentionPlayers += 1;
      adminByTeam.set(player.teamId, current);
    }
  }

  return teams.map((team) => ({
    ...team,
    standing: standingByTeam.get(team.id) ?? null,
    nextMatch: nextByTeam.get(team.id) ?? null,
    ...(showAdminDetails
      ? {
          adminRoster: adminByTeam.get(team.id) ?? {
            eligiblePlayers: 0,
            attentionPlayers: team._count.players,
          },
        }
      : {}),
  }));
}

export async function createLeagueTeam({
  leagueId,
  input,
}: {
  leagueId: string;
  input: Record<string, unknown>;
}) {
  const name = String(input.name ?? "").trim();
  const badgeUrl = normalizedNullableText(input.badgeUrl);
  const description = normalizedNullableText(input.description);
  const colorHex = normalizedColor(input.colorHex);
  const secondaryColorHex = normalizedColor(input.secondaryColorHex);

  if (!name) throw new AppError(400, "Nome squadra mancante");
  assertColor(colorHex, "Primo colore maglia non valido");
  assertColor(secondaryColorHex, "Secondo colore maglia non valido");

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true },
  });
  if (!league) throw new AppError(400, "Lega non valida");

  try {
    return await prisma.team.create({
      data: {
        name,
        badgeUrl: badgeUrl || undefined,
        description: description || undefined,
        colorHex: colorHex || undefined,
        secondaryColorHex: secondaryColorHex || undefined,
        activeInLeague: true,
        league: { connect: { id: leagueId } },
      },
    });
  } catch {
    throw new AppError(400, "Squadra già esistente (stessa lega) o errore dati");
  }
}

export async function listAllTeams() {
  const teams = await prisma.team.findMany({
    orderBy: [{ name: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      badgeUrl: true,
      description: true,
      colorHex: true,
      secondaryColorHex: true,
      activeInLeague: true,
      league: { select: { id: true, name: true } },
      _count: { select: { players: true } },
    },
  });

  return teams.map(({ _count, ...team }) => ({
    ...team,
    playersCount: _count.players,
  }));
}

function resultForTeam(
  teamId: string,
  match: { homeTeamId: string; awayTeamId: string; homeGoals: number | null; awayGoals: number | null }
) {
  if (match.homeGoals === null || match.awayGoals === null) return null;
  const home = match.homeTeamId === teamId;
  const gf = home ? match.homeGoals : match.awayGoals;
  const ga = home ? match.awayGoals : match.homeGoals;
  return gf > ga ? "W" as const : gf < ga ? "L" as const : "D" as const;
}

export async function getTeamDetail({
  teamId,
  session,
}: {
  teamId: string;
  session: SessionUser | null;
}) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      league: { select: { id: true, name: true } },
      players: {
        orderBy: { number: "asc" },
        include: {
          stats: {
            where: { match: { resultStatus: "FINAL" } },
            select: { goals: true, assists: true },
          },
          sheetEntries: {
            where: { match: { resultStatus: "FINAL" } },
            select: { id: true },
          },
        },
      },
    },
  });
  if (!team) throw new AppError(404, "Squadra non trovata");

  const [finalMatches, nextMatch] = await Promise.all([
    prisma.match.findMany({
      where: {
        leagueId: team.league.id,
        seriesId: null,
        resultStatus: "FINAL",
        OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
      },
      orderBy: [{ date: "desc" }, { round: "desc" }],
      select: {
        id: true,
        round: true,
        date: true,
        homeTeamId: true,
        awayTeamId: true,
        homeGoals: true,
        awayGoals: true,
      },
    }),
    prisma.match.findFirst({
      where: {
        leagueId: team.league.id,
        lifecycleStatus: "SCHEDULED",
        date: { gte: new Date() },
        OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
      },
      orderBy: [{ date: "asc" }, { round: "asc" }],
      select: {
        id: true,
        round: true,
        date: true,
        seriesId: true,
        venueName: true,
        homeTeamId: true,
        awayTeamId: true,
        homeTeam: { select: { id: true, name: true, badgeUrl: true } },
        awayTeam: { select: { id: true, name: true, badgeUrl: true } },
      },
    }),
  ]);

  const showAdminDetails = canSeeAdminPlayerDetails(session, team.league.id);
  const players = team.players.map(({ stats, sheetEntries, ...player }) => {
    const appearances = sheetEntries.length;
    return sanitizePlayerForRole(
      {
        ...player,
        goals: stats.reduce((sum, row) => sum + row.goals, 0),
        assists: stats.reduce((sum, row) => sum + row.assists, 0),
        appearances,
        ...(showAdminDetails
          ? { feeCents: appearances * FUTPOLI_RULES.playerFeeCentsPerAppearance }
          : {}),
      },
      session,
      team.league.id
    );
  });

  const competition = finalMatches.reduce(
    (acc, match) => {
      if (match.homeGoals === null || match.awayGoals === null) return acc;
      const home = match.homeTeamId === team.id;
      const gf = home ? match.homeGoals : match.awayGoals;
      const ga = home ? match.awayGoals : match.homeGoals;
      acc.played += 1;
      acc.gf += gf;
      acc.ga += ga;
      if (gf > ga) { acc.wins += 1; acc.points += 3; }
      else if (gf < ga) acc.losses += 1;
      else { acc.draws += 1; acc.points += 1; }
      return acc;
    },
    { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, points: 0 }
  );

  const next = nextMatch
    ? {
        id: nextMatch.id,
        round: nextMatch.round,
        phase: nextMatch.seriesId ? "playoff" as const : "league" as const,
        date: nextMatch.date?.toISOString() ?? null,
        venueName: nextMatch.venueName,
        home: nextMatch.homeTeamId === team.id,
        opponent: nextMatch.homeTeamId === team.id ? nextMatch.awayTeam : nextMatch.homeTeam,
      }
    : null;

  return {
    ...team,
    players,
    competitionSummary: {
      ...competition,
      gd: competition.gf - competition.ga,
      form: finalMatches
        .slice(0, 5)
        .map((match) => resultForTeam(team.id, match))
        .filter((result): result is "W" | "D" | "L" => result !== null),
      nextMatch: next,
    },
  };
}

export async function updateTeam({
  teamId,
  input,
}: {
  teamId: string;
  input: Record<string, unknown>;
}) {
  const name = input.name !== undefined ? String(input.name).trim() : undefined;
  const badgeUrl = normalizedNullableText(input.badgeUrl);
  const description = normalizedNullableText(input.description);
  const colorHex = normalizedColor(input.colorHex);
  const secondaryColorHex = normalizedColor(input.secondaryColorHex);
  const kitHomeUrl = normalizedNullableText(input.kitHomeUrl);
  const kitAwayUrl = normalizedNullableText(input.kitAwayUrl);
  const kitGoalkeeperUrl = normalizedNullableText(input.kitGoalkeeperUrl);

  if (name !== undefined && !name) {
    throw new AppError(400, "Nome squadra non valido");
  }
  assertColor(colorHex, "Primo colore maglia non valido");
  assertColor(secondaryColorHex, "Secondo colore maglia non valido");

  const existing = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, leagueId: true },
  });
  if (!existing) throw new AppError(404, "Squadra non trovata");

  if (name) {
    const duplicate = await prisma.team.findUnique({
      where: { leagueId_name: { leagueId: existing.leagueId, name } },
      select: { id: true },
    });
    if (duplicate && duplicate.id !== teamId) {
      throw new AppError(409, "Squadra già esistente in questa lega");
    }
  }

  return prisma.team.update({
    where: { id: teamId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(badgeUrl !== undefined ? { badgeUrl } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(colorHex !== undefined ? { colorHex } : {}),
      ...(secondaryColorHex !== undefined ? { secondaryColorHex } : {}),
      ...(kitHomeUrl !== undefined ? { kitHomeUrl } : {}),
      ...(kitAwayUrl !== undefined ? { kitAwayUrl } : {}),
      ...(kitGoalkeeperUrl !== undefined ? { kitGoalkeeperUrl } : {}),
    },
    include: {
      league: { select: { id: true, name: true } },
      players: { orderBy: { number: "asc" } },
    },
  });
}

export async function removeTeamFromLeague({
  teamId,
  requestedLeagueId,
}: {
  teamId: string;
  requestedLeagueId: string | null;
}) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      name: true,
      leagueId: true,
      activeInLeague: true,
      badgeUrl: true,
      description: true,
      colorHex: true,
      secondaryColorHex: true,
      captain: { select: { id: true } },
      _count: {
        select: {
          players: true,
          sheetPlayers: true,
          homeSeries: true,
          awaySeries: true,
          wonSeries: true,
        },
      },
    },
  });

  if (!team || (requestedLeagueId && team.leagueId !== requestedLeagueId)) {
    throw new AppError(404, "Squadra non trovata in questo torneo");
  }
  if (!team.activeInLeague) {
    throw new AppError(409, "La squadra è già stata rimossa dal torneo");
  }

  const playoffReferences =
    team._count.homeSeries + team._count.awaySeries + team._count.wonSeries;
  if (playoffReferences > 0) {
    throw new AppError(
      409,
      "La squadra è collegata al tabellone playoff. Elimina o reimposta prima i playoff, poi riprova."
    );
  }

  const matches = await prisma.match.findMany({
    where: { OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
    select: {
      id: true,
      homeGoals: true,
      awayGoals: true,
      _count: { select: { stats: true, sheetPlayers: true } },
    },
  });

  const disposableMatchIds = matches
    .filter(
      (match) =>
        match.homeGoals === null &&
        match.awayGoals === null &&
        match._count.stats === 0 &&
        match._count.sheetPlayers === 0
    )
    .map((match) => match.id);

  const hasHistoricalMatches = disposableMatchIds.length !== matches.length;
  const hasStoredTeamData = Boolean(
    team.badgeUrl ||
      team.description ||
      team.colorHex ||
      team.secondaryColorHex ||
      team.captain ||
      team._count.players > 0 ||
      team._count.sheetPlayers > 0 ||
      hasHistoricalMatches
  );

  const result = await prisma.$transaction(async (tx) => {
    if (disposableMatchIds.length > 0) {
      await tx.match.deleteMany({ where: { id: { in: disposableMatchIds } } });
    }

    if (!hasStoredTeamData) {
      await tx.team.delete({ where: { id: teamId } });
      return {
        mode: "deleted" as const,
        message: "Squadra vuota eliminata definitivamente",
      };
    }

    await tx.team.update({
      where: { id: teamId },
      data: { activeInLeague: false },
    });
    return {
      mode: "removed" as const,
      message: "Squadra rimossa dal torneo; rosa e dati salvati restano disponibili",
    };
  });

  return { ok: true, ...result, leagueId: team.leagueId, teamName: team.name };
}
