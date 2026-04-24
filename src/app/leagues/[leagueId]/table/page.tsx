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
      <div className="mx-auto w-full max-w-[480px] space-y-6 px-4 pb-8">
        <header className="pt-2">
          <Link
            href={`/leagues/${leagueId}`}
            className="mb-8 flex items-center gap-3 text-sm text-[var(--muted)]"
          >
            <span className="text-xl leading-none">‹</span>
            <span>Coppa Primavera 2026</span>
          </Link>

          <div className="flex items-end justify-between">
            <h1 className="text-[31px] font-black tracking-[-0.06em] text-[var(--foreground)]">
              Classifica
            </h1>

            <span className="text-sm font-semibold text-[var(--muted)]">
              G{currentRound}
            </span>
          </div>
        </header>

        <div className="flex gap-8 border-b border-[var(--border)] text-base">
          <button
            type="button"
            className="border-b-2 border-[var(--accent)] pb-3 font-medium text-[var(--foreground)]"
          >
            Generale
          </button>

          <button
            type="button"
            className="pb-3 font-medium text-[var(--muted)]"
          >
            Casa
          </button>

          <button
            type="button"
            className="pb-3 font-medium text-[var(--muted)]"
          >
            Trasferta
          </button>
        </div>

        {err && <Badge variant="error">{err}</Badge>}

        <Card className="overflow-hidden !p-0">
          {rows.length === 0 ? (
            <div className="p-5 text-sm text-[var(--muted)]">
              Nessuna partita con risultato inserito.
            </div>
          ) : (
            <>
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-xs font-medium text-[var(--muted)]">
                    <th className="w-[34px] px-2 py-3 text-center">#</th>
                    <th className="px-1 py-3 text-left">Squadra</th>
                    <th className="w-[34px] px-1 py-3 text-center">G</th>
                    <th className="w-[34px] px-1 py-3 text-center">V</th>
                    <th className="w-[42px] px-1 py-3 text-center">DR</th>
                    <th className="w-[42px] px-3 py-3 text-right">PT</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row, index) => {
                    const isPromotion = index < 2;
                    const isRelegation = index === rows.length - 1;

                    return (
                      <tr
                        key={row.teamId}
                        className="border-b border-[var(--border)] last:border-b-0"
                      >
                        <td className="relative px-2 py-4 text-center text-[var(--muted)]">
                          {isPromotion && (
                            <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[var(--accent)]" />
                          )}

                          {isRelegation && (
                            <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[var(--danger)]" />
                          )}

                          {index + 1}
                        </td>

                        <td className="min-w-0 px-1 py-4">
                          <div className="flex min-w-0 items-center gap-2">
                            <TeamLogo
                              name={row.teamName}
                              badgeUrl={row.badgeUrl}
                            />

                            <span className="min-w-0 truncate text-[15px] font-semibold text-[var(--foreground)]">
                              {row.teamName}
                            </span>
                          </div>
                        </td>

                        <td className="px-1 py-4 text-center text-[var(--muted)]">
                          {row.played}
                        </td>

                        <td className="px-1 py-4 text-center text-[var(--muted)]">
                          {row.wins}
                        </td>

                        <td
                          className={[
                            "px-1 py-4 text-center font-semibold",
                            row.gd > 0
                              ? "text-emerald-700"
                              : row.gd < 0
                                ? "text-red-600"
                                : "text-[var(--muted)]",
                          ].join(" ")}
                        >
                          {row.gd > 0 ? `+${row.gd}` : row.gd}
                        </td>

                        <td className="px-3 py-4 text-right text-base font-black text-[var(--foreground)]">
                          {row.points}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

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
        className="h-8 w-8 shrink-0 rounded-lg object-cover"
      />
    );
  }

  const colors = [
    "bg-green-200 text-green-900",
    "bg-pink-200 text-pink-900",
    "bg-cyan-200 text-cyan-900",
    "bg-orange-200 text-orange-900",
    "bg-violet-200 text-violet-900",
    "bg-fuchsia-200 text-fuchsia-900",
  ];

  const index = initials.charCodeAt(0) % colors.length;

  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-black ${colors[index]}`}
    >
      {initials}
    </span>
  );
}