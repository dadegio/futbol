import Link from "next/link";
import { CalendarClock, CheckCircle2, Clock3, MapPin, ShieldCheck } from "lucide-react";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card from "src/app/_components/ui/card";
import Badge from "src/app/_components/ui/badge";
import { getServerSession } from "@/modules/auth/server-session";
import { getRefereeSchedule } from "@/modules/referees/application/referee-matchday-service";

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

function monthLabel(value: Date | null) {
  if (!value) return "Da programmare";
  const label = value.toLocaleDateString("it-IT", {
    timeZone: "Europe/Rome",
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

type RefereeTeam = {
  id: string;
  name: string;
  badgeUrl: string | null;
  colorHex: string | null;
  secondaryColorHex: string | null;
};

function safeTeamColor(value: string | null | undefined, fallback = "#64748B") {
  return value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback;
}

function TeamLogo({ team, large = false }: { team: RefereeTeam; large?: boolean }) {
  const initials = team.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const classes = large ? "h-16 w-16 rounded-2xl sm:h-20 sm:w-20" : "h-10 w-10 rounded-xl";

  if (team.badgeUrl) {
    return (
      <div
        className={`grid shrink-0 place-items-center ${classes}`}
        style={{ background: `linear-gradient(135deg, ${safeTeamColor(team.colorHex)}24, ${safeTeamColor(team.secondaryColorHex ?? team.colorHex)}24)` }}
      >
        <img src={team.badgeUrl} alt={`Logo ${team.name}`} className="h-[82%] w-[82%] object-contain" />
      </div>
    );
  }

  return (
    <div
      className={`grid shrink-0 place-items-center text-xs font-black text-white ${classes}`}
      style={{ background: `linear-gradient(135deg, ${safeTeamColor(team.colorHex)}, ${safeTeamColor(team.secondaryColorHex ?? team.colorHex)})` }}
    >
      {initials || "?"}
    </div>
  );
}

function TeamIdentity({ team, align = "center" }: { team: RefereeTeam; align?: "left" | "center" | "right" }) {
  const primary = safeTeamColor(team.colorHex);
  const secondary = safeTeamColor(team.secondaryColorHex ?? team.colorHex);

  return (
    <div className={`flex min-w-0 flex-col ${align === "left" ? "items-start" : align === "right" ? "items-end" : "items-center"} gap-2`}>
      <TeamLogo team={team} large />
      <p className={`max-w-full truncate text-lg font-black text-[var(--foreground)] sm:text-2xl ${align === "right" ? "text-right" : align === "left" ? "text-left" : "text-center"}`}>
        {team.name}
      </p>
      <span className="h-1 w-14 rounded-full" style={{ background: `linear-gradient(90deg, ${primary} 0 50%, ${secondary} 50% 100%)` }} />
    </div>
  );
}

export default async function RefereeWorkspacePage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const session = await getServerSession();

  if (!session || session.role !== "REFEREE" || !session.refereeId || session.leagueId !== leagueId) {
    return (
      <DashboardShell leagueId={leagueId}>
        <Card>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)]">Area arbitro</p>
          <h1 className="mt-2 text-2xl font-black text-[var(--foreground)]">Accesso riservato agli arbitri</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Accedi con l'account arbitro associato a questo torneo.</p>
        </Card>
      </DashboardShell>
    );
  }

  const schedule = await getRefereeSchedule(session.refereeId, leagueId);
  const grouped = new Map<string, typeof schedule.matches>();
  for (const match of schedule.matches) {
    const key = monthLabel(match.date);
    grouped.set(key, [...(grouped.get(key) ?? []), match]);
  }

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="space-y-5 pb-8">
        <header className="pt-2">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)]">Area arbitro</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] text-[var(--foreground)]">Il mio calendario</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Tutte le gare assegnate, quelle da completare e lo storico dei referti già chiusi.</p>
        </header>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            ["Prossime", schedule.summary.upcoming],
            ["Oggi", schedule.summary.today],
            ["Da completare", schedule.summary.pending],
            ["Concluse", schedule.summary.completed],
          ].map(([label, value]) => (
            <Card key={String(label)} className="!p-4">
              <p className="text-2xl font-black text-[var(--foreground)]">{value}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--muted)]">{label}</p>
            </Card>
          ))}
        </div>

        {schedule.nextMatch ? (
          <Card className="overflow-hidden !p-0">
            <div
              className="matchroom-hero p-5 sm:p-7"
              style={{ background: `linear-gradient(120deg, ${safeTeamColor(schedule.nextMatch.homeTeam.colorHex)}24 0%, transparent 48%, ${safeTeamColor(schedule.nextMatch.awayTeam.colorHex)}24 100%)` }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant={schedule.nextMatch.isToday ? "success" : "accent"}>
                  {schedule.nextMatch.isToday ? "OGGI" : "PROSSIMA GARA"}
                </Badge>
                <span className="text-xs font-black text-[var(--muted)]">Giornata {schedule.nextMatch.round}</span>
              </div>
              <div className="mt-6 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                <TeamIdentity team={schedule.nextMatch.homeTeam} align="right" />
                <span className="text-sm font-black text-[var(--muted)]">VS</span>
                <TeamIdentity team={schedule.nextMatch.awayTeam} align="left" />
              </div>
              <div className="mt-6 grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-2">
                <span className="inline-flex items-center gap-2"><CalendarClock size={15} className="text-[var(--accent)]" />{formatDate(schedule.nextMatch.date)}</span>
                <span className="inline-flex items-center gap-2"><MapPin size={15} className="text-[var(--accent)]" />{schedule.nextMatch.venueName ?? "Campo da assegnare"}</span>
              </div>
              <Link href={`/leagues/${leagueId}/matches/${schedule.nextMatch.id}`} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 text-sm font-black text-black">
                <ShieldCheck size={17} /> Gestisci partita
              </Link>
            </div>
          </Card>
        ) : (
          <Card className="text-center">
            <CheckCircle2 size={28} className="mx-auto text-emerald-400" />
            <p className="mt-3 font-black text-[var(--foreground)]">Nessuna gara futura assegnata</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Quando riceverai una nuova assegnazione comparirà qui automaticamente.</p>
          </Card>
        )}

        {schedule.pending.length > 0 && (
          <Card className="border-amber-400/25 bg-amber-400/[0.04]">
            <div className="flex items-center gap-2">
              <Clock3 size={18} className="text-amber-300" />
              <p className="font-black text-[var(--foreground)]">Gare da completare</p>
            </div>
            <div className="mt-3 space-y-2">
              {schedule.pending.map((match) => (
                <Link key={match.id} href={`/leagues/${leagueId}/matches/${match.id}`} className="flex flex-col gap-2 rounded-2xl border border-amber-400/20 bg-[var(--card-2)] p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <TeamLogo team={match.homeTeam} />
                    <div className="min-w-0">
                      <p className="truncate font-black text-[var(--foreground)]">{match.homeTeam.name} vs {match.awayTeam.name}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{formatDate(match.date)} · {match.venueName ?? "Campo da assegnare"}</p>
                    </div>
                    <TeamLogo team={match.awayTeam} />
                  </div>
                  <Badge variant="accent">{match.resultStatus === "DRAFT" ? "Bozza da finalizzare" : "Referto da inserire"}</Badge>
                </Link>
              ))}
            </div>
          </Card>
        )}

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--accent)]">Agenda</p>
              <h2 className="mt-1 text-xl font-black text-[var(--foreground)]">Tutte le mie gare</h2>
            </div>
            <CalendarClock size={21} className="text-[var(--accent)]" />
          </div>

          {schedule.matches.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">Non risultano ancora partite assegnate.</p>
          ) : (
            <div className="mt-5 space-y-6">
              {[...grouped.entries()].map(([month, matches]) => (
                <section key={month}>
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">{month}</p>
                  <div className="space-y-2">
                    {matches.map((match) => (
                      <Link
                        key={match.id}
                        href={`/leagues/${leagueId}/matches/${match.id}`}
                        className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] p-4 transition hover:border-[var(--accent)]/50 sm:flex-row sm:items-center sm:justify-between"
                        style={{ background: `linear-gradient(100deg, ${safeTeamColor(match.homeTeam.colorHex)}12 0%, var(--card-2) 38%, var(--card-2) 62%, ${safeTeamColor(match.awayTeam.colorHex)}12 100%)` }}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <TeamLogo team={match.homeTeam} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-black text-[var(--foreground)]">{match.homeTeam.name} vs {match.awayTeam.name}</p>
                              {match.isToday ? <Badge variant="success">Oggi</Badge> : match.isFinal ? <Badge variant="default">Conclusa</Badge> : match.needsAction ? <Badge variant="accent">Da completare</Badge> : <Badge variant="default">Programmata</Badge>}
                            </div>
                            <p className="mt-1 text-xs text-[var(--muted)]">{formatDate(match.date)} · {match.venueName ?? "Campo da assegnare"} · Giornata {match.round}</p>
                          </div>
                          <TeamLogo team={match.awayTeam} />
                        </div>
                        <span className="shrink-0 text-xs font-black text-[var(--accent)]">{match.isFinal ? "Vedi referto →" : "Gestisci →"}</span>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </Card>
      </div>
    </DashboardShell>
  );
}
