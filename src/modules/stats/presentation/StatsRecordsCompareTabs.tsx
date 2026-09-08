"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, Goal, Medal, ShieldCheck, Sparkles, Swords, Target, Trophy } from "lucide-react";
import Card from "src/app/_components/ui/card";
import type { LeagueStatsResponse } from "@/modules/stats/domain/league-stats";
import { CompareSelect, PlayerCompareHeader, RecordCard, TabButton, TeamCompareHeader, formatMetric } from "@/modules/stats/presentation/StatsUi";

export function RecordsTab({ stats, leagueId }: { stats: LeagueStatsResponse; leagueId: string }) {
  const { records, leaders } = stats;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <RecordCard icon={<Goal size={20} />} eyebrow="Miglior attacco" title={records.bestAttack?.teamName ?? "—"} value={records.bestAttack ? `${records.bestAttack.gf} gol` : "Nessun dato"} />
      <RecordCard icon={<ShieldCheck size={20} />} eyebrow="Miglior difesa" title={records.bestDefense?.teamName ?? "—"} value={records.bestDefense ? `${records.bestDefense.ga} subiti` : "Nessun dato"} />
      <RecordCard icon={<ShieldCheck size={20} />} eyebrow="Più clean sheet" title={records.mostCleanSheets?.teamName ?? "—"} value={records.mostCleanSheets ? `${records.mostCleanSheets.cleanSheets} clean sheet` : "Nessun dato"} />
      <RecordCard icon={<Trophy size={20} />} eyebrow="Serie di vittorie" title={records.longestWinningStreak?.teamName ?? "—"} value={records.longestWinningStreak ? `${records.longestWinningStreak.longestWinningStreak} consecutive` : "Nessun dato"} />
      <RecordCard icon={<Activity size={20} />} eyebrow="Imbattibilità" title={records.longestUnbeatenStreak?.teamName ?? "—"} value={records.longestUnbeatenStreak ? `${records.longestUnbeatenStreak.longestUnbeatenStreak} partite` : "Nessun dato"} />
      <RecordCard icon={<Medal size={20} />} eyebrow="Più gol in una gara" title={records.bestSingleMatch?.playerName ?? "—"} value={records.bestSingleMatch ? `${records.bestSingleMatch.goals} gol · ${records.bestSingleMatch.homeTeamName} ${records.bestSingleMatch.homeGoals}-${records.bestSingleMatch.awayGoals} ${records.bestSingleMatch.awayTeamName}` : "Nessun dato"} />
      <RecordCard icon={<Swords size={20} />} eyebrow="Vittoria più larga" title={records.biggestWin ? `${records.biggestWin.homeTeamName} ${records.biggestWin.homeGoals}-${records.biggestWin.awayGoals} ${records.biggestWin.awayTeamName}` : "—"} value={records.biggestWin ? `Scarto di ${records.biggestWin.margin}` : "Nessun dato"} />
      <RecordCard icon={<Sparkles size={20} />} eyebrow="Partita più spettacolare" title={records.highestScoringMatch ? `${records.highestScoringMatch.homeTeamName} ${records.highestScoringMatch.homeGoals}-${records.highestScoringMatch.awayGoals} ${records.highestScoringMatch.awayTeamName}` : "—"} value={records.highestScoringMatch ? `${records.highestScoringMatch.totalGoals} gol totali` : "Nessun dato"} />
      <Link href={leaders.topContributor ? `/leagues/${leagueId}/players/${leaders.topContributor.playerId}` : "#"} className="block">
        <RecordCard icon={<Target size={20} />} eyebrow="Re dei contributi" title={leaders.topContributor ? `${leaders.topContributor.firstName} ${leaders.topContributor.lastName}` : "—"} value={leaders.topContributor ? `${leaders.topContributor.contributions} G+A in ${leaders.topContributor.appearances} presenze` : "Nessun dato"} />
      </Link>
    </div>
  );
}
export function CompareTab({ stats, leagueId }: { stats: LeagueStatsResponse; leagueId: string }) {
  const [mode, setMode] = useState<"teams" | "players">("teams");
  const [leftTeamId, setLeftTeamId] = useState(stats.teamStats[0]?.teamId ?? "");
  const [rightTeamId, setRightTeamId] = useState(stats.teamStats[1]?.teamId ?? stats.teamStats[0]?.teamId ?? "");
  const [leftPlayerId, setLeftPlayerId] = useState(stats.playerStats[0]?.playerId ?? "");
  const [rightPlayerId, setRightPlayerId] = useState(stats.playerStats[1]?.playerId ?? stats.playerStats[0]?.playerId ?? "");

  const leftTeam = stats.teamStats.find((team) => team.teamId === leftTeamId) ?? stats.teamStats[0];
  const rightTeam = stats.teamStats.find((team) => team.teamId === rightTeamId) ?? stats.teamStats[1] ?? stats.teamStats[0];
  const leftPlayer = stats.playerStats.find((player) => player.playerId === leftPlayerId) ?? stats.playerStats[0];
  const rightPlayer = stats.playerStats.find((player) => player.playerId === rightPlayerId) ?? stats.playerStats[1] ?? stats.playerStats[0];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <TabButton active={mode === "teams"} onClick={() => setMode("teams")} label="Squadre" />
        <TabButton active={mode === "players"} onClick={() => setMode("players")} label="Giocatori" />
      </div>

      {mode === "teams" ? (
        <>
          <Card variant="inner" className="grid gap-3 sm:grid-cols-2">
            <CompareSelect value={leftTeamId} onChange={setLeftTeamId} options={stats.teamStats.map((team) => ({ value: team.teamId, label: team.teamName }))} />
            <CompareSelect value={rightTeamId} onChange={setRightTeamId} options={stats.teamStats.map((team) => ({ value: team.teamId, label: team.teamName }))} />
          </Card>
          {leftTeam && rightTeam && (
            <ComparisonCard
              leftHeader={<TeamCompareHeader team={leftTeam} leagueId={leagueId} />}
              rightHeader={<TeamCompareHeader team={rightTeam} leagueId={leagueId} />}
              metrics={[
                { label: "Punti", left: leftTeam.points, right: rightTeam.points },
                { label: "Punti / gara", left: leftTeam.pointsPerGame, right: rightTeam.pointsPerGame },
                { label: "Gol fatti", left: leftTeam.gf, right: rightTeam.gf },
                { label: "Gol subiti", left: leftTeam.ga, right: rightTeam.ga, lowerIsBetter: true },
                { label: "Clean sheet", left: leftTeam.cleanSheets, right: rightTeam.cleanSheets },
                { label: "Vittorie", left: leftTeam.wins, right: rightTeam.wins },
              ]}
            />
          )}
        </>
      ) : (
        <>
          <Card variant="inner" className="grid gap-3 sm:grid-cols-2">
            <CompareSelect value={leftPlayerId} onChange={setLeftPlayerId} options={stats.playerStats.map((player) => ({ value: player.playerId, label: `${player.firstName} ${player.lastName} · ${player.teamName}` }))} />
            <CompareSelect value={rightPlayerId} onChange={setRightPlayerId} options={stats.playerStats.map((player) => ({ value: player.playerId, label: `${player.firstName} ${player.lastName} · ${player.teamName}` }))} />
          </Card>
          {leftPlayer && rightPlayer && (
            <ComparisonCard
              leftHeader={<PlayerCompareHeader player={leftPlayer} leagueId={leagueId} />}
              rightHeader={<PlayerCompareHeader player={rightPlayer} leagueId={leagueId} />}
              metrics={[
                { label: "Presenze", left: leftPlayer.appearances, right: rightPlayer.appearances },
                { label: "Gol", left: leftPlayer.goals, right: rightPlayer.goals },
                { label: "Assist", left: leftPlayer.assists, right: rightPlayer.assists },
                { label: "Gol + Assist", left: leftPlayer.contributions, right: rightPlayer.contributions },
                { label: "G+A / gara", left: leftPlayer.contributionsPerAppearance, right: rightPlayer.contributionsPerAppearance },
                { label: "Gol / gara", left: leftPlayer.goalsPerAppearance, right: rightPlayer.goalsPerAppearance },
              ]}
            />
          )}
        </>
      )}
    </div>
  );
}

function ComparisonCard({
  leftHeader,
  rightHeader,
  metrics,
}: {
  leftHeader: React.ReactNode;
  rightHeader: React.ReactNode;
  metrics: Array<{ label: string; left: number; right: number; lowerIsBetter?: boolean }>;
}) {
  return (
    <Card className="overflow-hidden !p-0">
      <div className="grid grid-cols-2 gap-px bg-[var(--border)]">
        <div className="bg-[var(--card)] p-4">{leftHeader}</div>
        <div className="bg-[var(--card)] p-4">{rightHeader}</div>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {metrics.map((metric) => {
          const leftWins = metric.lowerIsBetter ? metric.left < metric.right : metric.left > metric.right;
          const rightWins = metric.lowerIsBetter ? metric.right < metric.left : metric.right > metric.left;
          return (
            <div key={metric.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3">
              <div className={`text-left text-lg font-black tabular-nums ${leftWins ? "text-[var(--accent)]" : "text-[var(--foreground)]"}`}>
                {formatMetric(metric.left)}
              </div>
              <div className="text-center text-[10px] font-black uppercase tracking-[0.12em] text-[var(--muted)]">{metric.label}</div>
              <div className={`text-right text-lg font-black tabular-nums ${rightWins ? "text-[var(--accent)]" : "text-[var(--foreground)]"}`}>
                {formatMetric(metric.right)}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
