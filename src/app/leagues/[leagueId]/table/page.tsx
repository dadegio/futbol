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

        <section className="rounded-[28px] border border-white/8 bg-[#121214]/95 p-5 shadow-2xl shadow-black/20">
          {err ? (
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {err}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="text-white/45">
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
                  <tr key={r.teamId} className="rounded-2xl bg-white/[0.04] text-white">
                    <td className="rounded-l-2xl px-4 py-4 text-center text-white/70">{i + 1}</td>
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

          {rows.length === 0 ? (
            <div className="mt-4 rounded-2xl bg-white/[0.04] px-4 py-4 text-white/55">
              Nessuna partita con risultato inserito.
            </div>
          ) : null}
        </section>
      </div>
    </DashboardShell>
  );
}