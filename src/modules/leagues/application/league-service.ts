import { prisma } from "@/lib/prisma";
import { isHexColor } from "@/modules/branding/domain/league-branding";
import { AppError } from "@/modules/core/errors";
import {
  normalizeOptionalUrl,
  PLAYOFF_COUNTS,
  PLAYOFF_FORMATS,
  THEME_MODES,
  uniqueStringIds,
} from "@/modules/leagues/domain/league-input";

type SessionLike = {
  role?: string | null;
  leagueId?: string | null;
} | null;

const LEAGUE_SELECT = {
  id: true,
  name: true,
  themeMode: true,
  brandLogoUrl: true,
  brandCoverUrl: true,
  brandPrimaryColor: true,
  brandSecondaryColor: true,
  brandBackgroundColor: true,
  cookieBannerEnabled: true,
  privacyPolicyUrl: true,
  cookiePolicyUrl: true,
  adsEnabled: true,
  adProvider: true,
  adClientId: true,
  adHomeSlot: true,
  adLeagueSlot: true,
  playoffFormat: true,
  playoffTeamCount: true,
  playoffSeeded: true,
} as const;

export async function listLeaguesForSession(session: SessionLike) {
  return prisma.league.findMany({
    where:
      (session?.role === "LEAGUE_ADMIN" || session?.role === "CREATOR") && session.leagueId
        ? { id: session.leagueId }
        : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      teams: {
        where: { activeInLeague: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          badgeUrl: true,
          players: {
            orderBy: { number: "asc" },
            select: {
              firstName: true,
              lastName: true,
              number: true,
              position: true,
              photoUrl: true,
              photoZoom: true,
              photoPositionX: true,
              photoPositionY: true,
              isTeamCaptain: true,
            },
          },
        },
      },
    },
  });
}

export async function createLeague(input: any) {
  const name = String(input?.name ?? "").trim();
  const themeMode = THEME_MODES.has(String(input?.themeMode ?? "GENERIC"))
    ? String(input?.themeMode ?? "GENERIC")
    : "GENERIC";

  if (!name) throw new AppError(400, "Nome lega mancante");

  const playoffEnabled = input?.playoffEnabled === true;
  const playoffFormat = String(input?.playoffFormat ?? "SINGLE_ELIM");
  const playoffTeamCount = Number(input?.playoffTeamCount ?? 8);
  const playoffSeeded = input?.playoffSeeded !== false;

  if (playoffEnabled && !PLAYOFF_FORMATS.has(playoffFormat)) {
    throw new AppError(400, "Formato playoff non valido");
  }

  if (playoffEnabled && !PLAYOFF_COUNTS.has(playoffTeamCount)) {
    throw new AppError(400, "Numero squadre playoff non valido");
  }

  const teamIdsToCopy = uniqueStringIds(input?.teamIdsToCopy);

  const sourceTeams = teamIdsToCopy.length
    ? await prisma.team.findMany({
        where: { id: { in: teamIdsToCopy } },
        include: {
          players: {
            orderBy: { number: "asc" },
          },
        },
      })
    : [];

  if (sourceTeams.length !== teamIdsToCopy.length) {
    throw new AppError(400, "Una o più squadre selezionate non sono più disponibili");
  }

  const normalizedNames = sourceTeams.map((team) => team.name.trim().toLocaleLowerCase("it"));
  if (new Set(normalizedNames).size !== normalizedNames.length) {
    throw new AppError(400, "Seleziona una sola versione per ogni squadra con lo stesso nome");
  }

  return prisma.$transaction(async (tx) => {
    const createdLeague = await tx.league.create({
      data: {
        name,
        themeMode,
        ...(playoffEnabled
          ? {
              playoffFormat: playoffFormat as "SINGLE_ELIM" | "TWO_LEG",
              playoffTeamCount,
              playoffSeeded,
            }
          : {}),
      },
    });

    for (const sourceTeam of sourceTeams) {
      const copiedTeam = await tx.team.create({
        data: {
          name: sourceTeam.name,
          badgeUrl: sourceTeam.badgeUrl,
          description: sourceTeam.description,
          colorHex: sourceTeam.colorHex,
          secondaryColorHex: sourceTeam.secondaryColorHex,
          leagueId: createdLeague.id,
        },
      });

      if (sourceTeam.players.length > 0) {
        await tx.player.createMany({
          data: sourceTeam.players.map((player) => ({
            firstName: player.firstName,
            lastName: player.lastName,
            number: player.number,
            position: player.position,
            photoUrl: player.photoUrl,
            photoZoom: player.photoZoom,
            photoPositionX: player.photoPositionX,
            photoPositionY: player.photoPositionY,
            isTeamCaptain: player.isTeamCaptain,
            fiscalCode: player.fiscalCode,
            birthDate: player.birthDate,
            documentSigned: player.documentSigned,
            signedAt: player.signedAt,
            privacyConsent: player.privacyConsent,
            internalPhotoConsent: player.internalPhotoConsent,
            publicPhotoConsent: player.publicPhotoConsent,
            mediaConsent: player.mediaConsent,
            healthDeclaration: player.healthDeclaration,
            wildcardUsed: player.wildcardUsed,
            status: player.status,
            statusNote: player.statusNote,
            teamId: copiedTeam.id,
          })),
        });
      }
    }

    return createdLeague;
  });
}

export async function getLeagueSettings(leagueId: string) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: LEAGUE_SELECT,
  });

  if (!league) throw new AppError(404, "Campionato non trovato");
  return league;
}

export async function updateLeagueSettings(leagueId: string, input: any) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, playoffFormat: true, themeMode: true },
  });

  if (!league) throw new AppError(404, "Campionato non trovato");

  const data: {
    name?: string;
    themeMode?: string;
    brandLogoUrl?: string | null;
    brandCoverUrl?: string | null;
    brandPrimaryColor?: string | null;
    brandSecondaryColor?: string | null;
    brandBackgroundColor?: string | null;
    cookieBannerEnabled?: boolean;
    privacyPolicyUrl?: string | null;
    cookiePolicyUrl?: string | null;
    adsEnabled?: boolean;
    adProvider?: string | null;
    adClientId?: string | null;
    adHomeSlot?: string | null;
    adLeagueSlot?: string | null;
    playoffFormat?: "SINGLE_ELIM" | "TWO_LEG" | null;
    playoffTeamCount?: number | null;
    playoffSeeded?: boolean;
  } = {};

  if (input?.name !== undefined) {
    const name = String(input.name).trim();
    if (!name) throw new AppError(400, "Nome torneo non valido");
    data.name = name;
  }

  if (input?.themeMode !== undefined) {
    const themeMode = String(input.themeMode).trim();
    if (!THEME_MODES.has(themeMode)) throw new AppError(400, "Tema torneo non valido");
    data.themeMode = themeMode;
  }

  for (const key of ["brandLogoUrl", "brandCoverUrl"] as const) {
    if (input?.[key] === undefined) continue;
    const value = normalizeOptionalUrl(input[key]);
    if (value === undefined) throw new AppError(400, "URL grafica non valido");
    data[key] = value;
  }

  for (const key of ["brandPrimaryColor", "brandSecondaryColor", "brandBackgroundColor"] as const) {
    if (input?.[key] === undefined) continue;
    const value = String(input[key] ?? "").trim();
    if (value && !isHexColor(value)) {
      throw new AppError(400, "Colore non valido: usa il formato #RRGGBB");
    }
    data[key] = value || null;
  }

  for (const key of ["privacyPolicyUrl", "cookiePolicyUrl"] as const) {
    if (input?.[key] === undefined) continue;
    const value = normalizeOptionalUrl(input[key]);
    if (value === undefined) throw new AppError(400, "URL policy non valido");
    data[key] = value;
  }

  if (input?.cookieBannerEnabled !== undefined) {
    data.cookieBannerEnabled = input.cookieBannerEnabled !== false;
  }

  if (input?.adsEnabled !== undefined) {
    data.adsEnabled = input.adsEnabled === true;
  }

  if (input?.adProvider !== undefined) {
    const provider = String(input.adProvider ?? "").trim().toUpperCase();
    data.adProvider = provider || null;
  }

  for (const key of ["adClientId", "adHomeSlot", "adLeagueSlot"] as const) {
    if (input?.[key] === undefined) continue;
    const value = String(input[key] ?? "").trim();
    data[key] = value || null;
  }

  if (input?.playoffEnabled !== undefined) {
    const enabled = input.playoffEnabled === true;

    if (!enabled) {
      const seriesCount = await prisma.playoffSeries.count({ where: { leagueId } });
      if (seriesCount > 0) {
        throw new AppError(
          400,
          "I playoff sono già stati creati. Eliminali dalla sezione Playoff prima di disattivarli."
        );
      }

      data.playoffFormat = null;
      data.playoffTeamCount = null;
      data.playoffSeeded = true;
    } else {
      const format = String(input?.playoffFormat ?? "SINGLE_ELIM").trim();
      const teamCount = Number(input?.playoffTeamCount ?? 8);
      const playoffSeeded = input?.playoffSeeded !== false;

      if (!PLAYOFF_FORMATS.has(format)) throw new AppError(400, "Formato playoff non valido");
      if (!PLAYOFF_COUNTS.has(teamCount)) throw new AppError(400, "Numero squadre playoff non valido");

      const teamsInLeague = await prisma.team.count({
        where: { leagueId, activeInLeague: true },
      });
      if (teamsInLeague < teamCount) {
        throw new AppError(
          400,
          `Servono almeno ${teamCount} squadre per questo playoff, ora ce ne sono ${teamsInLeague}.`
        );
      }

      data.playoffFormat = format as "SINGLE_ELIM" | "TWO_LEG";
      data.playoffTeamCount = teamCount;
      data.playoffSeeded = playoffSeeded;
    }
  }

  return prisma.league.update({
    where: { id: leagueId },
    data,
    select: LEAGUE_SELECT,
  });
}

export async function deleteLeague(leagueId: string) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true },
  });

  if (!league) throw new AppError(404, "Campionato non trovato");
  await prisma.league.delete({ where: { id: leagueId } });
  return { ok: true };
}
