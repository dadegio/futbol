import { getLeagueStats } from "@/modules/stats/application/league-stats-service";
import StatsPage from "@/modules/stats/presentation/StatsPage";

export default async function Page({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const stats = await getLeagueStats(leagueId);

  return <StatsPage leagueId={leagueId} initialStats={stats} />;
}
