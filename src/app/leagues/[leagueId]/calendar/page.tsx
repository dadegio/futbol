import { getServerSession, isLeagueAdminSession } from "@/modules/permissions/server-guards";
import { getLeagueSchedule } from "@/modules/matches/application/league-schedule-service";
import { listLeagueTeams } from "@/modules/teams/application/team-service";
import CalendarPage from "@/modules/matches/presentation/CalendarPage";

export default async function Page({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const session = await getServerSession();
  const canSeeRefereeName = isLeagueAdminSession(session, leagueId);
  const [matches, teams] = await Promise.all([
    getLeagueSchedule({ leagueId, phase: "league", canSeeRefereeName }),
    listLeagueTeams(leagueId),
  ]);

  return (
    <CalendarPage
      leagueId={leagueId}
      initialMatches={matches}
      initialTeamCount={teams.length}
    />
  );
}
