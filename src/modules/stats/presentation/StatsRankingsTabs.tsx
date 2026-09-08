"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import Card from "src/app/_components/ui/card";
import type { PlayerStat, TeamStat } from "@/modules/stats/domain/league-stats";
import { FormDots, MetricNumber, PlayerAvatar, SmallMetric, TeamLogo, formScore } from "@/modules/stats/presentation/StatsUi";

type PlayerSort = "contributions" | "goals" | "assists" | "appearances" | "rate";
type TeamSort = "points" | "attack" | "defense" | "cleanSheets" | "form";

export function TeamsTab({ teams, leagueId }: { teams: TeamStat[]; leagueId: string }) {
  const [sort, setSort] = useState<TeamSort>("points");

  const sorted = useMemo(() => {
    const rows = [...teams];
    if (sort === "attack") return rows.sort((a, b) => b.gf - a.gf || b.goalsPerGame - a.goalsPerGame);
    if (sort === "defense") return rows.sort((a, b) => a.ga - b.ga || a.goalsAgainstPerGame - b.goalsAgainstPerGame);
    if (sort === "cleanSheets") return rows.sort((a, b) => b.cleanSheets - a.cleanSheets || a.ga - b.ga);
    if (sort === "form") return rows.sort((a, b) => formScore(b.form) - formScore(a.form) || b.points - a.points);
    return rows.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
  }, [teams, sort]);

  return (
    <div className="space-y-4">
      <Card variant="inner" className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-black text-[var(--foreground)]">Analisi squadre</div>
          <div className="mt-0.5 text-xs text-[var(--muted)]">Medie, clean sheet e forma recente.</div>
        </div>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as TeamSort)}
          className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-semibold text-[var(--foreground)] outline-none"
        >
          <option value="points">Ordina per punti</option>
          <option value="attack">Miglior attacco</option>
          <option value="defense">Miglior difesa</option>
          <option value="cleanSheets">Clean sheet</option>
          <option value="form">Forma recente</option>
        </select>
      </Card>

      <div className="grid gap-3 xl:grid-cols-2">
        {sorted.map((team, index) => (
          <Link key={team.teamId} href={`/leagues/${leagueId}/teams/${team.teamId}`}>
            <Card className="h-full transition hover:-translate-y-0.5 hover:border-[var(--accent)]">
              <div className="flex items-start gap-3">
                <div className="pt-1 text-xs font-black tabular-nums text-[var(--muted)]">#{index + 1}</div>
                <TeamLogo name={team.teamName} badgeUrl={team.badgeUrl} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-lg font-black tracking-[-0.03em] text-[var(--foreground)]">{team.teamName}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <FormDots form={team.form} />
                        {team.unbeatenStreak >= 2 && (
                          <span className="text-[10px] font-bold text-[var(--muted)]">{team.unbeatenStreak} senza sconfitte</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black tabular-nums text-[var(--foreground)]">{team.points}</div>
                      <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">punti</div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-4 gap-2 border-t border-[var(--border)] pt-3">
                    <SmallMetric label="G" value={team.played} />
                    <SmallMetric label="GF" value={team.gf} />
                    <SmallMetric label="GS" value={team.ga} />
                    <SmallMetric label="CS" value={team.cleanSheets} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <SmallMetric label="PT/G" value={team.pointsPerGame.toFixed(2)} muted />
                    <SmallMetric label="GF/G" value={team.goalsPerGame.toFixed(2)} muted />
                    <SmallMetric label="GS/G" value={team.goalsAgainstPerGame.toFixed(2)} muted />
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
export function PlayersTab({ players, leagueId }: { players: PlayerStat[]; leagueId: string }) {
  const [sort, setSort] = useState<PlayerSort>("contributions");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const rows = normalized
      ? players.filter((player) =>
          `${player.firstName} ${player.lastName} ${player.teamName}`.toLowerCase().includes(normalized)
        )
      : [...players];

    if (sort === "goals") return rows.sort((a, b) => b.goals - a.goals || b.assists - a.assists);
    if (sort === "assists") return rows.sort((a, b) => b.assists - a.assists || b.goals - a.goals);
    if (sort === "appearances") return rows.sort((a, b) => b.appearances - a.appearances || b.contributions - a.contributions);
    if (sort === "rate") return rows.sort((a, b) => b.contributionsPerAppearance - a.contributionsPerAppearance || b.contributions - a.contributions);
    return rows.sort((a, b) => b.contributions - a.contributions || b.goals - a.goals || b.assists - a.assists);
  }, [players, query, sort]);

  return (
    <div className="space-y-4">
      <Card variant="inner" className="grid gap-3 md:grid-cols-[1fr_auto]">
        <label className="relative block">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cerca giocatore o squadra"
            className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] pl-10 pr-3 text-base text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] md:text-sm"
          />
        </label>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as PlayerSort)}
          className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-semibold text-[var(--foreground)] outline-none"
        >
          <option value="contributions">Gol + Assist</option>
          <option value="goals">Gol</option>
          <option value="assists">Assist</option>
          <option value="appearances">Presenze</option>
          <option value="rate">G+A per presenza</option>
        </select>
      </Card>

      <Card className="overflow-hidden !p-0">
        <div className="grid grid-cols-[32px_58px_minmax(0,1fr)_44px_44px_48px] items-center border-b border-[var(--border)] px-3 py-3 text-[10px] font-black uppercase tracking-wide text-[var(--muted)] sm:grid-cols-[36px_64px_minmax(0,1fr)_58px_58px_58px_72px]">
          <div>#</div>
          <div></div>
          <div>Giocatore</div>
          <div className="text-center">G</div>
          <div className="text-center">A</div>
          <div className="text-center">G+A</div>
          <div className="hidden text-right sm:block">G+A/G</div>
        </div>
        {filtered.length === 0 ? (
          <div className="p-6 text-sm text-[var(--muted)]">Nessun giocatore trovato.</div>
        ) : (
          filtered.map((player, index) => (
            <Link
              key={player.playerId}
              href={`/leagues/${leagueId}/players/${player.playerId}`}
              className="grid grid-cols-[32px_58px_minmax(0,1fr)_44px_44px_48px] items-center border-b border-[var(--border)] px-3 py-3 transition hover:bg-[var(--card-2)] last:border-b-0 sm:grid-cols-[36px_64px_minmax(0,1fr)_58px_58px_58px_72px]"
            >
              <div className="text-xs font-black tabular-nums text-[var(--muted)]">{index + 1}</div>
              <PlayerAvatar player={player} />
              <div className="min-w-0 pr-2">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="truncate text-sm font-black text-[var(--foreground)]">
                    {player.firstName} {player.lastName}
                  </div>
                  {player.isTeamCaptain && <span title="Capitano" className="shrink-0 text-xs">👑</span>}
                </div>
                <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--muted)]">
                  <TeamLogo name={player.teamName} badgeUrl={player.teamBadgeUrl} size="xs" />
                  <span className="truncate">#{player.number} · {player.teamName}</span>
                  <span className="hidden sm:inline">· {player.appearances} pres.</span>
                </div>
              </div>
              <MetricNumber value={player.goals} />
              <MetricNumber value={player.assists} />
              <MetricNumber value={player.contributions} strong />
              <div className="hidden text-right text-sm font-black tabular-nums text-[var(--foreground)] sm:block">
                {player.contributionsPerAppearance.toFixed(2)}
              </div>
            </Link>
          ))
        )}
      </Card>
    </div>
  );
}
