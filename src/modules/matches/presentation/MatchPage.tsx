export const runtime = "nodejs";

import { notFound } from "next/navigation";
import { getMatchPageData } from "@/modules/matches/application/get-match-page-data";
import MatchResultForm from "./MatchResultForm";

export default async function MatchPage({
  params,
}: {
  params: Promise<{ leagueId: string; matchId: string }>;
}) {
  const { leagueId, matchId } = await params;
  const match = await getMatchPageData(leagueId, matchId);
  if (!match) return notFound();

  return <MatchResultForm match={JSON.parse(JSON.stringify(match))} />;
}
