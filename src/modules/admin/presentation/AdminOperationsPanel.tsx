"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Clock3,
  MapPin,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import Card from "src/app/_components/ui/card";
import Badge from "src/app/_components/ui/badge";
import Button from "src/app/_components/ui/button";
import { authFetch } from "@/lib/client-auth";
import type { MatchOperationalStatus } from "@/modules/matches/domain/match-operational-status";

type OperationalIssue = {
  code: string;
  label: string;
  severity: "warning" | "error";
};

type OperationalMatch = {
  id: string;
  round: number;
  phase: "league" | "playoff";
  leg: number | null;
  date: string | null;
  slotEnd: string | null;
  venueKey: string | null;
  venueName: string | null;
  venueAddress: string | null;
  referee: { id: string; name: string } | null;
  refereeManualOverride: boolean;
  homeTeam: { id: string; name: string; badgeUrl: string | null };
  awayTeam: { id: string; name: string; badgeUrl: string | null };
  homeGoals: number | null;
  awayGoals: number | null;
  homeSheetCount: number;
  awaySheetCount: number;
  status: MatchOperationalStatus;
  issues: OperationalIssue[];
  inCurrentWeek: boolean;
  resultStatus: "DRAFT" | "FINAL" | null;
  lifecycleStatus: "SCHEDULED" | "POSTPONED" | "CANCELLED";
};

type OperationsResponse = {
  totals: {
    matches: number;
    attention: number;
    withoutSlot: number;
    withoutReferee: number;
    refereeConflicts: number;
    overdueResults: number;
    ready: number;
    draftResults: number;
    postponed: number;
    completed: number;
    currentWeek: number;
    upcoming: number;
  };
  matches: OperationalMatch[];
};

type Filter = "attention" | "week" | "upcoming" | "completed" | "all";

const STATUS_LABELS: Record<MatchOperationalStatus, string> = {
  NEEDS_SETUP: "Da organizzare",
  BOOKED: "Prenotata",
  READY: "Pronta",
  AWAITING_RESULT: "Risultato mancante",
  DRAFT_RESULT: "Bozza risultato",
  POSTPONED: "Rinviata",
  CANCELLED: "Annullata",
  COMPLETED: "Completata",
  ISSUE: "Problema",
};

function formatDate(value: string | null) {
  if (!value) return "Data da definire";
  return new Date(value).toLocaleString("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusTone(status: MatchOperationalStatus) {
  if (status === "COMPLETED" || status === "READY") return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  if (status === "AWAITING_RESULT" || status === "ISSUE" || status === "CANCELLED") return "text-red-300 bg-red-500/10 border-red-500/20";
  if (status === "NEEDS_SETUP" || status === "POSTPONED" || status === "DRAFT_RESULT") return "text-amber-300 bg-amber-500/10 border-amber-500/20";
  return "text-[var(--accent)] bg-[var(--accent-soft)] border-[var(--accent)]/20";
}

export default function AdminOperationsPanel({ leagueId }: { leagueId: string }) {
  const [data, setData] = useState<OperationsResponse | null>(null);
  const [filter, setFilter] = useState<Filter>("attention");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`/api/leagues/${leagueId}/admin/operations`, { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as OperationsResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Errore caricamento partite");
      setData(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Errore caricamento partite");
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    void load();
  }, [load]);

  const matches = useMemo(() => {
    const all = data?.matches ?? [];
    const now = Date.now();
    const filtered = all.filter((match) => {
      if (filter === "attention") return match.issues.length > 0 && match.status !== "COMPLETED";
      if (filter === "week") return match.inCurrentWeek;
      if (filter === "upcoming") return Boolean(match.date && new Date(match.date).getTime() >= now && match.status !== "COMPLETED");
      if (filter === "completed") return match.status === "COMPLETED";
      return true;
    });

    return filtered.sort((left, right) => {
      const leftPriority = left.issues.some((issue) => issue.severity === "error") ? 0 : left.issues.length ? 1 : 2;
      const rightPriority = right.issues.some((issue) => issue.severity === "error") ? 0 : right.issues.length ? 1 : 2;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      const leftDate = left.date ? new Date(left.date).getTime() : Number.MAX_SAFE_INTEGER;
      const rightDate = right.date ? new Date(right.date).getTime() : Number.MAX_SAFE_INTEGER;
      return leftDate - rightDate || left.round - right.round;
    });
  }, [data, filter]);

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)]">Centro operativo</p>
            <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-[var(--foreground)]">Partite da organizzare e controllare</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
              Un'unica vista per slot, campo, arbitro, distinte e risultati mancanti. Le criticità più urgenti vengono mostrate per prime.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={load} disabled={loading}>
            <RefreshCcw size={15} /> Aggiorna
          </Button>
        </div>

        {data && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Metric icon={AlertTriangle} label="Da sistemare" value={data.totals.attention} tone="amber" />
            <Metric icon={MapPin} label="Senza slot/campo" value={data.totals.withoutSlot} />
            <Metric icon={ShieldAlert} label="Arbitro" value={data.totals.withoutReferee + data.totals.refereeConflicts} />
            <Metric icon={Clock3} label="Risultati scaduti" value={data.totals.overdueResults} tone="red" />
            <Metric icon={ShieldCheck} label="Pronte" value={data.totals.ready} tone="green" />
          </div>
        )}
      </Card>

      <Card>
        <div className="flex flex-wrap gap-2">
          {([
            ["attention", "Da sistemare", data?.totals.attention ?? 0],
            ["week", "Questa settimana", data?.totals.currentWeek ?? 0],
            ["upcoming", "Prossime", data?.totals.upcoming ?? 0],
            ["completed", "Completate", data?.totals.completed ?? 0],
            ["all", "Tutte", data?.totals.matches ?? 0],
          ] as const).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={[
                "rounded-2xl border px-3 py-2 text-xs font-black transition",
                filter === id
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-[var(--border)] bg-[var(--card-2)] text-[var(--muted)] hover:text-[var(--foreground)]",
              ].join(" ")}
            >
              {label} · {count}
            </button>
          ))}
        </div>

        {error && <Badge variant="error" className="mt-4">{error}</Badge>}
        {loading && <p className="mt-5 text-sm text-[var(--muted)]">Analisi delle partite…</p>}
        {!loading && matches.length === 0 && (
          <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-5 text-center">
            <CheckCircle2 size={22} className="mx-auto text-emerald-400" />
            <p className="mt-2 font-black text-[var(--foreground)]">Nessuna partita in questa vista</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Non risultano criticità o gare corrispondenti al filtro selezionato.</p>
          </div>
        )}

        <div className="mt-5 space-y-3">
          {matches.map((match) => (
            <Link
              key={match.id}
              href={`/leagues/${leagueId}/matches/${match.id}`}
              className="block rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-4 transition hover:border-[var(--accent)]"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--accent)]">
                      {match.phase === "playoff" ? `Playoff${match.leg ? ` · gara ${match.leg}` : ""}` : `Giornata ${match.round}`}
                    </span>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${statusTone(match.status)}`}>
                      {STATUS_LABELS[match.status]}
                    </span>
                  </div>
                  <p className="mt-2 truncate text-base font-black text-[var(--foreground)]">
                    {match.homeTeam.name} <span className="text-[var(--muted)]">vs</span> {match.awayTeam.name}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                    <span className="inline-flex items-center gap-1.5"><CalendarClock size={13} className="text-[var(--accent)]" />{formatDate(match.date)}</span>
                    <span className="inline-flex items-center gap-1.5"><MapPin size={13} className="text-[var(--accent)]" />{match.venueName ?? "Campo da assegnare"}</span>
                    <span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} className="text-[var(--accent)]" />{match.referee?.name ?? "Arbitro da assegnare"}</span>
                  </div>
                </div>

                <div className="shrink-0 text-left lg:text-right">
                  {match.status === "COMPLETED" ? (
                    <p className="text-2xl font-black tracking-[-0.05em] text-[var(--foreground)]">{match.homeGoals} – {match.awayGoals}</p>
                  ) : (
                    <p className="text-xs font-bold text-[var(--muted)]">Distinte {match.homeSheetCount}/8 · {match.awaySheetCount}/8</p>
                  )}
                </div>
              </div>

              {match.issues.length > 0 && match.status !== "COMPLETED" && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
                  {match.issues.map((issue) => (
                    <span
                      key={issue.code}
                      className={[
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black",
                        issue.severity === "error" ? "bg-red-500/10 text-red-300" : "bg-amber-500/10 text-amber-300",
                      ].join(" ")}
                    >
                      <CircleDot size={11} /> {issue.label}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = "accent",
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone?: "accent" | "amber" | "red" | "green";
}) {
  const toneClass = {
    accent: "bg-[var(--accent-soft)] text-[var(--accent)]",
    amber: "bg-amber-500/10 text-amber-300",
    red: "bg-red-500/10 text-red-300",
    green: "bg-emerald-500/10 text-emerald-400",
  }[tone];

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-3">
      <div className={`grid h-8 w-8 place-items-center rounded-xl ${toneClass}`}><Icon size={15} /></div>
      <p className="mt-3 text-2xl font-black tracking-[-0.05em] text-[var(--foreground)]">{value}</p>
      <p className="mt-0.5 text-[11px] font-bold text-[var(--muted)]">{label}</p>
    </div>
  );
}
