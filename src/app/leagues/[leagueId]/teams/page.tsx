import { listLeagueTeams } from "@/modules/teams/application/team-service";
import TeamsPage from "@/modules/teams/presentation/TeamsPage";

export default async function Page({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const teams = await listLeagueTeams(leagueId);

  return <TeamsPage leagueId={leagueId} initialTeams={teams} />;
}
