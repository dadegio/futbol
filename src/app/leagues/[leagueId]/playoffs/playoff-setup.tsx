"use client";

import { useState } from "react";

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
          <button
            onClick={() => setFormat("SINGLE_ELIM")}
            className={`rounded-2xl px-4 py-2 font-medium transition ${
              format === "SINGLE_ELIM"
                ? "bg-[var(--accent)] text-black"
                : "border border-white/10 bg-white/5 text-[var(--foreground)]/80"
            }`}
          >
            Eliminazione diretta
          </button>
          <button
            onClick={() => setFormat("TWO_LEG")}
            className={`rounded-2xl px-4 py-2 font-medium transition ${
              format === "TWO_LEG"
                ? "bg-[var(--accent)] text-black"
                : "border border-white/10 bg-white/5 text-[var(--foreground)]/80"
            }`}
          >
            Andata e ritorno
          </button>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--foreground)]/70">
          Squadre qualificate
        </label>
        <div className="flex flex-wrap gap-3">
          {availableCounts.map((n) => (
            <button
              key={n}
              onClick={() => setCount(n)}
              className={`rounded-2xl px-4 py-2 font-medium transition ${
                count === n
                  ? "bg-[var(--accent)] text-black"
                  : "border border-white/10 bg-white/5 text-[var(--foreground)]/80"
              }`}
            >
              Top {n}
            </button>
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
          <button
            onClick={() => setAutoSeed(true)}
            className={`rounded-2xl px-4 py-2 font-medium transition ${
              autoSeed
                ? "bg-[var(--accent)] text-black"
                : "border border-white/10 bg-white/5 text-[var(--foreground)]/80"
            }`}
          >
            Automatico da classifica
          </button>
          <button
            onClick={() => setAutoSeed(false)}
            className={`rounded-2xl px-4 py-2 font-medium transition ${
              !autoSeed
                ? "bg-[var(--accent)] text-black"
                : "border border-white/10 bg-white/5 text-[var(--foreground)]/80"
            }`}
          >
            Manuale
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      )}

      <button
        onClick={handleCreate}
        disabled={submitting}
        className="rounded-2xl bg-[var(--accent)] px-6 py-3 font-bold text-black disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Creazione..." : "Crea playoff"}
      </button>
    </div>
  );
}
