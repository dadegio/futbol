"use client";

import React, { useEffect, useState } from "react";
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

  async function handleAdvance(seriesId: string, manualWinnerId?: string) {
  setAdvancing(seriesId);
  setErr(null);
  try {
    const res = await authFetch(`/api/leagues/${leagueId}/playoffs/advance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        manualWinnerId ? { seriesId, winnerId: manualWinnerId } : { seriesId }
      ),
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
                    aria-pressed={view === "bracket"}
                    onClick={() => setView("bracket")}
                  >
                    Tabellone
                  </Button>
                  <Button
                    variant={view === "list" ? "primary" : "secondary"}
                    size="sm"
                    aria-pressed={view === "list"}
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
                  <div key={round} className="space-y-3">
                    <div
                      className="px-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)]"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {ROUND_NAMES[round] ?? `Round ${round}`}
                    </div>
                    {roundSeries.map((s) => {
                      const allPlayed = s.matches.length > 0 && s.matches.every(
                        (m) => m.homeGoals !== null && m.awayGoals !== null
                      );
                      const canAct =
                        s.homeTeam &&
                        s.awayTeam &&
                        !s.winnerId &&
                        (isAdmin ||
                          (user?.role === "CAPTAIN" &&
                            (user.teamId === s.homeTeam?.id ||
                              user.teamId === s.awayTeam?.id)));

                      return (
                        <PlayoffSeriesListCard
                          key={s.id}
                          series={s}
                          leagueId={leagueId}
                          format={data.format!}
                          canAct={!!canAct}
                          allPlayed={allPlayed}
                          isAdmin={isAdmin}
                          advancing={advancing}
                          onAdvance={handleAdvance}
                          onReload={load}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────────

function TeamCrest({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const hue = (initials.charCodeAt(0) * 47 + (initials.charCodeAt(1) || 0) * 13) % 360;
  return (
    <div
      className="flex shrink-0 items-center justify-center font-bold"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: `oklch(0.88 0.07 ${hue})`,
        color: `oklch(0.38 0.12 ${hue})`,
        fontSize: size * 0.36,
        fontFamily: "var(--font-display)",
      }}
    >
      {initials}
    </div>
  );
}

function PlayoffSeriesListCard({
  series,
  leagueId,
  format,
  canAct,
  allPlayed,
  isAdmin,
  advancing,
  onAdvance,
  onReload,
}: {
  series: SeriesData;
  leagueId: string;
  format: string;
  canAct: boolean;
  allPlayed: boolean;
  isAdmin: boolean;
  advancing: string | null;
  onAdvance: (id: string) => void;
  onReload: () => void;
}) {
  const { homeTeam, awayTeam, winnerId, matches } = series;
  const isTwoLeg = format === "TWO_LEG";

  const leg1 = matches.find((m) => m.leg === 1) ?? matches[0];
  const leg2 = matches.find((m) => m.leg === 2);

  const homeAgg = isTwoLeg
    ? (leg1?.homeGoals ?? 0) + (leg2?.awayGoals ?? 0)
    : null;
  const awayAgg = isTwoLeg
    ? (leg1?.awayGoals ?? 0) + (leg2?.homeGoals ?? 0)
    : null;

  const leg1Played = !!leg1 && leg1.homeGoals !== null && leg1.awayGoals !== null;
  const leg2Played = !!leg2 && leg2.homeGoals !== null && leg2.awayGoals !== null;
  const anyPlayed = leg1Played || leg2Played;

  // Whether the series ends in a tie requiring penalties
  const isTied = allPlayed && (
    isTwoLeg
      ? homeAgg === awayAgg
      : (leg1Played && leg1!.homeGoals === leg1!.awayGoals)
  );

  const hasPenalties = series.penaltiesHome !== null && series.penaltiesAway !== null;

  const homeWon = winnerId && homeTeam && winnerId === homeTeam.id;
  const awayWon = winnerId && awayTeam && winnerId === awayTeam.id;

  // Penalty form state
  const [penH, setPenH] = React.useState(series.penaltiesHome !== null ? String(series.penaltiesHome) : "");
  const [penA, setPenA] = React.useState(series.penaltiesAway !== null ? String(series.penaltiesAway) : "");
  const [savingPen, setSavingPen] = React.useState(false);
  const [penErr, setPenErr] = React.useState<string | null>(null);

  async function savePenalties() {
    setPenErr(null);
    const ph = parseInt(penH, 10);
    const pa = parseInt(penA, 10);
    if (!Number.isInteger(ph) || ph < 0 || !Number.isInteger(pa) || pa < 0) {
      setPenErr("Valori non validi");
      return;
    }
    if (ph === pa) {
      setPenErr("I rigori non possono finire in parità");
      return;
    }
    setSavingPen(true);
    try {
      const res = await authFetch(`/api/leagues/${leagueId}/playoffs/series/${series.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ penaltiesHome: ph, penaltiesAway: pa }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((d as any)?.error ?? "Errore salvataggio");
      onReload();
    } catch (e: any) {
      setPenErr(e.message);
    } finally {
      setSavingPen(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--card)] shadow-[0_1px_3px_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.04)]">
      {/* Scoreboard */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-4">
        {/* Home */}
        <div className={["flex flex-col items-center gap-2 text-center", awayWon ? "opacity-40" : ""].join(" ")}>
          <TeamCrest name={homeTeam?.name ?? "?"} size={40} />
          <div className="space-y-0.5">
            {series.homeSeed && (
              <p className="text-[10px] font-medium text-[var(--muted)]" style={{ fontFamily: "var(--font-mono, ui-monospace)" }}>
                #{series.homeSeed}
              </p>
            )}
            <p className={["text-[13px] font-semibold leading-tight", homeWon ? "text-[var(--accent)]" : "text-[var(--foreground)]"].join(" ")}>
              {homeTeam?.name ?? "TBD"}
            </p>
          </div>
        </div>

        {/* Score area */}
        <div className="flex flex-col items-center gap-2">
          {isTwoLeg ? (
            <div className="flex flex-col items-center gap-1">
              {/* Leg 1 */}
              <div className="flex items-center gap-1.5 text-[13px] tabular-nums" style={{ fontFamily: "var(--font-mono, ui-monospace)" }}>
                <span className="text-[10px] font-medium text-[var(--muted)]">G1</span>
                <span className={leg1Played ? "font-semibold text-[var(--foreground)]" : "text-[var(--border-strong)]"}>
                  {leg1Played ? leg1!.homeGoals : "–"}
                </span>
                <span className="text-[var(--border-strong)]">:</span>
                <span className={leg1Played ? "font-semibold text-[var(--foreground)]" : "text-[var(--border-strong)]"}>
                  {leg1Played ? leg1!.awayGoals : "–"}
                </span>
              </div>
              {/* Leg 2 */}
              <div className="flex items-center gap-1.5 text-[13px] tabular-nums" style={{ fontFamily: "var(--font-mono, ui-monospace)" }}>
                <span className="text-[10px] font-medium text-[var(--muted)]">G2</span>
                <span className={leg2Played ? "font-semibold text-[var(--foreground)]" : "text-[var(--border-strong)]"}>
                  {leg2Played ? leg2!.homeGoals : "–"}
                </span>
                <span className="text-[var(--border-strong)]">:</span>
                <span className={leg2Played ? "font-semibold text-[var(--foreground)]" : "text-[var(--border-strong)]"}>
                  {leg2Played ? leg2!.awayGoals : "–"}
                </span>
              </div>
              {/* Aggregate */}
              {anyPlayed && (
                <div className="mt-1 flex items-center gap-1 rounded-lg px-2 py-1" style={{ background: "var(--card-2)" }}>
                  <span
                    className={["text-[15px] font-bold tabular-nums", homeWon ? "text-[var(--accent)]" : "text-[var(--foreground)]"].join(" ")}
                    style={{ fontFamily: "var(--font-mono, ui-monospace)" }}
                  >
                    {homeAgg}
                  </span>
                  <span className="text-[11px] font-medium text-[var(--muted)]" style={{ fontFamily: "var(--font-mono, ui-monospace)" }}>
                    agg
                  </span>
                  <span className="text-[15px] font-bold tabular-nums text-[var(--border-strong)]" style={{ fontFamily: "var(--font-mono, ui-monospace)" }}>
                    :
                  </span>
                  <span
                    className={["text-[15px] font-bold tabular-nums", awayWon ? "text-[var(--accent)]" : "text-[var(--foreground)]"].join(" ")}
                    style={{ fontFamily: "var(--font-mono, ui-monospace)" }}
                  >
                    {awayAgg}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1" style={{ fontFamily: "var(--font-mono, ui-monospace)" }}>
              <span className={["w-12 text-center text-[36px] font-semibold leading-none tabular-nums", leg1Played ? "text-[var(--foreground)]" : "text-[var(--border-strong)]"].join(" ")}>
                {leg1Played ? leg1!.homeGoals : "–"}
              </span>
              <span className="text-[22px] font-light text-[var(--border-strong)] select-none">:</span>
              <span className={["w-12 text-center text-[36px] font-semibold leading-none tabular-nums", leg1Played ? "text-[var(--foreground)]" : "text-[var(--border-strong)]"].join(" ")}>
                {leg1Played ? leg1!.awayGoals : "–"}
              </span>
            </div>
          )}

          {/* Penalties display (read-only when set) */}
          {hasPenalties && (
            <div
              className="flex items-center gap-1 rounded-lg px-2 py-0.5"
              style={{ background: "var(--card-2)", fontFamily: "var(--font-mono, ui-monospace)" }}
            >
              <span className="text-[10px] font-medium text-[var(--muted)]">Rig.</span>
              <span className={["text-[13px] font-semibold tabular-nums", (series.penaltiesHome! > series.penaltiesAway!) ? "text-[var(--accent)]" : "text-[var(--foreground)]"].join(" ")}>
                {series.penaltiesHome}
              </span>
              <span className="text-[var(--border-strong)] text-[11px]">:</span>
              <span className={["text-[13px] font-semibold tabular-nums", (series.penaltiesAway! > series.penaltiesHome!) ? "text-[var(--accent)]" : "text-[var(--foreground)]"].join(" ")}>
                {series.penaltiesAway}
              </span>
            </div>
          )}

          {/* Outcome pill */}
          {winnerId && (
            <span
              className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-[var(--accent)]"
              style={{ background: "oklch(0.94 0.03 258)", fontFamily: "var(--font-display)" }}
            >
              {winnerId === homeTeam?.id ? homeTeam?.name?.split(" ")[0] : awayTeam?.name?.split(" ")[0]} vince
            </span>
          )}
        </div>

        {/* Away */}
        <div className={["flex flex-col items-center gap-2 text-center", homeWon ? "opacity-40" : ""].join(" ")}>
          <TeamCrest name={awayTeam?.name ?? "?"} size={40} />
          <div className="space-y-0.5">
            {series.awaySeed && (
              <p className="text-[10px] font-medium text-[var(--muted)]" style={{ fontFamily: "var(--font-mono, ui-monospace)" }}>
                #{series.awaySeed}
              </p>
            )}
            <p className={["text-[13px] font-semibold leading-tight", awayWon ? "text-[var(--accent)]" : "text-[var(--foreground)]"].join(" ")}>
              {awayTeam?.name ?? "TBD"}
            </p>
          </div>
        </div>
      </div>

      {/* Penalties input — shown when tied, not yet decided, and admin */}
      {isTied && !winnerId && isAdmin && (
        <div className="border-t border-[var(--border)] bg-[var(--card-2)] px-4 py-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]" style={{ fontFamily: "var(--font-display)" }}>
            Rigori
          </p>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="truncate max-w-[80px] text-[11px] text-[var(--muted)]">{homeTeam?.name}</span>
              <input
                value={penH}
                onChange={(e) => setPenH(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder="0"
                className="h-9 w-12 rounded-lg border border-[var(--border)] bg-[var(--card)] text-center text-[15px] font-semibold tabular-nums text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)] focus:bg-[var(--card)]"
                style={{ fontFamily: "var(--font-mono, ui-monospace)" }}
              />
            </div>
            <span className="text-[var(--border-strong)]" style={{ fontFamily: "var(--font-mono, ui-monospace)" }}>:</span>
            <div className="flex items-center gap-1.5">
              <input
                value={penA}
                onChange={(e) => setPenA(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder="0"
                className="h-9 w-12 rounded-lg border border-[var(--border)] bg-[var(--card)] text-center text-[15px] font-semibold tabular-nums text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)] focus:bg-[var(--card)]"
                style={{ fontFamily: "var(--font-mono, ui-monospace)" }}
              />
              <span className="truncate max-w-[80px] text-[11px] text-[var(--muted)]">{awayTeam?.name}</span>
            </div>
            <Button size="sm" onClick={savePenalties} disabled={savingPen}>
              {savingPen ? "…" : "Salva"}
            </Button>
          </div>
          {penErr && <p className="mt-1.5 text-[11px] text-red-600">{penErr}</p>}
        </div>
      )}

      {/* Action row */}
      {canAct && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] px-4 py-3">
          {matches.map((m) => (
            <Link
              key={m.id}
              href={`/leagues/${leagueId}/matches/${m.id}`}
              className="rounded-xl border border-[var(--border)] bg-[var(--card-2)] px-3 py-1.5 text-xs font-medium text-[var(--accent)] transition-colors hover:bg-[var(--card)]"
            >
              {m.homeGoals !== null ? "Modifica" : "Risultato"}
              {isTwoLeg ? ` G${m.leg}` : ""}
            </Link>
          ))}
          {allPlayed && canAct && (!isTied || hasPenalties) && (
            <Button
              size="sm"
              onClick={() => onAdvance(series.id)}
              disabled={advancing === series.id}
            >
              {advancing === series.id ? "…" : "Avanza vincitore"}
            </Button>
          )}
        </div>
      )}
    </div>
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
