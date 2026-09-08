import type { SessionUser } from "@/lib/session";
import { getPlayerDetail, getPlayerStats } from "@/modules/players/application/player-service";

function toIsoString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return String(value);
}

export async function getPlayerPageData({
  playerId,
  session,
}: {
  playerId: string;
  session: SessionUser | null;
}) {
  const [rawPlayer, rawStats] = await Promise.all([
    getPlayerDetail({ playerId, session }),
    getPlayerStats({ playerId, session }),
  ]);

  const player = {
    ...rawPlayer,
    birthDate: toIsoString(rawPlayer.birthDate),
    signedAt: toIsoString(rawPlayer.signedAt),
  };

  const stats = {
    ...rawStats,
    recentMatches: rawStats.recentMatches.map((match) => ({
      ...match,
      date: toIsoString(match.date),
    })),
  };

  return { player, stats };
}