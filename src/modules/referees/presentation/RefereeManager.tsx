"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "src/app/_components/ui/card";
import Badge from "src/app/_components/ui/badge";
import Button from "src/app/_components/ui/button";
import Input from "src/app/_components/ui/input";
import Select from "src/app/_components/ui/select";
import { authFetch } from "@/lib/client-auth";

type TeamRow = { id: string; name: string };
type RefereeAvailabilityRow = { id: string; weekday: number; hour: number; minute: number };
type RefereeRow = {
  id: string;
  name: string;
  active: boolean;
  teamId?: string | null;
  team?: TeamRow | null;
  availabilities: RefereeAvailabilityRow[];
  account?: { id: string; username: string } | null;
};
type GeneratedCredentials = { refereeId: string; username: string; password: string };
type DraftAvailability = { weekday: string; time: string };

const WEEKDAYS = [
  { value: 1, label: "Lunedì" }, { value: 2, label: "Martedì" },
  { value: 3, label: "Mercoledì" }, { value: 4, label: "Giovedì" },
  { value: 5, label: "Venerdì" }, { value: 6, label: "Sabato" },
  { value: 0, label: "Domenica" },
];
const weekdayLabel = (weekday: number) => WEEKDAYS.find((d) => d.value === weekday)?.label ?? "Giorno";
const formatTime = (hour: number, minute: number) => `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
const availabilityOrder = (slot: Pick<RefereeAvailabilityRow, "weekday" | "hour" | "minute">) =>
  (slot.weekday === 0 ? 7 : slot.weekday) * 24 * 60 + slot.hour * 60 + slot.minute;

export default function RefereeManager({ leagueId }: { leagueId: string }) {
  const [referees, setReferees] = useState<RefereeRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newTeamId, setNewTeamId] = useState("");
  const [draftAvailability, setDraftAvailability] = useState<Record<string, DraftAvailability>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<GeneratedCredentials | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const [r, t] = await Promise.all([
        authFetch(`/api/leagues/${leagueId}/referees`, { cache: "no-store" }),
        authFetch(`/api/leagues/${leagueId}/teams`, { cache: "no-store" }),
      ]);
      const rd = await r.json().catch(() => []); const td = await t.json().catch(() => []);
      if (!r.ok) throw new Error(rd?.error ?? "Errore caricamento arbitri");
      if (!t.ok) throw new Error(td?.error ?? "Errore caricamento squadre");
      setReferees(Array.isArray(rd) ? rd : []);
      setTeams(Array.isArray(td) ? td.map((x: TeamRow) => ({ id: x.id, name: x.name })) : []);
    } catch (e) { setErr(e instanceof Error ? e.message : "Errore caricamento arbitri"); }
    finally { setLoading(false); }
  }, [leagueId]);
  useEffect(() => { load(); }, [load]);

  const refereeSummary = useMemo(() => ({
    total: referees.length,
    active: referees.filter((referee) => referee.active).length,
    withAccount: referees.filter((referee) => Boolean(referee.account)).length,
    constrained: referees.filter((referee) => referee.availabilities.length > 0).length,
  }), [referees]);

  async function patchReferee(payload: Record<string, unknown>) {
    const r = await authFetch(`/api/leagues/${leagueId}/referees`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error ?? "Errore aggiornamento arbitro");
    return d;
  }

  async function addReferee() {
    if (!newFirstName.trim() || !newLastName.trim()) return;
    setSaving(true); setErr(null); setMsg(null);
    try {
      const r = await authFetch(`/api/leagues/${leagueId}/referees`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: newFirstName, lastName: newLastName, teamId: newTeamId || null }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error ?? "Errore aggiunta arbitro");
      setNewFirstName(""); setNewLastName(""); setNewTeamId("");
      setMsg("Arbitro aggiunto. Senza orari configurati non avrà vincoli di disponibilità.");
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Errore aggiunta arbitro"); }
    finally { setSaving(false); }
  }

  async function updateTeam(referee: RefereeRow, teamId: string) {
    setSaving(true); setErr(null); setMsg(null);
    try {
      const d = await patchReferee({ id: referee.id, teamId: teamId || null });
      const n = Number(d?.releasedAssignments ?? 0);
      setMsg(n ? `Squadra aggiornata. Rimosse ${n} assegnazioni incompatibili.` : "Squadra di appartenenza aggiornata.");
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Errore aggiornamento squadra arbitro"); }
    finally { setSaving(false); }
  }

  async function toggleActive(referee: RefereeRow) {
    setSaving(true); setErr(null); setMsg(null);
    try {
      const d = await patchReferee({ id: referee.id, active: !referee.active });
      const n = Number(d?.releasedAssignments ?? 0);
      if (n) setMsg(`Arbitro disattivato. Rimosse ${n} assegnazioni future.`);
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Errore aggiornamento arbitro"); }
    finally { setSaving(false); }
  }

  async function saveAvailability(referee: RefereeRow, next: RefereeAvailabilityRow[]) {
    setSaving(true); setErr(null); setMsg(null);
    try {
      const d = await patchReferee({
        id: referee.id,
        availability: next.map((s) => ({ weekday: s.weekday, hour: s.hour, minute: s.minute })),
      });
      const n = Number(d?.releasedAssignments ?? 0);
      setMsg(n ? `Disponibilità aggiornate. Rimosse ${n} assegnazioni non più compatibili.` :
        next.length ? "Disponibilità arbitro aggiornate." : "Vincoli orari rimossi: resta valido solo il controllo dei conflitti.");
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Errore aggiornamento disponibilità"); }
    finally { setSaving(false); }
  }

  async function addAvailability(referee: RefereeRow) {
    const draft = draftAvailability[referee.id] ?? { weekday: "2", time: "21:00" };
    const weekday = Number(draft.weekday); const [h, m] = draft.time.split(":").map(Number);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !Number.isInteger(h) || h < 0 || h > 23 || !Number.isInteger(m) || m < 0 || m > 59) {
      setErr("Seleziona un giorno e un orario validi"); return;
    }
    if (referee.availabilities.some((s) => s.weekday === weekday && s.hour === h && s.minute === m)) {
      setErr("Questa disponibilità è già presente per l'arbitro"); return;
    }
    await saveAvailability(referee, [...referee.availabilities, { id: `new-${weekday}-${h}-${m}`, weekday, hour: h, minute: m }]
      .sort((a, b) => availabilityOrder(a) - availabilityOrder(b)));
  }

  async function deleteReferee(referee: RefereeRow) {
    if (!window.confirm(`Eliminare definitivamente “${referee.name}”?`)) return;
    setSaving(true); setErr(null); setMsg(null); setCredentials(null);
    try {
      const r = await authFetch(`/api/leagues/${leagueId}/referees`, {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: referee.id }),
      });
      const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d?.error ?? "Errore eliminazione arbitro");
      setMsg("Arbitro eliminato."); await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Errore eliminazione arbitro"); }
    finally { setSaving(false); }
  }

  async function createCredentials(referee: RefereeRow) {
    setSaving(true); setErr(null); setCredentials(null);
    try {
      const r = await authFetch(`/api/leagues/${leagueId}/referees/${referee.id}/credentials`, { method: "POST" });
      const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d?.error ?? "Errore creazione credenziali");
      setCredentials({ refereeId: referee.id, username: d.account.username, password: d.password }); await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Errore creazione credenziali"); }
    finally { setSaving(false); }
  }

  return <Card>
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">Direzione di gara</p>
      <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-[var(--foreground)]">Arbitri e disponibilità</h2>
      <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">Associa l&apos;eventuale squadra in cui gioca l&apos;arbitro e, se vuoi, limita i suoi giorni/orari. Il sistema evita la sua squadra, le doppie assegnazioni e le gare contemporanee a quelle in cui deve giocare.</p>
      <p className="mt-2 text-xs font-bold text-[var(--muted)]">Nessun orario configurato = nessun vincolo orario.</p>
    </div>

    {!loading && referees.length > 0 && (
      <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
        {[
          ["Totali", refereeSummary.total],
          ["Attivi", refereeSummary.active],
          ["Con account", refereeSummary.withAccount],
          ["Con vincoli orari", refereeSummary.constrained],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-3 py-3">
            <p className="text-xl font-black text-[var(--foreground)]">{value}</p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">{label}</p>
          </div>
        ))}
      </div>
    )}

    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]">
      <Input value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} placeholder="Nome" />
      <Input value={newLastName} onChange={(e) => setNewLastName(e.target.value)} placeholder="Cognome" />
      <Select value={newTeamId} onChange={(e) => setNewTeamId(e.target.value)}><option value="">Nessuna squadra</option>{teams.map((t) => <option key={t.id} value={t.id}>Gioca in {t.name}</option>)}</Select>
      <Button onClick={addReferee} disabled={saving || !newFirstName.trim() || !newLastName.trim()}>Aggiungi arbitro</Button>
    </div>
    {err && <Badge variant="error" className="mt-3">{err}</Badge>}
    {msg && <Badge variant="success" className="mt-3">{msg}</Badge>}
    {credentials && <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm"><b>Credenziali:</b> {credentials.username} / {credentials.password}</div>}

    <div className="mt-4 space-y-3">
      {loading ? <p className="text-sm text-[var(--muted)]">Caricamento arbitri…</p> : referees.map((referee) => {
        const draft = draftAvailability[referee.id] ?? { weekday: "2", time: "21:00" };
        const slots = [...referee.availabilities].sort((a,b) => availabilityOrder(a)-availabilityOrder(b));
        return <div key={referee.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="font-black text-[var(--foreground)]">{referee.name}</p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">{referee.account ? `Account: ${referee.account.username}` : "Nessun account collegato"}{!referee.active ? " · non selezionabile" : ""}</p>
              <div className="mt-2 max-w-sm"><Select value={referee.teamId ?? ""} onChange={(e) => updateTeam(referee, e.target.value)} disabled={saving}>
                <option value="">Nessuna squadra di appartenenza</option>{teams.map((t) => <option key={t.id} value={t.id}>Gioca in {t.name}</option>)}
              </Select></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {!referee.account && <Button size="sm" onClick={() => createCredentials(referee)} disabled={saving}>Genera credenziali</Button>}
              <Button size="sm" variant="secondary" onClick={() => toggleActive(referee)} disabled={saving}>{referee.active ? "Disattiva" : "Riattiva"}</Button>
              <Button size="sm" variant="destructive" onClick={() => deleteReferee(referee)} disabled={saving}>Elimina</Button>
            </div>
          </div>
          <div className="mt-4 border-t border-[var(--border)] pt-4">
            <p className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">Disponibilità settimanali</p>
            {slots.length === 0 ? <p className="mt-2 text-sm text-[var(--muted)]">Nessun vincolo: può essere assegnato a qualsiasi orario se non ha altri conflitti.</p> :
              <div className="mt-2 flex flex-wrap gap-2">{slots.map((s) => <div key={s.id} className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm">
                <span className="font-bold text-[var(--foreground)]">{weekdayLabel(s.weekday)} · {formatTime(s.hour, s.minute)}</span>
                <button type="button" className="rounded-lg px-2 py-1 text-xs font-black text-red-400" disabled={saving} onClick={() => saveAvailability(referee, referee.availabilities.filter((x) => x.id !== s.id))}>Elimina</button>
              </div>)}</div>}
            <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,160px)_auto]">
              <Select value={draft.weekday} onChange={(e) => setDraftAvailability((c) => ({ ...c, [referee.id]: { ...draft, weekday: e.target.value } }))}>{WEEKDAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</Select>
              <Input type="time" step={300} value={draft.time} onChange={(e) => setDraftAvailability((c) => ({ ...c, [referee.id]: { ...draft, time: e.target.value } }))} />
              <Button size="sm" onClick={() => addAvailability(referee)} disabled={saving || !draft.time}>Aggiungi orario</Button>
            </div>
          </div>
        </div>;
      })}
    </div>
  </Card>;
}
