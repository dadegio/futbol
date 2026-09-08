import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/server-auth";
import { getTeamDetail } from "@/modules/teams/application/team-service";
import TeamDetailPage from "@/modules/teams/presentation/TeamDetailPage";

export default async function Page({
  params,
}: {
  params: Promise<{ leagueId: string; teamId: string }>;
}) {
  const { leagueId, teamId } = await params;
  const session = await getServerSession();
  const team = await getTeamDetail({ teamId, session });

  if (team.league.id !== leagueId) notFound();

  return (
    <TeamDetailPage
      leagueId={leagueId}
      teamId={teamId}
      initialTeam={team}
    />
  );
}
