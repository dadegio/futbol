import Link from "next/link";
import { Activity, BarChart3, Goal, ShieldCheck, Sparkles, Swords, Trophy } from "lucide-react";
import Card from "src/app/_components/ui/card";
import type { LeagueStatsResponse } from "@/modules/stats/domain/league-stats";
import { FormDots, KpiCard, LeaderCell, MiniRecord, SectionHeader, SectionTitle, TeamBar, TeamLogo, formScore } from "@/modules/stats/presentation/StatsUi";

export function OverviewTab({ stats, leagueId }: { stats: LeagueStatsResponse; leagueId: string }) {
  const { overview, leaders, teamStats, records } = stats;
  const topForm = [...teamStats]
    .sort((a, b) => formScore(b.form) - formScore(a.form) || b.points - a.points)
    .slice(0, 5);
  const maxGoals = Math.max(...teamStats.map((team) => team.gf), 1);
  const maxDefense = Math.max(...teamStats.map((team) => team.ga), 1);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={<Activity size={18} />} label="Partite giocate" value={overview.completedMatches} />
        <KpiCard icon={<Goal size={18} />} label="Gol totali" value={overview.totalGoals} />
        <KpiCard icon={<BarChart3 size={18} />} label="Gol / partita" value={overview.averageGoalsPerMatch.toFixed(2)} />
        <KpiCard icon={<ShieldCheck size={18} />} label="Clean sheet" value={overview.totalCleanSheets} />
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <Card className="!p-0 overflow-hidden">
          <SectionHeader icon={<Sparkles size={18} />} title="Leader del torneo" subtitle="Chi sta incidendo di più" />
          <div className="grid gap-px bg-[var(--border)] sm:grid-cols-2">
            <LeaderCell label="Re dei gol" player={leaders.topScorer} value={leaders.topScorer?.goals ?? 0} suffix="gol" leagueId={leagueId} />
            <LeaderCell label="Assistman" player={leaders.topAssister} value={leaders.topAssister?.assists ?? 0} suffix="assist" leagueId={leagueId} />
            <LeaderCell label="Contributi" player={leaders.topContributor} value={leaders.topContributor?.contributions ?? 0} suffix="G+A" leagueId={leagueId} />
            <LeaderCell label="Presenze" player={leaders.mostAppearances} value={leaders.mostAppearances?.appearances ?? 0} suffix="gare" leagueId={leagueId} />
          </div>
        </Card>

        <Card>
          <SectionTitle title="Forma ultime 5" subtitle="3 punti vittoria · 1 pareggio" />
          <div className="mt-4 space-y-3">
            {topForm.map((team, index) => (
              <Link
                key={team.teamId}
                href={`/leagues/${leagueId}/teams/${team.teamId}`}
                className="flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-[var(--card-2)]"
              >
                <span className="w-5 text-center text-xs font-black tabular-nums text-[var(--muted)]">{index + 1}</span>
                <TeamLogo name={team.teamName} badgeUrl={team.badgeUrl} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-[var(--foreground)]">{team.teamName}</span>
                <FormDots form={team.form} />
              </Link>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Potenza offensiva" subtitle="Gol segnati complessivi" />
          <div className="mt-5 space-y-4">
            {[...teamStats]
              .sort((a, b) => b.gf - a.gf)
              .slice(0, 5)
              .map((team) => (
                <TeamBar
                  key={team.teamId}
                  team={team}
                  value={team.gf}
                  max={maxGoals}
                  label={`${team.gf} gol`}
                  leagueId={leagueId}
                />
              ))}
          </div>
        </Card>

        <Card>
          <SectionTitle title="Difese a confronto" subtitle="Meno gol subiti è meglio" />
          <div className="mt-5 space-y-4">
            {[...teamStats]
              .filter((team) => team.played > 0)
              .sort((a, b) => a.ga - b.ga)
              .slice(0, 5)
              .map((team) => (
                <TeamBar
                  key={team.teamId}
                  team={team}
                  value={maxDefense - team.ga + 1}
                  max={maxDefense + 1}
                  label={`${team.ga} subiti`}
                  leagueId={leagueId}
                />
              ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <MiniRecord
          icon={<Trophy size={18} />}
          label="Miglior attacco"
          title={records.bestAttack?.teamName ?? "—"}
          detail={records.bestAttack ? `${records.bestAttack.gf} gol` : "Nessun dato"}
        />
        <MiniRecord
          icon={<ShieldCheck size={18} />}
          label="Miglior difesa"
          title={records.bestDefense?.teamName ?? "—"}
          detail={records.bestDefense ? `${records.bestDefense.ga} gol subiti` : "Nessun dato"}
        />
        <MiniRecord
          icon={<Swords size={18} />}
          label="Partita più ricca"
          title={records.highestScoringMatch ? `${records.highestScoringMatch.homeTeamName} ${records.highestScoringMatch.homeGoals}-${records.highestScoringMatch.awayGoals} ${records.highestScoringMatch.awayTeamName}` : "—"}
          detail={records.highestScoringMatch ? `${records.highestScoringMatch.totalGoals} gol complessivi` : "Nessun dato"}
        />
      </section>
    </div>
  );
}
