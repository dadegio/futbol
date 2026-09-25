import DashboardShell from "src/app/_components/dashboard-shell";
import Card from "src/app/_components/ui/card";
import { getServerSession } from "@/modules/auth/server-session";
import { getCoachLineupData } from "@/modules/coaches/application/coach-lineup-service";
import CoachLineupEditor from "@/modules/coaches/presentation/CoachLineupEditor";

export default async function CoachLineupPage({
  params,
}: {
  params: Promise<{ leagueId: string; matchId: string }>;
}) {
  const { leagueId, matchId } = await params;
  const session = await getServerSession();

  try {
    const data = await getCoachLineupData(session, leagueId, matchId);
    return (
      <CoachLineupEditor
        leagueId={leagueId}
        initialData={JSON.parse(JSON.stringify(data))}
      />
    );
  } catch {
    return (
      <DashboardShell leagueId={leagueId}>
        <Card>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)]">
            Coach Mode
          </p>
          <h1 className="mt-2 text-2xl font-black text-[var(--foreground)]">
            Formazione non disponibile
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            La partita non appartiene alla tua squadra oppure il tuo account non è associato a questo torneo.
          </p>
        </Card>
      </DashboardShell>
    );
  }
}
