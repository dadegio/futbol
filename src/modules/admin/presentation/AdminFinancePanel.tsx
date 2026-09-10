"use client";

import { useMemo, useState } from "react";
import { Download, HandCoins, ReceiptText, UsersRound, WalletCards, type LucideIcon } from "lucide-react";
import Card from "src/app/_components/ui/card";
import Button from "src/app/_components/ui/button";
import Badge from "src/app/_components/ui/badge";
import { FUTPOLI_RULES } from "@/modules/players/domain/tournament-rules";
import { authFetch } from "@/lib/client-auth";
import { readApiError } from "@/modules/core/client-error";
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
  const sortedTeams = useMemo(() => [...summary.byTeam].sort(
    (a, b) => b.outstandingCents - a.outstandingCents || a.teamName.localeCompare(b.teamName, "it")
  ), [summary.byTeam]);
  const [teamId, setTeamId] = useState(sortedTeams.find((team) => team.outstandingCents > 0)?.teamId ?? "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function exportCsv() {
    const rows = [
      ["Squadra", "Presenze", "Maturato", "Pagato", "Residuo"],
      ...sortedTeams.map((team) => [
        team.teamName,
        team.appearances,
        (team.playerFeesCents / 100).toFixed(2),
        (team.paidCents / 100).toFixed(2),
        (team.outstandingCents / 100).toFixed(2),
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

  async function recordPayment() {
    const euroValue = Number(amount.replace(",", "."));
    if (!teamId || !Number.isFinite(euroValue) || euroValue <= 0) {
      setError("Seleziona una squadra e inserisci un importo valido");
      return;
    }
    setSaving(true); setError(null); setMessage(null);
    try {
      const response = await authFetch(`/api/leagues/${summary.league.id}/admin/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, amountCents: Math.round(euroValue * 100), note }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readApiError(payload, "Registrazione pagamento non riuscita"));
      setMessage("Pagamento registrato");
      setAmount(""); setNote("");
      window.setTimeout(() => window.location.reload(), 500);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Registrazione pagamento non riuscita");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)]">Economia</p>
            <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-[var(--foreground)]">Quote presenze</h2>
            <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">Solo quota giocatore per presenza in distinta su partite definitive. I costi arbitrali restano completamente fuori da questi conteggi.</p>
          </div>
          <Button variant="secondary" onClick={exportCsv}><Download size={15} /> Esporta CSV</Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FinanceMetric icon={WalletCards} label="Maturato" value={euro(total)} />
          <FinanceMetric icon={HandCoins} label="Pagato" value={euro(summary.totals.paidCents)} />
          <FinanceMetric icon={ReceiptText} label="Residuo" value={euro(summary.totals.outstandingCents)} />
          <FinanceMetric icon={UsersRound} label="Presenze" value={String(summary.totals.sheetAppearances)} note={`${euro(FUTPOLI_RULES.playerFeeCentsPerAppearance)} cad.`} />
        </div>
      </Card>

      <Card>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)]">Export amministrativi</p>
        <p className="mt-1 text-sm text-[var(--muted)]">Scarica dati puliti dal server per archivio, controlli e condivisione.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            ["calendar", "Calendario"],
            ["results", "Risultati"],
            ["scorers", "Marcatori"],
            ["fees", "Quote"],
            ["players", "Giocatori"],
          ].map(([kind, label]) => (
            <a key={kind} href={`/api/leagues/${summary.league.id}/admin/export/${kind}`} className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-4 text-xs font-black text-[var(--foreground)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]">
              <Download size={14} /> {label}
            </a>
          ))}
        </div>
      </Card>

      <Card>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)]">Registra pagamento</p>
        <p className="mt-1 text-sm text-[var(--muted)]">Segna una quota già ricevuta da una squadra. Non sono ammessi importi superiori al residuo.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_minmax(0,1fr)_auto] md:items-end">
          <label className="text-xs font-bold text-[var(--muted)]">Squadra
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="mt-1 h-11 w-full rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-3 text-sm text-[var(--foreground)]">
              <option value="">Seleziona…</option>
              {sortedTeams.map((team) => <option key={team.teamId} value={team.teamId}>{team.teamName} · residuo {euro(team.outstandingCents)}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-[var(--muted)]">Importo €
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="10,00" className="mt-1 h-11 w-full rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-3 text-sm text-[var(--foreground)]" />
          </label>
          <label className="text-xs font-bold text-[var(--muted)]">Nota
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bonifico / contanti…" className="mt-1 h-11 w-full rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-3 text-sm text-[var(--foreground)]" />
          </label>
          <Button onClick={recordPayment} disabled={saving}>{saving ? "Salvo…" : "Registra"}</Button>
        </div>
        {message && <Badge variant="success" className="mt-3">{message}</Badge>}
        {error && <Badge variant="error" className="mt-3">{error}</Badge>}
      </Card>

      <Card className="overflow-hidden !p-0">
        <div className="border-b border-[var(--border)] px-5 py-4"><p className="text-sm font-black text-[var(--foreground)]">Dettaglio per squadra</p></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-black/10 text-[10px] font-black uppercase tracking-wider text-[var(--muted)]"><tr><th className="px-5 py-3">Squadra</th><th className="px-4 py-3 text-right">Presenze</th><th className="px-4 py-3 text-right">Maturato</th><th className="px-4 py-3 text-right">Pagato</th><th className="px-5 py-3 text-right">Residuo</th></tr></thead>
            <tbody>{sortedTeams.map((team) => <tr key={team.teamId} className="border-t border-[var(--border)]"><td className="px-5 py-3 font-black text-[var(--foreground)]">{team.teamName}</td><td className="px-4 py-3 text-right text-[var(--muted)]">{team.appearances}</td><td className="px-4 py-3 text-right text-[var(--muted)]">{euro(team.playerFeesCents)}</td><td className="px-4 py-3 text-right text-emerald-400">{euro(team.paidCents)}</td><td className="px-5 py-3 text-right font-black text-[var(--foreground)]">{euro(team.outstandingCents)}</td></tr>)}</tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function FinanceMetric({ icon: Icon, label, value, note }: { icon: LucideIcon; label: string; value: string; note?: string }) {
  return <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Icon size={16} /></span><p className="mt-3 text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">{label}</p><p className="mt-1 text-2xl font-black tracking-[-0.05em] text-[var(--foreground)]">{value}</p>{note && <p className="mt-1 text-xs text-[var(--muted)]">{note}</p>}</div>;
}
