import Link from "next/link";
import { CalendarClock, CheckCircle2, MapPin, ShieldCheck } from "lucide-react";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card from "src/app/_components/ui/card";
import Badge from "src/app/_components/ui/badge";
import { getServerSession } from "@/modules/auth/server-session";
import { getRefereeMatchday } from "@/modules/referees/application/referee-matchday-service";

function formatDate(value: Date | null) {
  if (!value) return "Data da assegnare";
  return value.toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function MyMatchPage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const session = await getServerSession();

  if (!session || session.role !== "REFEREE" || !session.refereeId || session.leagueId !== leagueId) {
    return (
      <DashboardShell leagueId={leagueId}>
        <Card>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)]">Matchday arbitro</p>
          <h1 className="mt-2 text-2xl font-black text-[var(--foreground)]">Accesso riservato agli arbitri</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Accedi con l'account arbitro associato a questo torneo.</p>
        </Card>
      </DashboardShell>
    );
  }

  const matches = await getRefereeMatchday(session.refereeId, leagueId);
  const primary = matches[0] ?? null;

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="space-y-5 pb-8">
        <header className="pt-2">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)]">Matchday arbitro</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] text-[var(--foreground)]">La mia partita</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Le gare assegnate a te, con accesso rapido a distinta e risultato.</p>
        </header>

        {!primary ? (
          <Card className="text-center">
            <CheckCircle2 size={28} className="mx-auto text-emerald-400" />
            <p className="mt-3 font-black text-[var(--foreground)]">Nessuna gara da gestire</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Non risultano partite assegnate con risultato ancora da finalizzare.</p>
          </Card>
        ) : (
          <Card className="overflow-hidden !p-0">
            <div className="matchroom-hero p-5 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant={primary.isToday ? "success" : "accent"}>{primary.isToday ? "OGGI" : `Giornata ${primary.round}`}</Badge>
                {primary.resultStatus === "DRAFT" && <Badge variant="accent">Bozza salvata</Badge>}
              </div>
              <div className="mt-6 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 text-center">
                <p className="truncate text-lg font-black text-[var(--foreground)] sm:text-2xl">{primary.homeTeam.name}</p>
                <span className="text-sm font-black text-[var(--muted)]">VS</span>
                <p className="truncate text-lg font-black text-[var(--foreground)] sm:text-2xl">{primary.awayTeam.name}</p>
              </div>
              <div className="mt-6 grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-2">
                <span className="inline-flex items-center gap-2"><CalendarClock size={15} className="text-[var(--accent)]" />{formatDate(primary.date)}</span>
                <span className="inline-flex items-center gap-2"><MapPin size={15} className="text-[var(--accent)]" />{primary.venueName ?? "Campo da assegnare"}</span>
              </div>
              <Link href={`/leagues/${leagueId}/matches/${primary.id}`} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 text-sm font-black text-black">
                <ShieldCheck size={17} /> Gestisci partita
              </Link>
            </div>
          </Card>
        )}

        {matches.length > 1 && (
          <Card>
            <p className="text-sm font-black text-[var(--foreground)]">Altre gare assegnate</p>
            <div className="mt-3 space-y-2">
              {matches.slice(1, 6).map((match) => (
                <Link key={match.id} href={`/leagues/${leagueId}/matches/${match.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-3">
                  <div className="min-w-0"><p className="truncate text-sm font-black text-[var(--foreground)]">{match.homeTeam.name} vs {match.awayTeam.name}</p><p className="mt-0.5 text-xs text-[var(--muted)]">{formatDate(match.date)}</p></div>
                  <span className="shrink-0 text-xs font-black text-[var(--accent)]">Apri →</span>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
