import { prisma } from "@/lib/prisma";
import { isHexColor } from "@/lib/league-branding";
import type { SessionUser } from "@/lib/session";
import { AppError } from "@/modules/core/errors";
import { isCreator, isLeagueAdmin } from "@/modules/permissions/permissions";

function text(value: unknown, max = 300) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized.slice(0, max) : null;
}

function url(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.startsWith("/")) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[\w.-]+\.[a-z]{2,}([/?#].*)?$/i.test(raw)) return `https://${raw}`;
  return undefined;
}

function socialUrl(
  value: unknown,
  platform: "instagram" | "tiktok" | "youtube"
) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = raw
    .replace(/^@/, "")
    .replace(new RegExp(`^(www\\.)?${platform}\\.com/`, "i"), "")
    .split(/[/?#]/)[0]
    .replace(/^@/, "");
  if (!/^[a-zA-Z0-9._-]{1,80}$/.test(handle)) return undefined;
  if (platform === "instagram") return `https://instagram.com/${handle}`;
  if (platform === "tiktok") return `https://tiktok.com/@${handle}`;
  return `https://youtube.com/@${handle}`;
}

function parseProfile(input: Record<string, unknown>) {
  const displayName = text(input.displayName, 120);
  if (!displayName) throw new AppError(400, "Nome pubblico obbligatorio");

  const avatarUrl = url(input.avatarUrl);
  if (avatarUrl === undefined) throw new AppError(400, "URL avatar non valido");
  const websiteUrl = url(input.websiteUrl);
  if (websiteUrl === undefined) throw new AppError(400, "Sito/portfolio non valido");
  const instagramUrl = socialUrl(input.instagramUrl, "instagram");
  if (instagramUrl === undefined) throw new AppError(400, "Instagram non valido");
  const tiktokUrl = socialUrl(input.tiktokUrl, "tiktok");
  if (tiktokUrl === undefined) throw new AppError(400, "TikTok non valido");
  const youtubeUrl = socialUrl(input.youtubeUrl, "youtube");
  if (youtubeUrl === undefined) throw new AppError(400, "YouTube non valido");
  const email = text(input.email, 180);
  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    throw new AppError(400, "Email non valida");
  }
  const primaryColor = text(input.primaryColor, 20);
  if (primaryColor && !isHexColor(primaryColor)) {
    throw new AppError(400, "Colore profilo non valido");
  }

  return {
    displayName,
    roleLabel: text(input.roleLabel, 80),
    avatarUrl,
    bio: text(input.bio, 700),
    instagramUrl,
    tiktokUrl,
    youtubeUrl,
    email,
    phone: text(input.phone, 80),
    websiteUrl,
    primaryColor,
    showEmail: input.showEmail === true,
    showInstagram: input.showInstagram !== false,
    showTikTok: input.showTikTok !== false,
    showYoutube: input.showYoutube !== false,
    showPhone: input.showPhone === true,
    active: input.active !== false,
  };
}

async function getCreatorAccess(leagueId: string, session: SessionUser | null) {
  if (!session) throw new AppError(401, "Devi effettuare il login");

  if (isCreator(session, leagueId)) {
    const profile = await prisma.creatorProfile.upsert({
      where: { userId: session.userId },
      update: {},
      create: {
        userId: session.userId,
        leagueId,
        displayName: session.username,
        roleLabel: "Creator",
      },
    });
    return { profile, canAdmin: false };
  }

  if (isLeagueAdmin(session, leagueId)) {
    return { profile: null, canAdmin: true };
  }

  throw new AppError(403, "Accesso riservato a creator o admin");
}

export async function getCreatorWorkspace({
  leagueId,
  session,
}: {
  leagueId: string;
  session: SessionUser | null;
}) {
  const access = await getCreatorAccess(leagueId, session);
  const [league, teams, matches, media] = await Promise.all([
    prisma.league.findUnique({
      where: { id: leagueId },
      select: { id: true, name: true },
    }),
    prisma.team.findMany({
      where: { leagueId, activeInLeague: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        players: {
          orderBy: { number: "asc" },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            number: true,
          },
        },
      },
    }),
    prisma.match.findMany({
      where: { leagueId },
      orderBy: [{ round: "asc" }, { date: "asc" }],
      select: {
        id: true,
        round: true,
        date: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
      },
    }),
    prisma.mediaItem.findMany({
      where: {
        leagueId,
        ...(access.profile ? { creatorId: access.profile.id } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
  ]);

  return {
    profile: access.profile,
    canAdmin: access.canAdmin,
    league,
    teams,
    matches,
    media,
  };
}

export async function updateOwnCreatorProfile({
  leagueId,
  session,
  input,
}: {
  leagueId: string;
  session: SessionUser | null;
  input: Record<string, unknown>;
}) {
  const access = await getCreatorAccess(leagueId, session);
  if (!access.profile) {
    throw new AppError(400, "Seleziona un profilo creator specifico");
  }
  const data = parseProfile(input);
  return prisma.creatorProfile.update({
    where: { id: access.profile.id },
    data,
  });
}

export async function listCreators({
  leagueId,
  canAdmin,
}: {
  leagueId: string;
  canAdmin: boolean;
}) {
  const creators = await prisma.creatorProfile.findMany({
    where: { leagueId, ...(canAdmin ? {} : { active: true }) },
    orderBy: [{ displayName: "asc" }],
    select: {
      id: true,
      displayName: true,
      roleLabel: true,
      avatarUrl: true,
      bio: true,
      instagramUrl: true,
      tiktokUrl: true,
      youtubeUrl: true,
      email: true,
      phone: true,
      websiteUrl: true,
      primaryColor: true,
      showEmail: true,
      showInstagram: true,
      showTikTok: true,
      showYoutube: true,
      showPhone: true,
      active: true,
      _count: { select: { mediaItems: true } },
    },
  });

  if (canAdmin) return creators;
  return creators.map((creator) => ({
    ...creator,
    email: creator.showEmail ? creator.email : null,
    phone: creator.showPhone ? creator.phone : null,
    instagramUrl: creator.showInstagram ? creator.instagramUrl : null,
    tiktokUrl: creator.showTikTok ? creator.tiktokUrl : null,
    youtubeUrl: creator.showYoutube ? creator.youtubeUrl : null,
  }));
}