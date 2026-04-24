"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card from "src/app/_components/ui/card";
import Badge from "src/app/_components/ui/badge";

type Row = {
  teamId: string;
  teamName: string;
  badgeUrl: string | null;
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

    async function load() {
      setErr(null);

      const res = await fetch(`/api/leagues/${leagueId}/table`, {
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErr(data?.error ?? "Errore classifica");
        return;
      }

      setRows(data);
    }

    load();
  }, [leagueId]);

  const currentRound = useMemo(() => {
    const maxPlayed = Math.max(...rows.map((row) => row.played), 0);
    return maxPlayed || 1;
  }, [rows]);

  if (!leagueId) return <div>Caricamento…</div>;

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="w-full space-y-5 pb-8">
        <header className="pt-2">
          <div className="flex items-end justify-between">
            <h1 className="text-[31px] font-black tracking-[-0.06em] text-[var(--foreground)]">
              Classifica
            </h1>

            <span className="text-sm font-semibold text-[var(--muted)]">
              G{currentRound}
            </span>
          </div>
        </header>

        {err && <Badge variant="error">{err}</Badge>}

        <Card className="overflow-hidden !p-0">
          {rows.length === 0 ? (
            <div className="p-5 text-sm text-[var(--muted)]">
              Nessuna partita con risultato inserito.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[34px_minmax(0,1fr)_34px_34px_42px_42px] border-b border-[var(--border)] px-2 py-3 text-xs font-medium text-[var(--muted)]">
                <div className="text-center">#</div>
                <div className="pl-1 text-left">Squadra</div>
                <div className="text-center">G</div>
                <div className="text-center">V</div>
                <div className="text-center">DR</div>
                <div className="pr-1 text-right">PT</div>
              </div>

              <div>
                {rows.map((row, index) => {
                  const isPromotion = index < 2;
                  const isRelegation = index === rows.length - 1;

                  return (
                    <div
                      key={row.teamId}
                      className="grid grid-cols-[34px_minmax(0,1fr)_34px_34px_42px_42px] items-center border-b border-[var(--border)] px-2 py-4 last:border-b-0"
                    >
                      <div className="relative text-center text-sm text-[var(--muted)]">
                        {isPromotion && (
                          <span className="absolute left-[-8px] top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[var(--accent)]" />
                        )}

                        {isRelegation && (
                          <span className="absolute left-[-8px] top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[var(--danger)]" />
                        )}

                        {index + 1}
                      </div>

                      <div className="min-w-0 pl-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <TeamLogo
                            name={row.teamName}
                            badgeUrl={row.badgeUrl}
                          />

                          <span className="min-w-0 truncate text-[15px] font-semibold text-[var(--foreground)]">
                            {row.teamName}
                          </span>
                        </div>
                      </div>

                      <div className="text-center text-sm text-[var(--muted)]">
                        {row.played}
                      </div>

                      <div className="text-center text-sm text-[var(--muted)]">
                        {row.wins}
                      </div>

                      <div
                        className={[
                          "text-center text-sm font-semibold",
                          row.gd > 0
                            ? "text-emerald-700"
                            : row.gd < 0
                              ? "text-red-600"
                              : "text-[var(--muted)]",
                        ].join(" ")}
                      >
                        {row.gd > 0 ? `+${row.gd}` : row.gd}
                      </div>

                      <div className="pr-1 text-right text-base font-black text-[var(--foreground)]">
                        {row.points}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-4 border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--muted)]">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                  Promozione
                </span>

                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[var(--danger)]" />
                  Retrocessione
                </span>
              </div>
            </>
          )}
        </Card>
      </div>
    </DashboardShell>
  );
}

function TeamLogo({
  name,
  badgeUrl,
}: {
  name: string;
  badgeUrl: string | null;
}) {
  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (badgeUrl) {
    return (
      <img
        src={badgeUrl}
        alt={`Logo ${name}`}
        className="h-8 w-8 shrink-0 rounded-lg object-contain"
      />
    );
  }

  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eef0ec] text-[11px] font-black text-[var(--foreground)]">
      {initials}
    </span>
  );
}