"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import DashboardShell from "src/app/_components/dashboard-shell";

type Row = {
  teamId: string;
  teamName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

export default function TablePage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!leagueId) return;

    (async () => {
      setErr(null);
      const res = await fetch(`/api/leagues/${leagueId}/table`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data?.error ?? "Errore classifica");
        return;
      }
      setRows(data);
    })();
  }, [leagueId]);

  if (!leagueId) return <div>Caricamento…</div>;

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="space-y-6">
        <section className="rounded-[28px] border border-white/8 bg-[var(--card)]/95 p-5 md:p-6 shadow-2xl shadow-black/20">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
            Table
          </div>
          <h1 className="mt-2 text-2xl md:text-3xl font-black text-[var(--foreground)]">
            Classifica
          </h1>
          <p className="mt-2 text-sm text-[var(--foreground)]/60">
            Punti, risultati e differenza reti aggiornati in base alle partite giocate.
          </p>
        </section>

        {err ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        ) : null}

        <section className="rounded-[28px] border border-white/8 bg-[var(--card)]/95 p-4 md:p-5 shadow-2xl shadow-black/20">
          {rows.length === 0 ? (
            <div className="rounded-2xl bg-white/[0.04] px-4 py-4 text-[var(--foreground)]/55">
              Nessuna partita con risultato inserito.
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2 text-sm">
                  <thead>
                    <tr className="text-[var(--foreground)]/45">
                      {["#", "Squadra", "Pt", "G", "V", "N", "P", "GF", "GS", "DR"].map((h) => (
                        <th
                          key={h}
                          className={`px-4 py-3 ${h === "Squadra" ? "text-left" : "text-center"}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.teamId} className="bg-white/[0.04] text-[var(--foreground)]">
                        <td className="rounded-l-2xl px-4 py-4 text-center text-[var(--foreground)]/70">{i + 1}</td>
                        <td className="px-4 py-4 font-semibold">{r.teamName}</td>
                        <td className="px-4 py-4 text-center font-black text-[var(--accent)]">{r.points}</td>
                        <td className="px-4 py-4 text-center">{r.played}</td>
                        <td className="px-4 py-4 text-center">{r.wins}</td>
                        <td className="px-4 py-4 text-center">{r.draws}</td>
                        <td className="px-4 py-4 text-center">{r.losses}</td>
                        <td className="px-4 py-4 text-center">{r.gf}</td>
                        <td className="px-4 py-4 text-center">{r.ga}</td>
                        <td className="rounded-r-2xl px-4 py-4 text-center">{r.gd}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {rows.map((r, i) => (
                  <div
                    key={r.teamId}
                    className="rounded-2xl border border-white/8 bg-white/[0.04] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs uppercase tracking-[0.18em] text-[var(--foreground)]/40">
                          #{i + 1}
                        </div>
                        <div className="mt-1 truncate text-lg font-bold text-[var(--foreground)]">
                          {r.teamName}
                        </div>
                      </div>

                      <div className="rounded-2xl bg-[var(--accent)] px-4 py-2 text-lg font-black text-black">
                        {r.points} pt
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                      <StatChip label="G" value={r.played} />
                      <StatChip label="V" value={r.wins} />
                      <StatChip label="N" value={r.draws} />
                      <StatChip label="P" value={r.losses} />
                      <StatChip label="GF" value={r.gf} />
                      <StatChip label="GS" value={r.ga} />
                    </div>

                    <div className="mt-2">
                      <StatChip label="DR" value={r.gd} wide />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}

function StatChip({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: number;
  wide?: boolean;
}) {
  return (
    <div className={`rounded-xl bg-black/5 px-3 py-2 ${wide ? "w-full" : ""}`}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--foreground)]/40">
        {label}
      </div>
      <div className="mt-1 font-bold text-[var(--foreground)]">{value}</div>
    </div>
  );
}