import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/server-auth";
import { getPlayerPageData } from "@/modules/players/application/get-player-page-data";
import PlayerDetailPage from "@/modules/players/presentation/PlayerDetailPage";

export default async function Page({
  params,
}: {
  params: Promise<{ leagueId: string; playerId: string }>;
}) {
  const { leagueId, playerId } = await params;
  const session = await getServerSession();
  const { player, stats } = await getPlayerPageData({ playerId, session });

  if (player.team?.leagueId !== leagueId) notFound();

  return (
    <PlayerDetailPage
      leagueId={leagueId}
      playerId={playerId}
      initialPlayer={player}
      initialStats={stats}
    />
  );
}
