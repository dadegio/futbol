import { getPlayoffs } from "@/modules/playoffs/application/playoff-service";
import { listLeagueTeams } from "@/modules/teams/application/team-service";
import PlayoffsPage from "@/modules/playoffs/presentation/PlayoffsPage";

export default async function Page({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const [data, teams] = await Promise.all([
    getPlayoffs(leagueId),
    listLeagueTeams(leagueId),
  ]);

  return (
    <PlayoffsPage
      leagueId={leagueId}
      initialData={data}
      initialTeamCount={teams.length}
    />
  );
}
