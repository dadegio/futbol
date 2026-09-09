"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import Card from "src/app/_components/ui/card";
import Button from "src/app/_components/ui/button";
import Badge from "src/app/_components/ui/badge";
import { authFetch } from "@/lib/client-auth";
import { readApiError } from "@/modules/core/client-error";

type Slot = {
  key: string;
  venueKey: string;
  venueName: string;
  address: string;
  startsAt: string;
  endsAt: string;
  available: boolean;
  isCurrentMatch: boolean;
};

type Booking = {
  startsAt: string;
  endsAt: string | null;
  venueKey: string;
  venueName: string | null;
  address: string | null;
};

type SlotsResponse = {
  currentBooking: Booking | null;
  matchWeek: {
    round: number;
    startsAt: string;
    endsAt: string;
  };
  bookingWindow: {
    opensAt: string;
    closesAt: string;
    isOpen: boolean;
    adminBypass: boolean;
  };
  slots: Slot[];
};

function formatSlotDate(date: string) {
  return new Date(date).toLocaleDateString("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function slotDayLabel(date: string) {
  return new Date(date).toLocaleDateString("it-IT", {
    weekday: "long",
    day: "2-digit",
    month: "short",
  });
}

function slotTime(date: string) {
  return new Date(date).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function slotValue(slot: Pick<Slot, "venueKey" | "startsAt">) {
  return `${slot.venueKey}|${slot.startsAt}`;
}

function formatMatchWeek(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(new Date(endsAt).getTime() - 1);

  return `${start.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
  })} – ${end.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}`;
}

export default function MatchSlotBooking({
  leagueId,
  matchId,
  canBook,
  initialBooking,
}: {
  leagueId: string;
  matchId: string;
  canBook: boolean;
  initialBooking: Booking | null;
}) {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [currentBooking, setCurrentBooking] = useState(initialBooking);
  const [selected, setSelected] = useState("");
  const [matchWeek, setMatchWeek] =
    useState<SlotsResponse["matchWeek"] | null>(null);
  const [bookingWindow, setBookingWindow] = useState<SlotsResponse["bookingWindow"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setCurrentBooking(initialBooking);
  }, [initialBooking]);

  const loadSlots = useCallback(async () => {
    if (!canBook) return;

    setLoading(true);
    setErr(null);

    try {
      const res = await authFetch(
        `/api/leagues/${leagueId}/slots?matchId=${encodeURIComponent(matchId)}`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiError(data, "Errore caricamento slot"));

      const response = data as SlotsResponse;
      setSlots(response.slots);
      setCurrentBooking(response.currentBooking);
      setMatchWeek(response.matchWeek);
      setBookingWindow(response.bookingWindow);

      const current = response.slots.find((slot) => slot.isCurrentMatch);
      if (current) setSelected(slotValue(current));
    } catch (error) {
      setErr(
        error instanceof Error ? error.message : "Errore caricamento slot"
      );
    } finally {
      setLoading(false);
    }
  }, [canBook, leagueId, matchId]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const bookingAllowed = bookingWindow?.isOpen !== false;

  const availableSlots = useMemo(
    () => slots.filter((slot) => slot.available),
    [slots]
  );

  const slotsByDay = useMemo(() => {
    const groups = new Map<string, Slot[]>();
    for (const slot of availableSlots) {
      const key = new Date(slot.startsAt).toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
      const current = groups.get(key) ?? [];
      current.push(slot);
      groups.set(key, current);
    }
    return [...groups.entries()];
  }, [availableSlots]);

  async function book() {
    const slot = availableSlots.find(
      (candidate) => slotValue(candidate) === selected
    );
    if (!slot) return;

    setSaving(true);
    setErr(null);
    setMsg(null);

    try {
      const res = await authFetch(`/api/matches/${matchId}/booking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueKey: slot.venueKey,
          startsAt: slot.startsAt,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiError(data, "Errore prenotazione"));

      setMsg("Campo prenotato");
      await loadSlots();
      router.refresh();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Errore prenotazione");
    } finally {
      setSaving(false);
    }
  }

  async function release() {
    setSaving(true);
    setErr(null);
    setMsg(null);

    try {
      const res = await authFetch(`/api/matches/${matchId}/booking`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiError(data, "Errore liberazione slot"));

      setCurrentBooking(null);
      setSelected("");
      setMsg("Slot liberato");
      await loadSlots();
      router.refresh();
    } catch (error) {
      setErr(
        error instanceof Error ? error.message : "Errore liberazione slot"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)]">
            Prenotazione campo
          </p>
          {matchWeek && (
            <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
              Giornata {matchWeek.round} · settimana{" "}
              {formatMatchWeek(matchWeek.startsAt, matchWeek.endsAt)}
            </p>
          )}

          {currentBooking ? (
            <div className="mt-2 space-y-1.5">
              <p className="flex items-center gap-2 text-sm font-black text-[var(--foreground)]">
                <CalendarDays size={15} className="text-[var(--accent)]" />
                {formatSlotDate(currentBooking.startsAt)}
              </p>
              <p className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <MapPin size={15} className="text-[var(--accent)]" />
                {currentBooking.venueName ?? "Campo"}
                {currentBooking.address
                  ? ` · ${currentBooking.address}`
                  : ""}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-[var(--muted)]">
              Nessun campo prenotato per questa partita.
            </p>
          )}
        </div>

        {canBook && (
          <div className="w-full lg:max-w-[680px]">
            <div className="flex flex-wrap justify-end gap-2">
              <Button onClick={book} disabled={!selected || loading || saving || !bookingAllowed}>
                {saving ? "…" : currentBooking ? "Conferma nuovo slot" : "Conferma slot"}
              </Button>
              {currentBooking && (
                <Button variant="secondary" onClick={release} disabled={saving || !bookingAllowed}>
                  Libera
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {canBook && bookingAllowed && (
        <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">Scegli uno slot disponibile</p>
            {selected && <button type="button" onClick={() => setSelected("")} className="text-xs font-bold text-[var(--accent)]">Azzera scelta</button>}
          </div>
          {loading ? (
            <p className="text-sm text-[var(--muted)]">Caricamento slot…</p>
          ) : slotsByDay.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Nessuno slot libero nella settimana assegnata.</p>
          ) : (
            <div className="space-y-4">
              {slotsByDay.map(([day, daySlots]) => (
                <div key={day}>
                  <p className="mb-2 text-xs font-black capitalize text-[var(--foreground)]">{slotDayLabel(daySlots[0].startsAt)}</p>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {daySlots.map((slot) => {
                      const value = slotValue(slot);
                      const active = selected === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setSelected(value)}
                          className={[
                            "rounded-2xl border p-3 text-left transition",
                            active
                              ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                              : "border-[var(--border)] bg-[var(--card-2)] hover:border-[var(--accent)]/60",
                          ].join(" ")}
                        >
                          <span className="block text-base font-black text-[var(--foreground)]">{slotTime(slot.startsAt)}</span>
                          <span className="mt-1 block truncate text-xs font-bold text-[var(--accent)]">{slot.venueName}</span>
                          {slot.address && <span className="mt-0.5 block truncate text-[10px] text-[var(--muted)]">{slot.address}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {canBook && bookingWindow && !bookingWindow.isOpen && (
        <div className="mt-3 rounded-2xl border border-amber-300/40 bg-amber-50/70 px-4 py-3 text-xs font-semibold text-amber-900">
          Prenotazioni bloccate. Per i capitani si aprono mercoledì e si chiudono sabato della settimana precedente alla partita.
          <div className="mt-1 font-normal opacity-80">
            Finestra: {new Date(bookingWindow.opensAt).toLocaleString("it-IT")} – {new Date(new Date(bookingWindow.closesAt).getTime() - 1).toLocaleString("it-IT")}
          </div>
        </div>
      )}
      {canBook && bookingWindow?.adminBypass && (
        <p className="mt-3 text-xs font-semibold text-[var(--accent)]">Override admin attivo: puoi modificare la prenotazione in qualsiasi momento.</p>
      )}

      {msg && <Badge variant="success" className="mt-3">{msg}</Badge>}
      {err && <Badge variant="error" className="mt-3">{err}</Badge>}
    </Card>
  );
}
