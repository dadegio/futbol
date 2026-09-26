"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellRing, CheckCheck, Smartphone, X } from "lucide-react";
import { authFetch, useAuth } from "@/lib/client-auth";
import { readApiError } from "@/modules/core/client-error";

type NotificationItem = {
  id: string;
  leagueId: string | null;
  matchId: string | null;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

type CenterData = {
  notifications: NotificationItem[];
  unreadCount: number;
  preferences: {
    matchReminders: boolean;
    pushEnabled: boolean;
  };
  vapidPublicKey: string | null;
};

type PushState = "checking" | "unsupported" | "unconfigured" | "denied" | "off" | "on";

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes;
}

function formatCreatedAt(value: string) {
  return new Date(value).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationCenter({ leagueId }: { leagueId?: string }) {
  const { user } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<CenterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushState, setPushState] = useState<PushState>("checking");
  const [pushBusy, setPushBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const query = leagueId ? `?leagueId=${encodeURIComponent(leagueId)}` : "";
      const response = await authFetch(`/api/notifications${query}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readApiError(payload, "Errore caricamento notifiche"));
      setData(payload as CenterData);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Errore caricamento notifiche");
    } finally {
      setLoading(false);
    }
  }, [leagueId, user]);

  const detectPushState = useCallback(async () => {
    if (!data?.vapidPublicKey) {
      setPushState("unconfigured");
      return;
    }
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setPushState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setPushState("denied");
      return;
    }
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      setPushState(subscription ? "on" : "off");
    } catch {
      setPushState("off");
    }
  }, [data?.vapidPublicKey]);

  useEffect(() => {
    if (!user) return;
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(interval);
  }, [load, user]);

  useEffect(() => {
    void detectPushState();
  }, [detectPushState]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  if (!user) return null;

  async function markRead(id: string) {
    await authFetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read", id }),
    }).catch(() => null);
    setData((current) =>
      current
        ? {
            ...current,
            unreadCount: Math.max(
              0,
              current.unreadCount -
                (current.notifications.find((item) => item.id === id)?.readAt ? 0 : 1)
            ),
            notifications: current.notifications.map((item) =>
              item.id === id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item
            ),
          }
        : current
    );
  }

  async function markAllRead() {
    await authFetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read-all", leagueId: leagueId ?? null }),
    });
    setData((current) =>
      current
        ? {
            ...current,
            unreadCount: 0,
            notifications: current.notifications.map((item) => ({
              ...item,
              readAt: item.readAt ?? new Date().toISOString(),
            })),
          }
        : current
    );
  }

  async function setMatchReminders(enabled: boolean) {
    const response = await authFetch("/api/notifications/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchReminders: enabled }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(readApiError(payload, "Errore salvataggio preferenze"));
    setData((current) =>
      current
        ? { ...current, preferences: { ...current.preferences, matchReminders: enabled } }
        : current
    );
  }

  async function enablePush() {
    if (!data?.vapidPublicKey) return;
    setPushBusy(true);
    setError(null);
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("Le notifiche push non sono supportate su questo dispositivo.");
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState(permission === "denied" ? "denied" : "off");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(data.vapidPublicKey),
        }));
      const json = subscription.toJSON();
      const response = await authFetch("/api/notifications/push-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: json.keys?.p256dh,
            auth: json.keys?.auth,
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readApiError(payload, "Errore attivazione push"));
      setPushState("on");
      setData((current) =>
        current
          ? { ...current, preferences: { ...current.preferences, pushEnabled: true } }
          : current
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Errore attivazione push");
      await detectPushState();
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    setPushBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await authFetch("/api/notifications/push-subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      } else {
        await authFetch("/api/notifications/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pushEnabled: false }),
        });
      }
      setPushState("off");
      setData((current) =>
        current
          ? { ...current, preferences: { ...current.preferences, pushEnabled: false } }
          : current
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Errore disattivazione push");
    } finally {
      setPushBusy(false);
    }
  }

  const unread = data?.unreadCount ?? 0;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void load();
        }}
        aria-label={unread ? `Notifiche, ${unread} non lette` : "Notifiche"}
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] transition hover:border-[var(--accent)]/60"
      >
        {unread ? <BellRing size={18} /> : <Bell size={18} />}
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-black text-black">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-[95] w-[min(92vw,390px)] overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--background)] shadow-[0_24px_80px_rgba(0,0,0,.45)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div>
              <p className="text-sm font-black text-[var(--foreground)]">Notifiche</p>
              <p className="text-[10px] text-[var(--muted)]">{unread} non lette</p>
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button type="button" onClick={() => void markAllRead()} className="grid h-9 w-9 place-items-center text-[var(--muted)]" title="Segna tutte come lette">
                  <CheckCheck size={17} />
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center text-[var(--muted)]" aria-label="Chiudi notifiche">
                <X size={17} />
              </button>
            </div>
          </div>

          <div className="max-h-[48vh] overflow-y-auto">
            {loading && !data ? (
              <p className="px-4 py-6 text-center text-xs text-[var(--muted)]">Caricamento…</p>
            ) : data?.notifications.length ? (
              data.notifications.map((item) => (
                <Link
                  key={item.id}
                  href={item.href ?? "#"}
                  onClick={() => {
                    void markRead(item.id);
                    if (item.href) setOpen(false);
                  }}
                  className={[
                    "block border-b border-[var(--border)] px-4 py-3 transition hover:bg-[var(--card-2)]",
                    item.readAt ? "" : "bg-[var(--accent-soft)]",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-3">
                    <span className={["mt-1 h-2 w-2 shrink-0 rounded-full", item.readAt ? "bg-[var(--border-strong)]" : "bg-[var(--accent)]"].join(" ")} />
                    <div className="min-w-0">
                      <p className="text-xs font-black text-[var(--foreground)]">{item.title}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">{item.body}</p>
                      <p className="mt-1.5 text-[9px] font-bold uppercase tracking-wide text-[var(--muted)]">{formatCreatedAt(item.createdAt)}</p>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <p className="px-4 py-8 text-center text-xs text-[var(--muted)]">Nessuna notifica.</p>
            )}
          </div>

          <div className="space-y-3 border-t border-[var(--border)] bg-[var(--card)] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black text-[var(--foreground)]">Promemoria domenicale</p>
                <p className="mt-0.5 text-[10px] text-[var(--muted)]">Per le partite della settimana successiva.</p>
              </div>
              <button
                type="button"
                onClick={() => void setMatchReminders(!(data?.preferences.matchReminders ?? true))}
                className={["h-7 w-12 rounded-full p-1 transition", data?.preferences.matchReminders ?? true ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]"].join(" ")}
                aria-label="Attiva o disattiva promemoria partita"
              >
                <span className={["block h-5 w-5 rounded-full bg-black transition", data?.preferences.matchReminders ?? true ? "translate-x-5" : "translate-x-0"].join(" ")} />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Smartphone size={16} className="shrink-0 text-[var(--accent)]" />
                <div className="min-w-0">
                  <p className="text-xs font-black text-[var(--foreground)]">Push sul dispositivo</p>
                  <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                    {pushState === "on"
                      ? "Attive su questo dispositivo."
                      : pushState === "denied"
                        ? "Bloccate dal browser."
                        : pushState === "unsupported"
                          ? "Non supportate su questo dispositivo."
                          : pushState === "unconfigured"
                            ? "Da configurare sul server."
                            : "Ricevi avvisi anche a sito chiuso."}
                  </p>
                </div>
              </div>
              {pushState === "on" ? (
                <button type="button" disabled={pushBusy} onClick={() => void disablePush()} className="shrink-0 rounded-xl border border-[var(--border)] px-3 py-2 text-[10px] font-black text-[var(--muted)]">
                  Disattiva
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pushBusy || pushState === "unsupported" || pushState === "denied" || pushState === "unconfigured"}
                  onClick={() => void enablePush()}
                  className="shrink-0 rounded-xl bg-[var(--accent)] px-3 py-2 text-[10px] font-black text-black disabled:opacity-40"
                >
                  Attiva
                </button>
              )}
            </div>

            {error && <p className="text-[10px] font-bold text-red-300">{error}</p>}
            <p className="text-[9px] leading-relaxed text-[var(--muted)]">
              Su iPhone le push web richiedono che il sito sia aggiunto alla schermata Home.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
