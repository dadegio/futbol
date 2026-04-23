"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card from "src/app/_components/ui/card";
import Badge from "src/app/_components/ui/badge";

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
        {err && <Badge variant="error">{err}</Badge>}

        <section className="grid gap-6 xl:grid-cols-2">
          <Card>
            <div className="mb-4 text-xl font-black text-white">Top 5 Marcatori</div>
            <StatList rows={scorers} />
          </Card>

          <Card>
            <div className="mb-4 text-xl font-black text-white">Top 5 Assistman</div>
            <StatList rows={assists} />
          </Card>
        </section>
      </div>
    </DashboardShell>
  );
}

function StatList({ rows }: { rows: Row[] }) {
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <Card key={r.playerId} variant="flat">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm text-white/45">#{i + 1}</div>
              <div className="truncate font-bold text-white">
                {r.firstName} {r.lastName}
              </div>
              <div className="truncate text-sm text-white/50">{r.teamName}</div>
            </div>

            <Badge variant="accent" className="text-xl">
              {r.value}
            </Badge>
          </div>
        </Card>
      ))}

      {rows.length === 0 && (
        <Card variant="flat">
          <span className="text-white/55">Nessun dato.</span>
        </Card>
      )}
    </div>
  );
}
