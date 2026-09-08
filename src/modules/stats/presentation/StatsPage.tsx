"use client";

import { useState } from "react";
import DashboardShell from "src/app/_components/dashboard-shell";
import type { LeagueStatsResponse } from "@/modules/stats/domain/league-stats";
import { OverviewTab } from "@/modules/stats/presentation/StatsOverviewTab";
import { PlayersTab, TeamsTab } from "@/modules/stats/presentation/StatsRankingsTabs";
import { CompareTab, RecordsTab } from "@/modules/stats/presentation/StatsRecordsCompareTabs";
import { EmptyState, TabButton } from "@/modules/stats/presentation/StatsUi";

type TabKey = "overview" | "teams" | "players" | "records" | "compare";

export default function StatsPage({
  leagueId,
  initialStats: stats,
}: {
  leagueId: string;
  initialStats: LeagueStatsResponse;
}) {
  const [tab, setTab] = useState<TabKey>("overview");

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="w-full space-y-5 pb-10">
        <header className="pt-2">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="mb-1 text-xs font-black uppercase tracking-[0.2em] text-[var(--accent)]">
                Numeri del torneo
              </div>
              <h1 className="text-[32px] font-black tracking-[-0.06em] text-[var(--foreground)] md:text-[38px]">
                Statistiche
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
                Prestazioni, forma, record e confronti aggiornati automaticamente dai risultati inseriti.
              </p>
            </div>

            {stats.overview.completedMatches > 0 && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-4 py-2 text-right">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">
                  Campione
                </div>
                <div className="text-sm font-black text-[var(--foreground)]">
                  {stats.overview.completedMatches} partite
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div className="flex min-w-max gap-2">
            <TabButton active={tab === "overview"} onClick={() => setTab("overview")} label="Panoramica" />
            <TabButton active={tab === "teams"} onClick={() => setTab("teams")} label="Squadre" />
            <TabButton active={tab === "players"} onClick={() => setTab("players")} label="Giocatori" />
            <TabButton active={tab === "records"} onClick={() => setTab("records")} label="Record" />
            <TabButton active={tab === "compare"} onClick={() => setTab("compare")} label="Confronta" />
          </div>
        </div>

        {stats.overview.completedMatches === 0 ? (
          <EmptyState />
        ) : (
          <>
            {tab === "overview" && <OverviewTab stats={stats} leagueId={leagueId} />}
            {tab === "teams" && <TeamsTab teams={stats.teamStats} leagueId={leagueId} />}
            {tab === "players" && <PlayersTab players={stats.playerStats} leagueId={leagueId} />}
            {tab === "records" && <RecordsTab stats={stats} leagueId={leagueId} />}
            {tab === "compare" && <CompareTab stats={stats} leagueId={leagueId} />}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
