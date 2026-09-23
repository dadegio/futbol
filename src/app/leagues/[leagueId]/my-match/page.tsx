import { redirect } from "next/navigation";

export default async function MyMatchPage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  redirect(`/leagues/${leagueId}/referee`);
}
