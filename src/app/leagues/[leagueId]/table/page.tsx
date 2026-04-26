"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

type TableResponse = Row[] | { error?: string };

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

      const data: TableResponse = await res.json().catch(() => []);

      if (!res.ok) {
        setErr((data as { error?: string })?.error ?? "Errore classifica");
        return;
      }

      setRows(Array.isArray(data) ? data : []);
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
          <div className="flex items-end justify-between gap-3">
            <h1 className="text-[31px] font-black tracking-[-0.06em] text-[var(--foreground)]">
              Classifica
            </h1>

            <span className="shrink-0 text-sm font-semibold text-[var(--muted)]">
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
              <div className="grid grid-cols-[34px_minmax(0,1.8fr)_34px_34px_46px_46px] border-b border-[var(--border)] px-2 py-3 text-xs font-medium text-[var(--muted)] sm:grid-cols-[40px_minmax(0,2.2fr)_42px_42px_52px_56px] sm:px-3">
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
                    <Link
                      key={row.teamId}
                      href={`/leagues/${leagueId}/teams/${row.teamId}`}
                      className="grid grid-cols-[34px_minmax(0,1.8fr)_34px_34px_46px_46px] items-center border-b border-[var(--border)] px-2 py-3 transition hover:bg-white/5 last:border-b-0 sm:grid-cols-[40px_minmax(0,2.2fr)_42px_42px_52px_56px] sm:px-3 sm:py-4"
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
                        <div className="flex min-w-0 items-center gap-2.5">
                          <TeamLogo name={row.teamName} badgeUrl={row.badgeUrl} />

                          <div className="min-w-0">
                            <div className="truncate text-[14px] font-semibold leading-tight text-[var(--foreground)] sm:text-[15px]">
                              {row.teamName}
                            </div>
                            <div className="mt-0.5 text-[11px] text-[var(--muted)] sm:hidden">
                              GF {row.gf} · GS {row.ga}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="text-center text-sm tabular-nums text-[var(--muted)]">
                        {row.played}
                      </div>

                      <div className="text-center text-sm tabular-nums text-[var(--muted)]">
                        {row.wins}
                      </div>

                      <div
                        className={[
                          "text-center text-sm font-semibold tabular-nums",
                          row.gd > 0
                            ? "text-emerald-600"
                            : row.gd < 0
                              ? "text-red-500"
                              : "text-[var(--muted)]",
                        ].join(" ")}
                      >
                        {row.gd > 0 ? `+${row.gd}` : row.gd}
                      </div>

                      <div className="pr-1 text-right text-base font-black tabular-nums text-[var(--foreground)]">
                        {row.points}
                      </div>
                    </Link>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--muted)]">
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
        className="h-9 w-9 shrink-0 rounded-xl object-contain sm:h-10 sm:w-10"
      />
    );
  }

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef0ec] text-[11px] font-black text-[var(--foreground)] sm:h-10 sm:w-10">
      {initials}
    </span>
  );
}