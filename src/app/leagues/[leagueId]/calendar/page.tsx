import { getServerSession, isLeagueAdminSession } from "@/modules/permissions/server-guards";
import { getLeagueSchedule } from "@/modules/matches/application/league-schedule-service";
import { listLeagueTeams } from "@/modules/teams/application/team-service";
import CalendarPage from "@/modules/matches/presentation/CalendarPage";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ round?: string | string[] }>;
}) {
  const { leagueId } = await params;
  const query = await searchParams;
  const requestedRound = typeof query.round === "string" ? Number(query.round) : null;
  const initialRound =
    requestedRound !== null && Number.isInteger(requestedRound) && requestedRound > 0
      ? requestedRound
      : null;
  const session = await getServerSession();
  const canSeeRefereeName = isLeagueAdminSession(session, leagueId);
  const canSeeCreatorCrew = canSeeRefereeName || Boolean(
    session?.role === "CAPTAIN" && session.leagueId === leagueId
  );
  const [matches, teams] = await Promise.all([
    getLeagueSchedule({ leagueId, phase: "league", canSeeRefereeName, canSeeCreatorCrew }),
    listLeagueTeams(leagueId),
  ]);

  return (
    <CalendarPage
      leagueId={leagueId}
      initialMatches={matches}
      initialTeamCount={teams.length}
      initialRound={initialRound}
    />
  );
}
