"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, RefreshCcw, Search, ShieldCheck } from "lucide-react";
import { authFetch } from "@/lib/client-auth";
import Card from "src/app/_components/ui/card";
import Badge from "src/app/_components/ui/badge";
import Button from "src/app/_components/ui/button";

type AuditLog = {
  id: string;
  actorUsername: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type AuditLogResponse = {
  logs?: AuditLog[];
  nextCursor?: string | null;
  error?: string;
};

const ACTION_LABELS: Record<string, string> = {
  "league.created": "Torneo creato",
  "league.updated": "Torneo aggiornato",
  "league.deleted": "Torneo eliminato",
  "match.booked": "Slot prenotato",
  "match.booking_cleared": "Slot liberato",
  "match.date_updated": "Data aggiornata",
  "match.officials_updated": "Arbitro aggiornato",
  "match.result_saved": "Risultato salvato",
  "sponsor.created": "Sponsor creato",
  "sponsor.updated": "Sponsor aggiornato",
  "sponsor.deleted": "Sponsor eliminato",
  "media.created": "Media caricato",
  "media.updated": "Media aggiornato",
  "media.deleted": "Media eliminato",
  "playoffs.created": "Playoff creati",
  "playoffs.deleted": "Playoff eliminati",
  "playoffs.advanced": "Playoff avanzati",
  "user.created": "Utente creato",
  "user.password_updated": "Password aggiornata",
  "user.deleted": "Utente eliminato",
  "field.created": "Campo creato",
  "field.updated": "Campo aggiornato",
  "field.deleted": "Campo eliminato",
  "referee.created": "Arbitro creato",
  "referee.updated": "Arbitro aggiornato",
  "referee.deleted": "Arbitro eliminato",
  "team.updated": "Squadra aggiornata",
  "team.removed": "Squadra rimossa",
  "player.updated": "Giocatore aggiornato",
  "player.deleted": "Giocatore eliminato",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data non valida";
  return date.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAction(action: string) {
  return ACTION_LABELS[action] ?? action.replaceAll("_", " ").replaceAll(".", " · ");
}

function formatMetadata(metadata: Record<string, unknown> | null) {
  if (!metadata || Object.keys(metadata).length === 0) return null;
  return JSON.stringify(metadata, null, 2);
}

export default function AuditLogPanel({ leagueId }: { leagueId: string }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [openDetails, setOpenDetails] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await authFetch(`/api/leagues/${leagueId}/audit?limit=60`, { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as AuditLogResponse;
      if (!res.ok) throw new Error(data.error ?? "Errore caricamento storico");
      setLogs(data.logs ?? []);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Errore caricamento storico");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!leagueId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((log) => {
      if (filter !== "all" && log.entityType !== filter && !log.action.startsWith(`${filter}.`)) return false;
      if (!q) return true;
      return [log.summary, log.actorUsername, log.action, log.entityType, log.entityId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [logs, filter, query]);

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card-2)] px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--accent)]">
            <ShieldCheck size={14} /> Audit log
          </div>
          <h2 className="mt-3 text-xl font-black tracking-[-0.04em] text-[var(--foreground)]">Storico modifiche</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Ultime modifiche su risultati, prenotazioni, sponsor, media, playoff, utenti e impostazioni torneo.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={load} disabled={loading}>
          <RefreshCcw size={15} /> Aggiorna
        </Button>
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3">
          <Search size={14} className="text-[var(--accent)]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca azione, utente o oggetto…" className="h-10 min-w-0 flex-1 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]" />
        </div>
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            ["all", "Tutto"],
            ["match", "Partite"],
            ["player", "Giocatori"],
            ["team", "Squadre"],
            ["field", "Campi"],
            ["referee", "Arbitri"],
            ["sponsor", "Sponsor"],
            ["media", "Media"],
            ["playoffs", "Playoff"],
            ["user", "Utenti"],
          ].map(([value, label]) => (
            <button key={value} type="button" onClick={() => setFilter(value)} className={["shrink-0 rounded-xl border px-3 py-2 text-xs font-black transition", filter === value ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] bg-[var(--card)] text-[var(--muted)]"].join(" ")}>{label}</button>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {err && <Badge variant="error">{err}</Badge>}
        {loading && <p className="text-sm text-[var(--muted)]">Caricamento storico…</p>}
        {!loading && grouped.length === 0 && (
          <Card variant="inner">
            <p className="text-sm font-semibold text-[var(--foreground)]">Nessuna attività corrisponde ai filtri.</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Prova a cambiare categoria o ricerca.</p>
          </Card>
        )}

        {grouped.map((log) => {
          const metadata = formatMetadata(log.metadata);
          const isOpen = openDetails === log.id;
          return (
            <div key={log.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="accent">{formatAction(log.action)}</Badge>
                    <span className="rounded-full bg-black/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--muted)]">
                      {log.entityType}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-[var(--foreground)]">
                    {log.summary || "Modifica registrata"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {log.actorUsername || "Sistema"}
                    {log.actorRole ? ` · ${log.actorRole}` : ""}
                    {log.entityId ? ` · ID ${log.entityId}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-[var(--muted)]">
                  <Clock size={14} /> {formatDate(log.createdAt)}
                </div>
              </div>

              {metadata && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setOpenDetails(isOpen ? null : log.id)}
                    className="text-xs font-bold text-[var(--accent)] underline-offset-4 hover:underline"
                  >
                    {isOpen ? "Nascondi dettagli" : "Mostra dettagli"}
                  </button>
                  {isOpen && (
                    <pre className="mt-3 max-h-56 overflow-auto rounded-xl border border-[var(--border)] bg-black/25 p-3 text-[11px] leading-relaxed text-[var(--foreground)]">
                      {metadata}
                    </pre>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
