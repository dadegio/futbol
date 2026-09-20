"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clock3, LockKeyhole, X } from "lucide-react";
import Card from "src/app/_components/ui/card";
import Button from "src/app/_components/ui/button";
import { authFetch } from "@/lib/client-auth";

type ChangeRequest = {
  id: string;
  type: "TEAM_UPDATE" | "PLAYER_ADD" | "PLAYER_UPDATE" | "PLAYER_REMOVE" | "PLAYER_NUMBER_SWAP";
  status: "PENDING" | "APPROVED" | "REJECTED";
  payload: Record<string, unknown>;
  targetPlayerId?: string | null;
  reason?: string | null;
  reviewNote?: string | null;
  createdAt: string;
  requestedBy?: { username: string } | null;
  reviewedBy?: { username: string } | null;
};

type ResponseData = {
  lock: {
    locked: boolean;
    lockedAt: string | null;
    lockRound: number | null;
    firstUpcoming?: { round: number; date: string | null } | null;
  };
  requests: ChangeRequest[];
};

const TYPE_LABEL: Record<ChangeRequest["type"], string> = {
  TEAM_UPDATE: "Modifica squadra",
  PLAYER_ADD: "Aggiunta giocatore",
  PLAYER_UPDATE: "Modifica giocatore",
  PLAYER_REMOVE: "Rimozione giocatore",
  PLAYER_NUMBER_SWAP: "Scambio numeri",
};

function statusClass(status: ChangeRequest["status"]) {
  if (status === "APPROVED") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (status === "REJECTED") return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  return "border-amber-400/30 bg-amber-400/10 text-amber-200";
}

function statusLabel(status: ChangeRequest["status"]) {
  if (status === "APPROVED") return "Approvata";
  if (status === "REJECTED") return "Rifiutata";
  return "In attesa";
}

function describePayload(request: ChangeRequest) {
  const entries = Object.entries(request.payload ?? {}).filter(([, value]) => value !== undefined);
  if (!entries.length) return request.targetPlayerId ? `Giocatore ${request.targetPlayerId}` : "Nessun dettaglio aggiuntivo";
  return entries.map(([key, value]) => `${key}: ${value === null ? "—" : String(value)}`).join(" · ");
}

export default function TeamChangeRequestsPanel({ teamId, isAdmin }: { teamId: string; isAdmin: boolean }) {
  const [data, setData] = useState<ResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const res = await authFetch(`/api/teams/${teamId}/change-requests`, { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error ?? "Errore caricamento richieste");
    setData(body);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Errore caricamento richieste"));
  }, [teamId]);

  const pending = useMemo(() => data?.requests.filter((item) => item.status === "PENDING") ?? [], [data]);

  async function review(id: string, decision: "APPROVED" | "REJECTED") {
    setBusy(id);
    setError(null);
    try {
      const res = await authFetch(`/api/team-change-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Errore valutazione richiesta");
      await load();
      window.dispatchEvent(new CustomEvent("team-change-request-reviewed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore valutazione richiesta");
    } finally {
      setBusy(null);
    }
  }

  if (!data && !error) return null;

  return (
    <Card className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--accent)]"><LockKeyhole size={14} /> Gestione rosa</p>
          <h2 className="mt-1 text-lg font-black text-[var(--foreground)]">{data?.lock.locked ? "Rosa bloccata" : "Rosa modificabile"}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {data?.lock.locked
              ? "Dalla prima partita le modifiche del capitano diventano richieste da approvare."
              : data?.lock.firstUpcoming?.date
                ? `Il blocco scatterà alla prima partita (giornata ${data.lock.firstUpcoming.round}).`
                : "Il blocco scatterà alla prima partita della squadra."}
          </p>
        </div>
        {pending.length > 0 && <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-black text-amber-200">{pending.length} in attesa</span>}
      </div>

      {error && <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{error}</p>}

      {data?.requests.length ? (
        <div className="space-y-2">
          {data.requests.map((request) => (
            <div key={request.id} className="rounded-2xl border border-[var(--border)] bg-white/[0.03] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-[var(--foreground)]">{TYPE_LABEL[request.type]}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${statusClass(request.status)}`}>{statusLabel(request.status)}</span>
                  </div>
                  <p className="mt-2 break-words text-xs text-[var(--muted)]">{describePayload(request)}</p>
                  <p className="mt-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]"><Clock3 size={11} /> {new Date(request.createdAt).toLocaleString("it-IT")}{request.requestedBy?.username ? ` · ${request.requestedBy.username}` : ""}</p>
                </div>
                {isAdmin && request.status === "PENDING" && (
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" onClick={() => review(request.id, "APPROVED")} disabled={busy === request.id}><Check size={14} className="mr-1" /> Approva</Button>
                    <Button size="sm" variant="destructive" onClick={() => review(request.id, "REJECTED")} disabled={busy === request.id}><X size={14} className="mr-1" /> Rifiuta</Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">Nessuna richiesta di modifica.</p>
      )}
    </Card>
  );
}
