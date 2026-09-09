import { prisma } from "@/lib/prisma";
import {
  canSeeAdminPlayerDetails,
  sanitizePlayerForRole,
} from "@/lib/player-visibility";
import type { SessionUser } from "@/lib/session";
import { FUTPOLI_RULES } from "@/modules/players/domain/tournament-rules";
import { AppError } from "@/modules/core/errors";

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

export async function listLeagueTeams(leagueId: string) {
  return prisma.team.findMany({
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
  });
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
          stats: { select: { goals: true, assists: true } },
          sheetEntries: { select: { id: true } },
        },
      },
    },
  });
  if (!team) throw new AppError(404, "Squadra non trovata");

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

  return { ...team, players };
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

  return { ok: true, ...result };
}