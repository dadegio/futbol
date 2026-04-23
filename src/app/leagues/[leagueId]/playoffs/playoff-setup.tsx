"use client";

import { useState } from "react";
import Button from "src/app/_components/ui/button";
import Badge from "src/app/_components/ui/badge";

type Props = {
  leagueId: string;
  teamCount: number;
  onCreated: () => void;
};

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

  const availableCounts = [2, 4, 8, 16].filter((n) => n <= teamCount);

  async function handleCreate() {
    setErr(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/leagues/${leagueId}/playoffs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, teamCount: count, autoSeed }),
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

      {err && <Badge variant="error">{err}</Badge>}

      <Button onClick={handleCreate} disabled={submitting}>
        {submitting ? "Creazione..." : "Crea playoff"}
      </Button>
    </div>
  );
}
