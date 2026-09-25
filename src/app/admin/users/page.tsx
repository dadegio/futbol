import AdminUsersPage from "@/modules/admin/presentation/AdminUsersPage";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ leagueId?: string | string[] }>;
}) {
  const params = await searchParams;
  const leagueId = typeof params.leagueId === "string" ? params.leagueId : undefined;

  return <AdminUsersPage returnLeagueId={leagueId} />;
}
