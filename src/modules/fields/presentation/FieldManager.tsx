"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "src/app/_components/ui/card";
import Badge from "src/app/_components/ui/badge";
import Button from "src/app/_components/ui/button";
import Input from "src/app/_components/ui/input";
import Select from "src/app/_components/ui/select";
import { authFetch } from "@/lib/client-auth";

type FieldSlotRow = {
  id: string;
  weekday: number;
  hour: number;
  minute: number;
  durationMinutes: number;
};

type FieldRow = {
  id: string;
  name: string;
  address: string;
  active: boolean;
  slots: FieldSlotRow[];
};

type DraftSlot = {
  weekday: string;
  time: string;
};

const WEEKDAYS = [
  { value: 1, label: "Lunedì" },
  { value: 2, label: "Martedì" },
  { value: 3, label: "Mercoledì" },
  { value: 4, label: "Giovedì" },
  { value: 5, label: "Venerdì" },
  { value: 6, label: "Sabato" },
  { value: 0, label: "Domenica" },
];

function weekdayLabel(weekday: number) {
  return WEEKDAYS.find((day) => day.value === weekday)?.label ?? "Giorno";
}

function formatTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function slotOrder(slot: Pick<FieldSlotRow, "weekday" | "hour" | "minute">) {
  const orderedWeekday = slot.weekday === 0 ? 7 : slot.weekday;
  return orderedWeekday * 24 * 60 + slot.hour * 60 + slot.minute;
}

export default function FieldManager({ leagueId }: { leagueId: string }) {
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [draftSlots, setDraftSlots] = useState<Record<string, DraftSlot>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);

    try {
      const response = await authFetch(`/api/leagues/${leagueId}/fields`, {
        cache: "no-store",
      });
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        throw new Error(data?.error ?? "Errore caricamento campi");
      }
      setFields(Array.isArray(data) ? data : []);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Errore caricamento campi");
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    load();
  }, [load]);

  const totalSlots = useMemo(
    () => fields.filter((field) => field.active).reduce((sum, field) => sum + field.slots.length, 0),
    [fields]
  );

  const weeklyCoverage = useMemo(() =>
    WEEKDAYS.map((day) => {
      const activeFields = fields
        .filter((field) => field.active && field.slots.some((slot) => slot.weekday === day.value))
        .map((field) => ({
          id: field.id,
          name: field.name,
          slots: field.slots.filter((slot) => slot.weekday === day.value).length,
        }));
      return { ...day, fields: activeFields, slots: activeFields.reduce((sum, field) => sum + field.slots, 0) };
    }).filter((day) => day.slots > 0),
  [fields]);

  async function addField() {
    if (!newName.trim() || !newAddress.trim()) return;
    setSaving(true);
    setErr(null);
    setMsg(null);

    try {
      const response = await authFetch(`/api/leagues/${leagueId}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, address: newAddress }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error ?? "Errore aggiunta campo");
      }
      setNewName("");
      setNewAddress("");
      setMsg("Campo aggiunto. Ora puoi configurare i suoi slot.");
      await load();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Errore aggiunta campo");
    } finally {
      setSaving(false);
    }
  }

  async function patchField(payload: Record<string, unknown>) {
    const response = await authFetch(`/api/leagues/${leagueId}/fields`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error ?? "Errore aggiornamento campo");
    }
    return data;
  }

  async function toggleActive(field: FieldRow) {
    setSaving(true);
    setErr(null);
    setMsg(null);

    try {
      await patchField({ id: field.id, active: !field.active });
      await load();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Errore aggiornamento campo");
    } finally {
      setSaving(false);
    }
  }

  async function saveSlots(field: FieldRow, nextSlots: FieldSlotRow[]) {
    setSaving(true);
    setErr(null);
    setMsg(null);

    try {
      await patchField({
        id: field.id,
        slots: nextSlots.map((slot) => ({
          weekday: slot.weekday,
          hour: slot.hour,
          minute: slot.minute,
          durationMinutes: 60,
        })),
      });
      await load();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Errore aggiornamento slot");
    } finally {
      setSaving(false);
    }
  }

  async function addSlot(field: FieldRow) {
    const draft = draftSlots[field.id] ?? { weekday: "2", time: "21:00" };
    const weekday = Number(draft.weekday);
    const [hourRaw, minuteRaw] = draft.time.split(":");
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);

    if (
      !Number.isInteger(weekday) ||
      weekday < 0 ||
      weekday > 6 ||
      !Number.isInteger(hour) ||
      hour < 0 ||
      hour > 23 ||
      !Number.isInteger(minute) ||
      minute < 0 ||
      minute > 59
    ) {
      setErr("Seleziona un giorno e un orario validi");
      return;
    }

    if (
      field.slots.some(
        (slot) => slot.weekday === weekday && slot.hour === hour && slot.minute === minute
      )
    ) {
      setErr("Questo slot è già presente per il campo");
      return;
    }

    const nextSlots = [
      ...field.slots,
      {
        id: `new-${weekday}-${hour}-${minute}`,
        weekday,
        hour,
        minute,
        durationMinutes: 60,
      },
    ].sort((a, b) => slotOrder(a) - slotOrder(b));

    await saveSlots(field, nextSlots);
  }

  async function removeSlot(field: FieldRow, slotId: string) {
    const nextSlots = field.slots.filter((slot) => slot.id !== slotId);
    await saveSlots(field, nextSlots);
  }

  async function deleteField(field: FieldRow) {
    const confirmed = window.confirm(
      `Eliminare definitivamente “${field.name}”? Le prenotazioni non ancora giocate su questo campo verranno liberate.`
    );
    if (!confirmed) return;

    setSaving(true);
    setErr(null);
    setMsg(null);

    try {
      const response = await authFetch(`/api/leagues/${leagueId}/fields`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: field.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error ?? "Errore eliminazione campo");
      }

      const released = Number(data?.releasedBookings ?? 0);
      setMsg(
        released > 0
          ? `Campo eliminato. ${released} prenotazion${released === 1 ? "e è stata liberata" : "i sono state liberate"}.`
          : "Campo eliminato."
      );
      await load();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Errore eliminazione campo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">
          Impianti
        </p>
        <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-[var(--foreground)]">
          Campi e disponibilità
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Inserisci nome e via del campo, poi decidi tu i giorni e gli orari disponibili. Un campo può essere creato anche senza slot e configurato in seguito.
        </p>
        <p className="mt-2 text-xs font-bold text-[var(--muted)]">
          Slot attivi complessivi: {totalSlots}
        </p>
      </div>

      {weeklyCoverage.length > 0 && (
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--muted)]">Copertura settimanale</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {weeklyCoverage.map((day) => (
              <div key={day.value} className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-[var(--foreground)]">{day.label}</span>
                  <span className="text-[10px] font-black text-[var(--accent)]">{day.slots} slot</span>
                </div>
                <p className="mt-1 truncate text-[10px] text-[var(--muted)]">{day.fields.map((field) => field.name).join(" · ")}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
        <Input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="Nome campo"
        />
        <Input
          value={newAddress}
          onChange={(event) => setNewAddress(event.target.value)}
          placeholder="Via / indirizzo"
        />
        <Button
          onClick={addField}
          disabled={saving || !newName.trim() || !newAddress.trim()}
        >
          Aggiungi campo
        </Button>
      </div>

      {err && <Badge variant="error" className="mt-3">{err}</Badge>}
      {msg && <Badge variant="success" className="mt-3">{msg}</Badge>}

      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="text-sm text-[var(--muted)]">Caricamento campi…</p>
        ) : fields.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nessun campo inserito.</p>
        ) : (
          fields.map((field) => {
            const draft = draftSlots[field.id] ?? { weekday: "2", time: "21:00" };
            const sortedSlots = [...field.slots].sort((a, b) => slotOrder(a) - slotOrder(b));

            return (
              <div
                key={field.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-black text-[var(--foreground)]">{field.name}</p>
                    <p className="mt-0.5 break-words text-xs text-[var(--muted)]">
                      {field.address}{!field.active ? " · non selezionabile" : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => toggleActive(field)}
                      disabled={saving}
                    >
                      {field.active ? "Disattiva" : "Riattiva"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteField(field)}
                      disabled={saving}
                    >
                      Elimina campo
                    </Button>
                  </div>
                </div>

                <div className="mt-4 border-t border-[var(--border)] pt-4">
                  <p className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                    Slot del campo
                  </p>

                  {sortedSlots.length === 0 ? (
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      Nessuno slot configurato: il campo non comparirà tra le disponibilità finché non ne aggiungi almeno uno.
                    </p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {sortedSlots.map((slot) => (
                        <div
                          key={slot.id}
                          className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
                        >
                          <span className="font-bold text-[var(--foreground)]">
                            {weekdayLabel(slot.weekday)} · {formatTime(slot.hour, slot.minute)}
                          </span>
                          <button
                            type="button"
                            className="rounded-lg px-2 py-1 text-xs font-black text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                            onClick={() => removeSlot(field, slot.id)}
                            disabled={saving}
                            aria-label={`Elimina slot ${weekdayLabel(slot.weekday)} ${formatTime(slot.hour, slot.minute)}`}
                          >
                            Elimina
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,160px)_auto]">
                    <Select
                      value={draft.weekday}
                      onChange={(event) =>
                        setDraftSlots((current) => ({
                          ...current,
                          [field.id]: { ...draft, weekday: event.target.value },
                        }))
                      }
                      aria-label={`Giorno nuovo slot per ${field.name}`}
                    >
                      {WEEKDAYS.map((day) => (
                        <option key={day.value} value={day.value}>
                          {day.label}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="time"
                      step={300}
                      value={draft.time}
                      onChange={(event) =>
                        setDraftSlots((current) => ({
                          ...current,
                          [field.id]: { ...draft, time: event.target.value },
                        }))
                      }
                      aria-label={`Orario nuovo slot per ${field.name}`}
                    />
                    <Button size="sm" onClick={() => addSlot(field)} disabled={saving || !draft.time}>
                      Aggiungi slot
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
