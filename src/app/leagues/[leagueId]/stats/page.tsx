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
      <div className="w-full space-y-6 pb-8">
        <header className="pt-2">
          <h1 className="text-[31px] font-black tracking-[-0.06em] text-[var(--foreground)]">
            Statistiche
          </h1>
        </header>

        {err && <Badge variant="error">{err}</Badge>}

        <section className="grid gap-6 xl:grid-cols-2">
          <div>
            <div className="mb-3 text-base font-semibold text-[var(--foreground)]">
              Top 5 Marcatori
            </div>
            <StatList rows={scorers} />
          </div>

          <div>
            <div className="mb-3 text-base font-semibold text-[var(--foreground)]">
              Top 5 Assistman
            </div>
            <StatList rows={assists} />
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

function StatList({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <span className="text-sm text-[var(--muted)]">Nessun dato.</span>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden !p-0">
      {rows.map((r, i) => (
        <div
          key={r.playerId}
          className="grid items-center gap-3 border-b border-[var(--border)] px-4 py-3 last:border-b-0"
          style={{ gridTemplateColumns: "20px 1fr auto" }}
        >
          <span
            className="text-xs tabular-nums text-[var(--muted)]"
            style={{ fontFamily: "var(--font-mono, ui-monospace)" }}
          >
            {i + 1}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold text-[var(--foreground)]">
              {r.firstName} {r.lastName}
            </div>
            <div className="truncate text-xs text-[var(--muted)]">{r.teamName}</div>
          </div>
          <div
            className="text-[22px] font-semibold tabular-nums leading-none text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-mono, ui-monospace)" }}
          >
            {r.value}
          </div>
        </div>
      ))}
    </Card>
  );
}
