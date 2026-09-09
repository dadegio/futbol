"use client";

import { Download, ReceiptText, UsersRound, WalletCards, type LucideIcon } from "lucide-react";
import Card from "src/app/_components/ui/card";
import Button from "src/app/_components/ui/button";
import { FUTPOLI_RULES } from "@/modules/players/domain/tournament-rules";
import type { AdminSummary } from "./admin-types";

function euro(cents: number) {
  return (cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function csvCell(value: string | number) {
  const text = String(value).replaceAll('"', '""');
  return `"${text}"`;
}

export default function AdminFinancePanel({ summary }: { summary: AdminSummary }) {
  const total = summary.totals.playerFeesCents;
  const sortedTeams = [...summary.byTeam].sort(
    (a, b) => b.playerFeesCents - a.playerFeesCents || a.teamName.localeCompare(b.teamName, "it")
  );

  function exportCsv() {
    const rows = [
      ["Squadra", "Presenze", "Quote presenze"],
      ...sortedTeams.map((team) => [
        team.teamName,
        team.appearances,
        (team.playerFeesCents / 100).toFixed(2),
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(";")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `quote-presenze-${summary.league.name.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)]">Economia</p>
            <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-[var(--foreground)]">Quote presenze maturate</h2>
            <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
              Il riepilogo economico considera esclusivamente la quota giocatore per presenza in distinta. I costi arbitrali sono gestiti direttamente dalle squadre e non entrano nei conteggi del torneo.
            </p>
          </div>
          <Button variant="secondary" onClick={exportCsv}><Download size={15} /> Esporta CSV</Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FinanceMetric icon={WalletCards} label="Totale quote" value={euro(total)} />
          <FinanceMetric icon={UsersRound} label="Presenze" value={String(summary.totals.sheetAppearances)} note="giocatori inseriti in distinta" />
          <FinanceMetric icon={ReceiptText} label="Quota per presenza" value={euro(FUTPOLI_RULES.playerFeeCentsPerAppearance)} />
          <FinanceMetric icon={WalletCards} label="Media per squadra" value={euro(summary.byTeam.length ? Math.round(total / summary.byTeam.length) : 0)} />
        </div>
      </Card>

      <Card className="overflow-hidden !p-0">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <p className="text-sm font-black text-[var(--foreground)]">Dettaglio per squadra</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Solo quote maturate dalle presenze in distinta.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-black/10 text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">
              <tr>
                <th className="px-5 py-3">Squadra</th>
                <th className="px-4 py-3 text-right">Presenze</th>
                <th className="px-5 py-3 text-right">Quote giocatori</th>
              </tr>
            </thead>
            <tbody>
              {sortedTeams.map((team) => (
                <tr key={team.teamId} className="border-t border-[var(--border)]">
                  <td className="px-5 py-3 font-black text-[var(--foreground)]">{team.teamName}</td>
                  <td className="px-4 py-3 text-right text-[var(--muted)]">{team.appearances}</td>
                  <td className="px-5 py-3 text-right font-black text-[var(--foreground)]">{euro(team.playerFeesCents)}</td>
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
