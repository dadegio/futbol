"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArchiveRestore, Ban, Clock3, ExternalLink, LockKeyhole, PauseCircle, PlayCircle, Star, Video } from "lucide-react";
import Card from "src/app/_components/ui/card";
import Button from "src/app/_components/ui/button";
import Badge from "src/app/_components/ui/badge";
import { authFetch } from "@/lib/client-auth";
import { readApiError } from "@/modules/core/client-error";
import type { Player } from "./MatchResultParts";

type LifecycleStatus = "SCHEDULED" | "POSTPONED" | "CANCELLED";
type ResultStatus = "DRAFT" | "FINAL" | null;

async function readResponse(response: Response, fallback: string) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(readApiError(payload, fallback));
  return payload;
}

export default function MatchLifecyclePanel({
  matchId,
  isAdmin,
  lifecycleStatus,
  resultStatus,
  players,
  mvpPlayerId,
  replayUrl,
  highlightsUrl,
}: {
  matchId: string;
  isAdmin: boolean;
  lifecycleStatus: LifecycleStatus;
  resultStatus: ResultStatus;
  players: Player[];
  mvpPlayerId: string | null;
  replayUrl: string | null;
  highlightsUrl: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mvp, setMvp] = useState(mvpPlayerId ?? "");
  const [replay, setReplay] = useState(replayUrl ?? "");
  const [highlights, setHighlights] = useState(highlightsUrl ?? "");
  const [timeline, setTimeline] = useState<Array<{ id: string; action: string; summary: string | null; actorUsername: string | null; createdAt: string }>>([]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    authFetch(`/api/matches/${matchId}/timeline`, { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => { if (!cancelled && payload?.logs) setTimeline(payload.logs); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [isAdmin, matchId, resultStatus, lifecycleStatus]);

  async function lifecycle(body: Record<string, unknown>, success: string) {
    setBusy(String(body.action ?? "action"));
    setError(null);
    setMessage(null);
    try {
      await readResponse(
        await authFetch(`/api/matches/${matchId}/lifecycle`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        "Operazione non riuscita"
      );
      setMessage(success);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operazione non riuscita");
    } finally {
      setBusy(null);
    }
  }

  async function saveExtras() {
    setBusy("extras");
    setError(null);
    setMessage(null);
    try {
      await readResponse(
        await authFetch(`/api/matches/${matchId}/extras`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mvpPlayerId: mvp || null, replayUrl: replay, highlightsUrl: highlights }),
        }),
        "Salvataggio contenuti non riuscito"
      );
      setMessage("MVP e contenuti aggiornati");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Salvataggio non riuscito");
    } finally {
      setBusy(null);
    }
  }

  const lifecycleLabel = lifecycleStatus === "POSTPONED" ? "Rinviata" : lifecycleStatus === "CANCELLED" ? "Annullata" : "Programmata";
  const resultLabel = resultStatus === "FINAL" ? "Risultato definitivo" : resultStatus === "DRAFT" ? "Risultato in bozza" : "Nessun risultato";

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)]">Stato gara</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant={lifecycleStatus === "CANCELLED" ? "error" : lifecycleStatus === "POSTPONED" ? "accent" : "default"}>{lifecycleLabel}</Badge>
              <Badge variant={resultStatus === "FINAL" ? "success" : resultStatus === "DRAFT" ? "accent" : "default"}>{resultLabel}</Badge>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
              Puoi salvare una bozza oppure usare “Salva e finalizza” nella gestione gara per registrare in un solo passaggio distinta, risultato, statistiche e MVP. Un risultato definitivo entra in classifica e nelle statistiche pubbliche.
            </p>
          </div>
          {resultStatus === "FINAL" && <LockKeyhole size={22} className="text-emerald-400" />}
        </div>

        {(message || error) && <div className="mt-4">{message ? <Badge variant="success">{message}</Badge> : <Badge variant="error">{error}</Badge>}</div>}

        {isAdmin && resultStatus === "FINAL" && (
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={() => lifecycle({ action: "reopen" }, "Risultato riaperto come bozza")} disabled={Boolean(busy)}>
              <ArchiveRestore size={15} /> Riapri risultato
            </Button>
          </div>
        )}
      </Card>

      {isAdmin && (
        <Card>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)]">Gestione evento</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {lifecycleStatus === "SCHEDULED" && (
              <>
                <Button variant="secondary" onClick={() => lifecycle({ action: "postpone" }, "Partita rinviata e slot liberato")} disabled={Boolean(busy) || resultStatus === "FINAL"}><PauseCircle size={15} /> Rinvia</Button>
                <Button variant="destructive" onClick={() => lifecycle({ action: "cancel" }, "Partita annullata e slot liberato")} disabled={Boolean(busy) || resultStatus === "FINAL"}><Ban size={15} /> Annulla</Button>
              </>
            )}
            {lifecycleStatus !== "SCHEDULED" && (
              <Button variant="secondary" onClick={() => lifecycle({ action: "restore" }, "Partita ripristinata")} disabled={Boolean(busy)}><PlayCircle size={15} /> Ripristina</Button>
            )}
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">Rinvio e annullamento liberano campo, slot e arbitro. La data originaria viene conservata per lo storico.</p>
        </Card>
      )}

      {isAdmin && resultStatus === "FINAL" && (
        <Card>
          <div className="flex items-start gap-3">
            <Star size={20} className="mt-1 text-amber-300" />
            <div className="min-w-0 flex-1">
              <p className="font-black text-[var(--foreground)]">MVP e contenuti partita</p>
              <p className="mt-1 text-xs text-[var(--muted)]">Collega MVP, replay completo e highlights al risultato definitivo.</p>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <label className="text-xs font-bold text-[var(--muted)]">MVP
                  <select value={mvp} onChange={(e) => setMvp(e.target.value)} className="mt-1 h-11 w-full rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-3 text-sm text-[var(--foreground)]">
                    <option value="">Seleziona MVP</option>
                    {players.map((player) => <option key={player.id} value={player.id}>#{player.number} {player.firstName} {player.lastName}</option>)}
                  </select>
                </label>
                <UrlField icon={Video} label="Replay URL" value={replay} onChange={setReplay} />
                <UrlField icon={ExternalLink} label="Highlights URL" value={highlights} onChange={setHighlights} />
              </div>
              <div className="mt-4 flex justify-end"><Button onClick={saveExtras} disabled={Boolean(busy)}>{busy === "extras" ? "Salvataggio…" : "Salva contenuti"}</Button></div>
            </div>
          </div>
        </Card>
      )}

      {isAdmin && timeline.length > 0 && (
        <Card>
          <div className="flex items-center gap-2"><Clock3 size={17} className="text-[var(--accent)]" /><p className="text-sm font-black text-[var(--foreground)]">Timeline partita</p></div>
          <div className="mt-4 space-y-3">
            {timeline.slice(0, 12).map((entry) => (
              <div key={entry.id} className="flex gap-3 border-l-2 border-[var(--border)] pl-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-[var(--foreground)]">{entry.summary ?? entry.action}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--muted)]">{new Date(entry.createdAt).toLocaleString("it-IT")} {entry.actorUsername ? `· ${entry.actorUsername}` : ""}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function UrlField({ icon: Icon, label, value, onChange }: { icon: typeof Video; label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-xs font-bold text-[var(--muted)]"><span className="inline-flex items-center gap-1"><Icon size={12} /> {label}</span><input value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://..." className="mt-1 h-11 w-full rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]" /></label>;
}
