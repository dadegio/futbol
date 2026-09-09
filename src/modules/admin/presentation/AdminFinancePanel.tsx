"use client";

import { Download, ReceiptText, ShieldCheck, UsersRound, WalletCards, type LucideIcon } from "lucide-react";
import Card from "src/app/_components/ui/card";
import Button from "src/app/_components/ui/button";
import type { AdminSummary } from "./admin-types";

function euro(cents: number) {
  return (cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function csvCell(value: string | number) {
  const text = String(value).replaceAll('"', '""');
  return `"${text}"`;
}

export default function AdminFinancePanel({ summary }: { summary: AdminSummary }) {
  const total = summary.totals.playerFeesCents + summary.totals.refereeFeesCents;
  const sortedTeams = [...summary.byTeam].sort((a, b) => b.totalFeesCents - a.totalFeesCents || a.teamName.localeCompare(b.teamName, "it"));

  function exportCsv() {
    const rows = [
      ["Squadra", "Presenze", "Quote presenze", "Quota arbitri", "Totale"],
      ...sortedTeams.map((team) => [
        team.teamName,
        team.appearances,
        (team.playerFeesCents / 100).toFixed(2),
        (team.refereeFeesCents / 100).toFixed(2),
        (team.totalFeesCents / 100).toFixed(2),
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(";")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `costi-${summary.league.name.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)]">Economia</p>
            <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-[var(--foreground)]">Costi maturati del torneo</h2>
            <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
              Calcolo automatico dalle presenze in distinta e dai costi arbitrali delle gare concluse. La quota arbitro viene ripartita a metà tra le due squadre.
            </p>
          </div>
          <Button variant="secondary" onClick={exportCsv}><Download size={15} /> Esporta CSV</Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FinanceMetric icon={WalletCards} label="Totale maturato" value={euro(total)} />
          <FinanceMetric icon={UsersRound} label="Quote presenze" value={euro(summary.totals.playerFeesCents)} note={`${summary.totals.sheetAppearances} presenze`} />
          <FinanceMetric icon={ShieldCheck} label="Arbitri" value={euro(summary.totals.refereeFeesCents)} note={`${summary.totals.playedMatches} gare concluse`} />
          <FinanceMetric icon={ReceiptText} label="Media per squadra" value={euro(summary.byTeam.length ? Math.round(total / summary.byTeam.length) : 0)} />
        </div>
      </Card>

      <Card className="overflow-hidden !p-0">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <p className="text-sm font-black text-[var(--foreground)]">Dettaglio per squadra</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Quote giocatori + metà del costo arbitro per ogni gara conclusa.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-black/10 text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">
              <tr>
                <th className="px-5 py-3">Squadra</th>
                <th className="px-4 py-3 text-right">Presenze</th>
                <th className="px-4 py-3 text-right">Giocatori</th>
                <th className="px-4 py-3 text-right">Arbitri</th>
                <th className="px-5 py-3 text-right">Totale</th>
              </tr>
            </thead>
            <tbody>
              {sortedTeams.map((team) => (
                <tr key={team.teamId} className="border-t border-[var(--border)]">
                  <td className="px-5 py-3 font-black text-[var(--foreground)]">{team.teamName}</td>
                  <td className="px-4 py-3 text-right text-[var(--muted)]">{team.appearances}</td>
                  <td className="px-4 py-3 text-right text-[var(--muted)]">{euro(team.playerFeesCents)}</td>
                  <td className="px-4 py-3 text-right text-[var(--muted)]">{euro(team.refereeFeesCents)}</td>
                  <td className="px-5 py-3 text-right font-black text-[var(--foreground)]">{euro(team.totalFeesCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function FinanceMetric({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-4">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Icon size={16} /></span>
      <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-black tracking-[-0.05em] text-[var(--foreground)]">{value}</p>
      {note && <p className="mt-1 text-xs text-[var(--muted)]">{note}</p>}
    </div>
  );
}
