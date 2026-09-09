import { prisma } from "@/lib/prisma";
import { AppError } from "@/modules/core/errors";
import { getServerSession } from "@/modules/auth/server-session";
import { isCreatorSession, isLeagueAdminSession } from "@/modules/permissions/server-guards";
import {
  MEDIA_TYPES,
  parseMediaCreateInput,
  parseMediaPatchInput,
} from "@/modules/media/domain/media-input";

export async function getMediaSessionContext(leagueId: string) {
  const session = await getServerSession();
  const canAdmin = isLeagueAdminSession(session, leagueId);
  const creatorSession = isCreatorSession(session, leagueId);
  let creatorId: string | null = null;

  if (session && creatorSession) {
    const profile = await prisma.creatorProfile.upsert({
      where: { userId: session.userId },
      update: {},
      create: {
        userId: session.userId,
        leagueId,
        displayName: session.username,
        roleLabel: "Creator",
      },
      select: { id: true },
    });
    creatorId = profile.id;
  }

  return { session, canAdmin, isCreator: creatorSession, creatorId };
}

function publicMediaItem(item: any) {
  return {
    ...item,
    creditEmail: item.showCreditEmail ? item.creditEmail : null,
    creator: item.creator
      ? {
          ...item.creator,
          email: item.creator.showEmail ? item.creator.email : null,
          instagramUrl: item.creator.showInstagram ? item.creator.instagramUrl : null,
          tiktokUrl: item.creator.showTikTok ? item.creator.tiktokUrl : null,
          youtubeUrl: item.creator.showYoutube ? item.creator.youtubeUrl : null,
        }
      : null,
  };
}

export async function listLeagueMedia({
  leagueId,
  searchParams,
}: {
  leagueId: string;
  searchParams: URLSearchParams;
}) {
  const { canAdmin, creatorId } = await getMediaSessionContext(leagueId);
  const includeAll = canAdmin && searchParams.get("includeAll") === "1";
  const onlyMine = searchParams.get("mine") === "1";
  const type = searchParams.get("type");
  const creator = searchParams.get("creatorId");
  const matchId = searchParams.get("matchId");
  const teamId = searchParams.get("teamId");
  const playerId = searchParams.get("playerId");
  const roundParam = searchParams.get("round");

  const where: any = { leagueId };
  if (!includeAll) {
    if (onlyMine && creatorId) {
      where.creatorId = creatorId;
    } else {
      where.status = "APPROVED";
    }
  }
  if (type && MEDIA_TYPES.has(type)) where.type = type;
  if (creator) where.creatorId = creator;
  if (matchId) where.matchId = matchId;
  if (teamId) where.teamId = teamId;
  if (playerId) where.playerId = playerId;
  if (roundParam && /^\d+$/.test(roundParam)) where.round = Number(roundParam);

  const media = await prisma.mediaItem.findMany({
    where,
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    include: {
      creator: {
        select: {
          id: true,
          displayName: true,
          roleLabel: true,
          avatarUrl: true,
          instagramUrl: true,
          tiktokUrl: true,
          youtubeUrl: true,
          email: true,
          showEmail: true,
          showInstagram: true,
          showTikTok: true,
          showYoutube: true,
        },
      },
    },
  });

  return canAdmin ? media : media.map(publicMediaItem);
}

export async function createMediaItem({
  leagueId,
  input,
}: {
  leagueId: string;
  input: Record<string, unknown>;
}) {
  const { session, canAdmin, isCreator, creatorId } = await getMediaSessionContext(leagueId);

  if (!session || (!canAdmin && !isCreator)) {
    throw new AppError(403, "Accesso riservato a creator o admin");
  }

  const parsed = parseMediaCreateInput(input, canAdmin);
  if ("error" in parsed) throw new AppError(400, parsed.error);

  return prisma.mediaItem.create({
    data: {
      ...(parsed.data as any),
      leagueId,
      creatorId,
      uploadedByUserId: session.userId,
      creditName: parsed.data.creditName || (creatorId ? undefined : session.username),
    },
  });
}

async function getMediaAccess(mediaId: string) {
  const session = await getServerSession();
  if (!session) throw new AppError(401, "Devi effettuare il login");

  const media = await prisma.mediaItem.findUnique({
    where: { id: mediaId },
    include: { creator: { select: { userId: true } } },
  });
  if (!media) throw new AppError(404, "Contenuto non trovato");

  const canAdmin = isLeagueAdminSession(session, media.leagueId);
  const canOwner = isCreatorSession(session, media.leagueId) && media.creator?.userId === session.userId;
  if (!canAdmin && !canOwner) throw new AppError(403, "Non autorizzato");

  return { session, media, canAdmin, canOwner };
}

export async function updateMediaItem({
  mediaId,
  input,
}: {
  mediaId: string;
  input: Record<string, unknown>;
}) {
  const access = await getMediaAccess(mediaId);
  const parsed = parseMediaPatchInput(input, access.canAdmin, access.media.status);
  if ("error" in parsed) throw new AppError(400, parsed.error);

  return prisma.mediaItem.update({ where: { id: mediaId }, data: parsed.data as any });
}

export async function deleteMediaItem({ mediaId }: { mediaId: string }) {
  const access = await getMediaAccess(mediaId);

  if (!access.canAdmin && access.media.status === "APPROVED") {
    throw new AppError(403, "Un contenuto approvato può essere rimosso solo dall'admin");
  }

  await prisma.mediaItem.delete({ where: { id: mediaId } });
  return { ok: true, leagueId: access.media.leagueId, status: access.media.status };
}
