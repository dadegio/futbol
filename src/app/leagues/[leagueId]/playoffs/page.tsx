"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card, { CardHeader } from "src/app/_components/ui/card";
import Button from "src/app/_components/ui/button";
import Badge from "src/app/_components/ui/badge";
import PlayoffSetup from "./playoff-setup";
import BracketView from "./bracket";
import type { SeriesData } from "./series-card";
import { useAuth, useIsAdmin, authFetch } from "@/lib/client-auth";

type PlayoffData = {
  configured: boolean;
  format?: string;
  teamCount?: number;
  seeded?: boolean;
  series?: SeriesData[];
};

type ViewMode = "bracket" | "list";

const ROUND_NAMES: Record<number, string> = {
  1: "Finale",
  2: "Semifinali",
  4: "Quarti di finale",
  8: "Ottavi di finale",
};

export default function PlayoffsPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const isAdmin = useIsAdmin();
  const { user } = useAuth();

  const [data, setData] = useState<PlayoffData | null>(null);
  const [teamCount, setTeamCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("bracket");
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const [playoffRes, teamsRes] = await Promise.all([
        fetch(`/api/leagues/${leagueId}/playoffs`, { cache: "no-store" }),
        fetch(`/api/leagues/${leagueId}/teams`, { cache: "no-store" }),
      ]);

      const playoffData = await playoffRes.json();
      const teamsData = await teamsRes.json();

      if (!playoffRes.ok) throw new Error(playoffData?.error ?? "Errore");

      setData(playoffData);
      setTeamCount(Array.isArray(teamsData) ? teamsData.length : 0);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (leagueId) load();
  }, [leagueId]);

  async function handleAdvance(seriesId: string) {
    setAdvancing(seriesId);
    setErr(null);
    try {
      const res = await authFetch(`/api/leagues/${leagueId}/playoffs/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesId }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error ?? "Errore");
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setAdvancing(null);
    }
  }

  async function handleDelete() {
    if (!confirm("Eliminare i playoff? Tutte le partite playoff verranno cancellate.")) return;
    setDeleting(true);
    setErr(null);
    try {
      const res = await authFetch(`/api/leagues/${leagueId}/playoffs`, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error ?? "Errore");
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setDeleting(false);
    }
  }

  if (!leagueId) return null;

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="space-y-6">
        {/* Header */}
        <Card>
          <CardHeader
            tag="Playoff"
            title="Fase a eliminazione"
            description="Configura e gestisci i playoff del torneo."
          />
        </Card>

        {err && <Badge variant="error">{err}</Badge>}

        {loading && (
          <div className="text-[var(--foreground)]/60">Caricamento...</div>
        )}

        {/* Setup form when no playoffs configured — admin only */}
        {!loading && data && !data.configured && isAdmin && (
          <Card>
            <div className="mb-4 text-lg font-black text-[var(--foreground)]">
              Configura playoff
            </div>
            {teamCount < 2 ? (
              <p className="text-sm text-[var(--foreground)]/60">
                Servono almeno 2 squadre per creare i playoff.
              </p>
            ) : (
              <PlayoffSetup
                leagueId={leagueId}
                teamCount={teamCount}
                onCreated={load}
              />
            )}
          </Card>
        )}

        {/* Bracket display when playoffs are configured */}
        {!loading && data?.configured && data.series && (
          <>
            {/* Controls */}
            <Card>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant={view === "bracket" ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setView("bracket")}
                  >
                    Tabellone
                  </Button>
                  <Button
                    variant={view === "list" ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setView("list")}
                  >
                    Lista
                  </Button>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Badge>
                    Formato:{" "}
                    <b className="text-[var(--foreground)]">
                      {data.format === "TWO_LEG" ? "Andata e ritorno" : "Eliminazione diretta"}
                    </b>
                  </Badge>
                  <Badge>
                    Squadre: <b className="text-[var(--foreground)]">{data.teamCount}</b>
                  </Badge>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => window.print()}
                  >
                    Stampa
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      {deleting ? "Eliminazione..." : "Elimina playoff"}
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            {/* Bracket view */}
            {view === "bracket" && (
              <Card>
                <BracketView
                  series={data.series}
                  leagueId={leagueId}
                  format={data.format!}
                  teamCount={data.teamCount!}
                />
              </Card>
            )}

            {/* List view */}
            {view === "list" && (
              <div className="space-y-4">
                {groupByRound(data.series, data.teamCount!).map(([round, roundSeries]) => (
                  <Card key={round} variant="inner">
                    <div className="mb-4 text-xl font-black text-[var(--foreground)]">
                      {ROUND_NAMES[round] ?? `Round ${round}`}
                    </div>

                    <div className="space-y-3">
                      {roundSeries.map((s) => {
                        const leg1 = s.matches.find((m) => m.leg === 1);
                        const leg2 = s.matches.find((m) => m.leg === 2);
                        const allPlayed = s.matches.length > 0 && s.matches.every(
                          (m) => m.homeGoals !== null && m.awayGoals !== null
                        );

                        return (
                          <div
                            key={s.id}
                            className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="text-base font-bold text-[var(--foreground)]">
                                  {s.homeSeed && (
                                    <span className="mr-1 text-xs text-[var(--foreground)]/40">
                                      #{s.homeSeed}
                                    </span>
                                  )}
                                  {s.homeTeam?.name ?? "TBD"}{" "}
                                  <span className="text-[var(--foreground)]/35">vs</span>{" "}
                                  {s.awayTeam?.name ?? "TBD"}
                                  {s.awaySeed && (
                                    <span className="ml-1 text-xs text-[var(--foreground)]/40">
                                      #{s.awaySeed}
                                    </span>
                                  )}
                                </div>

                                {s.winnerId && (
                                  <div className="mt-1 text-sm text-[var(--accent)]">
                                    Vince:{" "}
                                    {s.winnerId === s.homeTeam?.id
                                      ? s.homeTeam?.name
                                      : s.awayTeam?.name}
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {/* Scores */}
                                {leg1 && leg1.homeGoals !== null && (
                                  <div className="rounded-2xl bg-[var(--accent)] px-3 py-1.5 text-sm font-black text-black">
                                    {data.format === "TWO_LEG" ? "G1: " : ""}
                                    {leg1.homeGoals} - {leg1.awayGoals}
                                  </div>
                                )}
                                {leg2 && leg2.homeGoals !== null && (
                                  <div className="rounded-2xl bg-[var(--accent)] px-3 py-1.5 text-sm font-black text-black">
                                    G2: {leg2.homeGoals} - {leg2.awayGoals}
                                  </div>
                                )}

                                {/* Action buttons */}
                                {s.homeTeam && s.awayTeam && !s.winnerId && (
                                  <>
                                    {/* Show result links to admin or captains of either team */}
                                    {(isAdmin ||
                                      (user?.role === "CAPTAIN" &&
                                        (user.teamId === s.homeTeam?.id ||
                                          user.teamId === s.awayTeam?.id))) &&
                                      s.matches.map((m) => (
                                        <Link
                                          key={m.id}
                                          href={`/leagues/${leagueId}/matches/${m.id}`}
                                          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[var(--foreground)]/80 hover:bg-white/10"
                                        >
                                          {m.homeGoals !== null ? "Modifica" : "Risultato"}
                                          {data.format === "TWO_LEG" ? ` G${m.leg}` : ""}
                                        </Link>
                                      ))}

                                    {allPlayed && isAdmin && (
                                      <Button
                                        size="sm"
                                        onClick={() => handleAdvance(s.id)}
                                        disabled={advancing === s.id}
                                      >
                                        {advancing === s.id ? "..." : "Avanza vincitore"}
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function groupByRound(
  series: SeriesData[],
  teamCount: number
): [number, SeriesData[]][] {
  const firstRound = teamCount / 2;
  const rounds: number[] = [];
  let r = firstRound;
  while (r >= 1) {
    rounds.push(r);
    r = r / 2;
  }

  return rounds
    .map((round) => [
      round,
      series
        .filter((s) => s.bracketRound === round)
        .sort((a, b) => a.position - b.position),
    ] as [number, SeriesData[]])
    .filter(([, arr]) => arr.length > 0);
}
