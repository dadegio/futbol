"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "src/app/_components/ui/button";
import Badge from "src/app/_components/ui/badge";

type Props = {
  leagueId: string;
  teamCount: number;
  onCreated: () => void;
};

type TeamRow = { teamId: string; teamName: string; points: number; gd: number };

export default function PlayoffSetup({ leagueId, teamCount, onCreated }: Props) {
  const [format, setFormat] = useState<"SINGLE_ELIM" | "TWO_LEG">("SINGLE_ELIM");
  const [count, setCount] = useState(() => {
    if (teamCount >= 16) return 16;
    if (teamCount >= 8) return 8;
    if (teamCount >= 4) return 4;
    return 2;
  });
  const [autoSeed, setAutoSeed] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Manual seeding state
  const [standings, setStandings] = useState<TeamRow[]>([]);
  const [seedOrder, setSeedOrder] = useState<TeamRow[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const availableCounts = [2, 4, 8, 16].filter((n) => n <= teamCount);

  const loadStandings = useCallback(async () => {
    try {
      const res = await fetch(`/api/leagues/${leagueId}/table`, { cache: "no-store" });
      const data: TeamRow[] = await res.json();
      setStandings(data);
      setSeedOrder(data.slice(0, count));
    } catch {
      // standings not critical for setup
    }
  }, [leagueId, count]);

  useEffect(() => {
    if (!autoSeed) {
      loadStandings();
    }
  }, [autoSeed, loadStandings]);

  useEffect(() => {
    if (standings.length > 0) {
      setSeedOrder(standings.slice(0, count));
    }
  }, [count, standings]);

  function handleDragStart(idx: number) {
    setDragIdx(idx);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;

    const updated = [...seedOrder];
    const [moved] = updated.splice(dragIdx, 1);
    updated.splice(idx, 0, moved);
    setSeedOrder(updated);
    setDragIdx(idx);
  }

  function handleDragEnd() {
    setDragIdx(null);
  }

  async function handleCreate() {
    setErr(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/leagues/${leagueId}/playoffs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          teamCount: count,
          autoSeed,
          ...(!autoSeed && seedOrder.length > 0
            ? { manualTeamIds: seedOrder.map((t) => t.teamId) }
            : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error ?? "Errore");
      onCreated();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Format */}
      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--foreground)]/70">
          Formato
        </label>
        <div className="flex flex-wrap gap-3">
          <Button
            variant={format === "SINGLE_ELIM" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setFormat("SINGLE_ELIM")}
          >
            Eliminazione diretta
          </Button>
          <Button
            variant={format === "TWO_LEG" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setFormat("TWO_LEG")}
          >
            Andata e ritorno
          </Button>
        </div>
      </div>

      {/* Team count */}
      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--foreground)]/70">
          Squadre qualificate
        </label>
        <div className="flex flex-wrap gap-3">
          {availableCounts.map((n) => (
            <Button
              key={n}
              variant={count === n ? "primary" : "secondary"}
              size="sm"
              onClick={() => setCount(n)}
            >
              Top {n}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--foreground)]/50">
          Hai {teamCount} squadre nel torneo
        </p>
      </div>

      {/* Seeding mode */}
      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--foreground)]/70">
          Tabellone
        </label>
        <div className="flex flex-wrap gap-3">
          <Button
            variant={autoSeed ? "primary" : "secondary"}
            size="sm"
            onClick={() => setAutoSeed(true)}
          >
            Automatico da classifica
          </Button>
          <Button
            variant={!autoSeed ? "primary" : "secondary"}
            size="sm"
            onClick={() => setAutoSeed(false)}
          >
            Manuale
          </Button>
        </div>
      </div>

      {/* Manual seeding — drag to reorder */}
      {!autoSeed && seedOrder.length > 0 && (
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--foreground)]/70">
            Ordine teste di serie (trascina per riordinare)
          </label>
          <div className="space-y-1.5">
            {seedOrder.map((team, idx) => (
              <div
                key={team.teamId}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={[
                  "flex cursor-grab items-center gap-3 rounded-2xl border px-4 py-3 transition active:cursor-grabbing",
                  dragIdx === idx
                    ? "border-[var(--accent)]/40 bg-[var(--accent)]/10"
                    : "border-white/8 bg-white/[0.03] hover:border-white/15",
                ].join(" ")}
              >
                <span className="w-7 text-center text-sm font-bold text-[var(--accent)]">
                  {idx + 1}
                </span>
                <span className="flex-1 text-sm font-semibold text-[var(--foreground)]">
                  {team.teamName}
                </span>
                <span className="text-xs text-[var(--foreground)]/40">
                  {team.points} pt &middot; {team.gd > 0 ? "+" : ""}{team.gd} dr
                </span>
                <span className="text-[var(--foreground)]/25">⠿</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {err && <Badge variant="error">{err}</Badge>}

      <Button onClick={handleCreate} disabled={submitting}>
        {submitting ? "Creazione..." : "Crea playoff"}
      </Button>
    </div>
  );
}
