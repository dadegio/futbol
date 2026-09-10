import { getServerSession } from "@/modules/auth/server-session";
import { listLeagueTeams } from "@/modules/teams/application/team-service";
import TeamsPage from "@/modules/teams/presentation/TeamsPage";

export default async function Page({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const session = await getServerSession();
  const teams = await listLeagueTeams(leagueId, session);

  return <TeamsPage leagueId={leagueId} initialTeams={teams} />;
}
