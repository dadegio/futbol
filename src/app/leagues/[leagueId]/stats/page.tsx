"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import DashboardShell from "src/app/_components/dashboard-shell";

type Row = {
  playerId: string;
  firstName: string;
  lastName: string;
  teamName: string;
  value: number;
};

export default function StatsPage() {
  const { leagueId } = useParams<{ leagueId: string }>();

  const [scorers, setScorers] = useState<Row[]>([]);
  const [assists, setAssists] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!leagueId) return;

    (async () => {
      setErr(null);
      try {
        const res = await fetch(`/api/leagues/${leagueId}/stats`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Errore stats");
        setScorers(data.scorers ?? []);
        setAssists(data.assists ?? []);
      } catch (e: any) {
        setErr(e.message);
      }
    })();
  }, [leagueId]);

  if (!leagueId) return <div>Caricamento…</div>;

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="space-y-6">

        {err ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-[28px] border border-white/8 bg-[#121214]/95 p-5 shadow-2xl shadow-black/20">
            <div className="mb-4 text-xl font-black text-white">Top 5 Marcatori</div>

            <div className="space-y-3">
              {scorers.map((r, i) => (
                <div
                  key={r.playerId}
                  className="flex items-center justify-between gap-4 rounded-2xl bg-white/[0.04] px-4 py-4"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-white/45">#{i + 1}</div>
                    <div className="truncate font-bold text-white">
                      {r.firstName} {r.lastName}
                    </div>
                    <div className="truncate text-sm text-white/50">{r.teamName}</div>
                  </div>

                  <div className="rounded-2xl bg-[var(--accent)] px-4 py-2 text-xl font-black text-black">
                    {r.value}
                  </div>
                </div>
              ))}

              {scorers.length === 0 ? (
                <div className="rounded-2xl bg-white/[0.04] px-4 py-4 text-white/55">
                  Nessun dato.
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/8 bg-[#121214]/95 p-5 shadow-2xl shadow-black/20">
            <div className="mb-4 text-xl font-black text-white">Top 5 Assistman</div>

            <div className="space-y-3">
              {assists.map((r, i) => (
                <div
                  key={r.playerId}
                  className="flex items-center justify-between gap-4 rounded-2xl bg-white/[0.04] px-4 py-4"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-white/45">#{i + 1}</div>
                    <div className="truncate font-bold text-white">
                      {r.firstName} {r.lastName}
                    </div>
                    <div className="truncate text-sm text-white/50">{r.teamName}</div>
                  </div>

                  <div className="rounded-2xl bg-[var(--accent)] px-4 py-2 text-xl font-black text-black">
                    {r.value}
                  </div>
                </div>
              ))}

              {assists.length === 0 ? (
                <div className="rounded-2xl bg-white/[0.04] px-4 py-4 text-white/55">
                  Nessun dato.
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}