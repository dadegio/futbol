import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  MapPin,
  Shirt,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card from "src/app/_components/ui/card";
import Badge from "src/app/_components/ui/badge";
import { getServerSession } from "@/modules/auth/server-session";
import { getCoachDashboard } from "@/modules/coaches/application/coach-dashboard-service";

function safeColor(value: string | null | undefined, fallback = "#64748B") {
  return value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback;
}

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

function TeamLogo({
  team,
  large = false,
}: {
  team: { name: string; badgeUrl: string | null; colorHex: string | null };
  large?: boolean;
}) {
  const size = large ? "h-20 w-20" : "h-11 w-11";
  if (team.badgeUrl) {
    return <img src={team.badgeUrl} alt={`Logo ${team.name}`} className={`${size} shrink-0 object-contain`} />;
  }
  return (
    <div className={`${size} grid shrink-0 place-items-center rounded-2xl text-xs font-black text-white`} style={{ background: safeColor(team.colorHex) }}>
      {team.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
    </div>
  );
}

export default async function CoachPage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const session = await getServerSession();
  const data = await getCoachDashboard(session, leagueId);

  if (!data) {
    return (
      <DashboardShell leagueId={leagueId}>
        <Card>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)]">Coach Mode</p>
          <h1 className="mt-2 text-2xl font-black text-[var(--foreground)]">Accesso riservato all&apos;allenatore</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Questa funzione è opzionale e compare solo per le squadre che hanno un account allenatore associato.</p>
        </Card>
      </DashboardShell>
    );
  }

  const primary = safeColor(data.team.colorHex, "#F97316");
  const secondary = safeColor(data.team.secondaryColorHex ?? data.team.colorHex, "#7C3AED");

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="space-y-5 pb-8">
        <Card className="overflow-hidden !p-0">
          <div className="p-5 sm:p-7" style={{ background: `linear-gradient(115deg, ${primary}2A 0%, var(--card) 48%, ${secondary}24 100%)` }}>
            <Link
              href={`/leagues/${leagueId}/teams/${data.team.id}`}
              className="flex items-center gap-4 rounded-2xl outline-none ring-[var(--accent)] focus-visible:ring-2"
            >
              <TeamLogo team={data.team} large />
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent)]">Coach Center</p>
                <h1 className="truncate text-3xl font-black tracking-[-0.05em] text-[var(--foreground)]">{data.team.name}</h1>
                <p className="mt-1 text-sm text-[var(--muted)]">{data.league.name} · apri pagina squadra →</p>
              </div>
            </Link>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {([
            ["Rosa", data.rosterCount, Users],
            ["Prossime", data.upcomingCount, CalendarDays],
            ["Gol top 4", data.playerCards.slice(0, 4).reduce((sum, player) => sum + player.stats.goals, 0), BarChart3],
            ["MVP top 4", data.playerCards.slice(0, 4).reduce((sum, player) => sum + player.stats.mvp, 0), Star],
          ] satisfies Array<[string, number, LucideIcon]>).map(([label, value, Icon]) => (
            <Card key={String(label)} className="!p-4">
              <Icon size={17} className="text-[var(--accent)]" />
              <p className="mt-2 text-2xl font-black text-[var(--foreground)]">{String(value)}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--muted)]">{String(label)}</p>
            </Card>
          ))}
        </div>

        {data.nextMatch ? (
          <Card className="overflow-hidden !p-0">
            <div className="p-5 sm:p-7" style={{ background: `linear-gradient(120deg, ${primary}20 0%, var(--card) 55%, ${safeColor(data.nextMatch.opponent.colorHex)}20 100%)` }}>
              <div className="flex items-center justify-between gap-3">
                <Badge variant="accent">PROSSIMA PARTITA</Badge>
                <span className="text-xs font-black text-[var(--muted)]">Giornata {data.nextMatch.round}</span>
              </div>
              <div className="mt-5 flex items-center gap-4">
                <Link
                  href={`/leagues/${leagueId}/teams/${data.nextMatch.opponent.id}`}
                  className="shrink-0 rounded-2xl outline-none ring-[var(--accent)] focus-visible:ring-2"
                >
                  <TeamLogo team={data.nextMatch.opponent} large />
                </Link>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">{data.nextMatch.isHome ? "In casa" : "In trasferta"}</p>
                  <Link
                    href={`/leagues/${leagueId}/teams/${data.nextMatch.opponent.id}`}
                    className="block truncate text-2xl font-black text-[var(--foreground)] hover:text-[var(--accent)]"
                  >
                    {data.nextMatch.opponent.name}
                  </Link>
                  <p className="mt-2 flex items-center gap-2 text-sm text-[var(--muted)]"><CalendarDays size={15} className="text-[var(--accent)]" />{formatDate(data.nextMatch.date)}</p>
                  <p className="mt-1 flex items-center gap-2 text-sm text-[var(--muted)]"><MapPin size={15} className="text-[var(--accent)]" />{data.nextMatch.venueName ?? "Campo da assegnare"}</p>
                </div>
              </div>
              <div className="mt-5 rounded-2xl border border-[var(--border)] bg-black/10 p-4">
                <div className="flex items-start gap-3">
                  <Shirt size={18} className="mt-0.5 shrink-0 text-[var(--accent)]" />
                  <div>
                    <p className="font-black text-[var(--foreground)]">Prepara il piano partita</p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                      Scegli modulo, titolari, panchina e convocati. La proposta non sostituisce mai la distinta ufficiale finché arbitro o admin non la salvano.
                    </p>
                    <Link
                      href={`/leagues/${leagueId}/coach/lineup/${data.nextMatch.id}`}
                      className="mt-3 inline-flex min-h-11 items-center rounded-2xl bg-[var(--accent)] px-4 text-sm font-black text-black"
                    >
                      Prepara formazione →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="text-center">
            <CheckCircle2 size={28} className="mx-auto text-emerald-400" />
            <p className="mt-3 font-black text-[var(--foreground)]">Nessuna partita futura</p>
          </Card>
        )}

        <div className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
          <Card>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--accent)]">Forma recente</p>
            <div className="mt-4 space-y-2">
              {data.recent.length ? data.recent.map((match) => (
                <div key={match.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <TeamLogo team={match.opponent} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[var(--foreground)]">{match.opponent.name}</p>
                      <p className="text-xs text-[var(--muted)]">G{match.round} · {formatDate(match.date)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={["grid h-7 w-7 place-items-center rounded-full text-xs font-black", match.outcome === "W" ? "bg-emerald-500/15 text-emerald-300" : match.outcome === "D" ? "bg-amber-500/15 text-amber-300" : "bg-red-500/15 text-red-300"].join(" ")}>{match.outcome}</span>
                    <span className="font-black text-[var(--foreground)]">{match.goalsFor}-{match.goalsAgainst}</span>
                  </div>
                </div>
              )) : <p className="text-sm text-[var(--muted)]">Nessun risultato registrato.</p>}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--accent)]">Player Hub</p>
                <h2 className="mt-1 text-xl font-black text-[var(--foreground)]">Top giocatori</h2>
              </div>
              <BarChart3 size={20} className="text-[var(--accent)]" />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {data.playerCards.slice(0, 6).map((player) => (
                <Link
                  key={player.id}
                  href={`/leagues/${leagueId}/players/${player.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-3 transition hover:border-[var(--accent)]/50"
                >
                  <div className="h-16 w-14 shrink-0 overflow-hidden rounded-xl bg-black/20">
                    {player.photoUrl ? (
                      <img src={player.photoUrl} alt={`${player.firstName} ${player.lastName}`} className="h-full w-full object-contain" style={{ objectPosition: `${player.photoPositionX}% ${player.photoPositionY}%`, transform: `scale(${player.photoZoom})`, transformOrigin: `${player.photoPositionX}% ${player.photoPositionY}%` }} />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-xs font-black text-[var(--muted)]">{player.firstName[0]}{player.lastName[0]}</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-[var(--foreground)]">#{player.number} {player.firstName} {player.lastName}</p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase text-[var(--muted)]">{player.position ?? "Giocatore"}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black">
                      <span>{player.stats.appearances} P</span><span>{player.stats.goals} G</span><span>{player.stats.assists} A</span><span className="inline-flex items-center gap-1"><i className="h-3 w-2 rounded-[2px] bg-yellow-300" />{player.stats.yellowCards}</span><span className="inline-flex items-center gap-1"><i className="h-3 w-2 rounded-[2px] bg-red-500" />{player.stats.redCards}</span><span className="text-amber-300">{player.stats.mvp} MVP</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
