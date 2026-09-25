"use client";

import Link from "next/link";
import {
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Lock,
  MapPin,
  Save,
  ShieldAlert,
  Shirt,
  Users,
} from "lucide-react";
import DashboardShell from "src/app/_components/dashboard-shell";
import Badge from "src/app/_components/ui/badge";
import Button from "src/app/_components/ui/button";
import Card from "src/app/_components/ui/card";
import CoachPlayerCard from "@/modules/coaches/presentation/CoachPlayerCard";
import { authFetch } from "@/lib/client-auth";
import { readApiError } from "@/modules/core/client-error";
import {
  COACH_FORMATIONS,
  COACH_FORMATION_OPTIONS,
  type CoachFormation,
} from "@/modules/coaches/domain/coach-formations";

type TeamInfo = {
  id: string;
  name: string;
  badgeUrl: string | null;
  colorHex: string | null;
  secondaryColorHex: string | null;
};

type Player = {
  id: string;
  firstName: string;
  lastName: string;
  number: number;
  position: string | null;
  photoUrl: string | null;
  photoZoom: number;
  photoPositionX: number;
  photoPositionY: number;
  eligible: boolean;
  stats: {
    appearances: number;
    goals: number;
    assists: number;
    mvp: number;
  };
};

type Entry = {
  playerId: string;
  status: "STARTER" | "BENCH";
  positionX: number | null;
  positionY: number | null;
  sortOrder: number;
};

type InitialData = {
  team: TeamInfo;
  opponent: TeamInfo;
  match: {
    id: string;
    round: number;
    date: string | null;
    venueName: string | null;
    lifecycleStatus: string;
    resultStatus: string | null;
    isHome: boolean;
  };
  editable: boolean;
  deadline: string | null;
  lockMinutes: number;
  maxStarters: number;
  maxCalled: number;
  players: Player[];
  lineup: {
    id: string | null;
    formation: string;
    updatedAt: string | null;
    players: Entry[];
  };
};

function safeColor(value: string | null | undefined, fallback = "#64748B") {
  return value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback;
}

function formatDate(value: string | null) {
  if (!value) return "Data da assegnare";
  return new Date(value).toLocaleString("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PlayerPhoto({ player }: { player: Player }) {
  if (!player.photoUrl) {
    return (
      <div className="grid h-14 w-11 shrink-0 place-items-center rounded-xl bg-black/20 text-[10px] font-black text-[var(--muted)]">
        {player.firstName[0]}{player.lastName[0]}
      </div>
    );
  }
  return (
    <div className="h-14 w-11 shrink-0 overflow-hidden rounded-xl bg-black/20">
      <img
        src={player.photoUrl}
        alt={`${player.firstName} ${player.lastName}`}
        className="h-full w-full object-contain"
        style={{
          objectPosition: `${player.photoPositionX}% ${player.photoPositionY}%`,
          transform: `scale(${player.photoZoom})`,
          transformOrigin: `${player.photoPositionX}% ${player.photoPositionY}%`,
        }}
      />
    </div>
  );
}

export default function CoachLineupEditor({
  leagueId,
  initialData,
}: {
  leagueId: string;
  initialData: InitialData;
}) {
  const initialFormation = COACH_FORMATION_OPTIONS.includes(
    initialData.lineup.formation as CoachFormation
  )
    ? (initialData.lineup.formation as CoachFormation)
    : "MANUAL";

  const [formation, setFormation] = useState<CoachFormation>(initialFormation);
  const [entries, setEntries] = useState<Record<string, Entry>>(
    Object.fromEntries(initialData.lineup.players.map((entry) => [entry.playerId, entry]))
  );
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(
    initialData.lineup.players[0]?.playerId ?? initialData.players[0]?.id ?? null
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fieldRef = useRef<HTMLDivElement | null>(null);

  const primary = safeColor(initialData.team.colorHex, "#F97316");
  const secondary = safeColor(
    initialData.team.secondaryColorHex ?? initialData.team.colorHex,
    "#7C3AED"
  );

  const selectedPlayer =
    initialData.players.find((player) => player.id === selectedPlayerId) ??
    initialData.players[0] ??
    null;

  const starters = useMemo(
    () => initialData.players.filter((player) => entries[player.id]?.status === "STARTER"),
    [entries, initialData.players]
  );
  const bench = useMemo(
    () => initialData.players.filter((player) => entries[player.id]?.status === "BENCH"),
    [entries, initialData.players]
  );
  const called = starters.length + bench.length;

  function orderedStarterIds(source: Record<string, Entry>) {
    return initialData.players
      .filter((player) => source[player.id]?.status === "STARTER")
      .sort((a, b) => {
        const ak = a.position?.toUpperCase() === "POR" ? 0 : 1;
        const bk = b.position?.toUpperCase() === "POR" ? 0 : 1;
        return ak - bk || a.number - b.number;
      })
      .map((player) => player.id);
  }

  function applyPreset(nextFormation: CoachFormation, source: Record<string, Entry>) {
    if (nextFormation === "MANUAL") return source;
    const points = COACH_FORMATIONS[nextFormation];
    const ids = orderedStarterIds(source);
    const next = { ...source };
    ids.forEach((id, index) => {
      const point = points[index];
      if (!point) return;
      next[id] = {
        ...next[id],
        positionX: point.x,
        positionY: point.y,
        sortOrder: index,
      };
    });
    return next;
  }

  function chooseFormation(value: CoachFormation) {
    if (!initialData.editable) return;
    setFormation(value);
    setEntries((current) => applyPreset(value, current));
    setSelectedPlayerId(null);
  }

  function setStatus(player: Player, status: "STARTER" | "BENCH" | "OUT") {
    if (!initialData.editable) return;
    setErr(null);

    if (!player.eligible && status !== "OUT") {
      setErr(`${player.firstName} ${player.lastName} non è idoneo alla distinta.`);
      return;
    }

    setEntries((current) => {
      const existing = current[player.id];
      const totalCalled = Object.keys(current).length;
      const totalStarters = Object.values(current).filter((entry) => entry.status === "STARTER").length;

      if (status === "OUT") {
        const next = { ...current };
        delete next[player.id];
        return applyPreset(formation, next);
      }

      if (!existing && totalCalled >= initialData.maxCalled) {
        setErr(`Puoi convocare al massimo ${initialData.maxCalled} giocatori.`);
        return current;
      }

      if (
        status === "STARTER" &&
        existing?.status !== "STARTER" &&
        totalStarters >= initialData.maxStarters
      ) {
        setErr(`Puoi schierare al massimo ${initialData.maxStarters} titolari.`);
        return current;
      }

      const next = {
        ...current,
        [player.id]: {
          playerId: player.id,
          status,
          positionX: status === "STARTER" ? existing?.positionX ?? 50 : null,
          positionY: status === "STARTER" ? existing?.positionY ?? 50 : null,
          sortOrder: existing?.sortOrder ?? totalCalled,
        } satisfies Entry,
      };

      return applyPreset(formation, next);
    });
  }

  function movePlayerTo(clientX: number, clientY: number, playerId: string) {
    if (
      !initialData.editable ||
      entries[playerId]?.status !== "STARTER" ||
      !fieldRef.current
    ) {
      return;
    }

    const rect = fieldRef.current.getBoundingClientRect();
    const x = Math.max(4, Math.min(96, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(95, ((clientY - rect.top) / rect.height) * 100));

    setFormation("MANUAL");
    setEntries((current) => ({
      ...current,
      [playerId]: {
        ...current[playerId],
        positionX: Math.round(x),
        positionY: Math.round(y),
      },
    }));
  }

  function placeSelected(event: MouseEvent<HTMLDivElement>) {
    if (
      !selectedPlayerId ||
      entries[selectedPlayerId]?.status !== "STARTER"
    ) {
      return;
    }
    movePlayerTo(event.clientX, event.clientY, selectedPlayerId);
  }

  function dragPlayer(
    event: ReactPointerEvent<HTMLButtonElement>,
    playerId: string
  ) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    movePlayerTo(event.clientX, event.clientY, playerId);
  }

  async function save() {
    if (!initialData.editable) return;
    setSaving(true);
    setErr(null);
    setMsg(null);

    try {
      const res = await authFetch(
        `/api/leagues/${leagueId}/coach/lineups/${initialData.match.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            formation,
            players: Object.values(entries),
          }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiError(body, "Errore salvataggio formazione"));
      setMsg(
        "Piano partita salvato. Se la distinta ufficiale è ancora vuota, arbitro e admin lo vedranno come proposta."
      );
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Errore salvataggio formazione");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="space-y-5 pb-24">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={`/leagues/${leagueId}/coach`}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-black text-[var(--muted)]"
          >
            <ArrowLeft size={16} /> Coach Center
          </Link>
          <Badge variant={initialData.editable ? "success" : "default"}>
            {initialData.editable ? "Modificabile" : "Bloccata"}
          </Badge>
        </div>

        <Card className="overflow-hidden !p-0">
          <div
            className="p-5 sm:p-7"
            style={{
              background: `linear-gradient(115deg, ${primary}25 0%, var(--card) 52%, ${safeColor(initialData.opponent.colorHex)}20 100%)`,
            }}
          >
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)]">
              Piano partita · Giornata {initialData.match.round}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] text-[var(--foreground)]">
              {initialData.team.name} · {initialData.opponent.name}
            </h1>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-[var(--muted)]">
              <span className="inline-flex items-center gap-2">
                <CalendarDays size={15} className="text-[var(--accent)]" />
                {formatDate(initialData.match.date)}
              </span>
              <span className="inline-flex items-center gap-2">
                <MapPin size={15} className="text-[var(--accent)]" />
                {initialData.match.venueName ?? "Campo da assegnare"}
              </span>
            </div>
          </div>
        </Card>

        {!initialData.editable && (
          <Card className="border-amber-400/20 bg-amber-400/[0.04]">
            <div className="flex items-start gap-3">
              <Lock size={18} className="mt-0.5 shrink-0 text-amber-300" />
              <div>
                <p className="font-black text-[var(--foreground)]">Formazione in sola lettura</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Le modifiche si chiudono {initialData.lockMinutes} minuti prima della partita.
                </p>
              </div>
            </div>
          </Card>
        )}

        {selectedPlayer && (
          <Card className="overflow-hidden !p-0">
            <div
              className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[190px_minmax(0,1fr)] lg:items-center"
              style={{
                background: `radial-gradient(circle at 16% 15%, ${primary}35, transparent 30%), linear-gradient(115deg, ${primary}18 0%, var(--card) 48%, ${secondary}20 100%)`,
              }}
            >
              <div className="mx-auto w-full max-w-[190px]">
                <CoachPlayerCard
                  player={selectedPlayer}
                  primaryColor={primary}
                  secondaryColor={secondary}
                />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">
                  Player focus
                </p>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="text-3xl font-black tracking-[-0.05em] text-[var(--foreground)]">
                    {selectedPlayer.firstName} {selectedPlayer.lastName}
                  </h2>
                  <span className="text-sm font-black text-[var(--muted)]">
                    #{selectedPlayer.number} · {selectedPlayer.position ?? "Giocatore"}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {[
                    ["Presenze", selectedPlayer.stats.appearances],
                    ["Gol", selectedPlayer.stats.goals],
                    ["Assist", selectedPlayer.stats.assists],
                    ["G+A", selectedPlayer.stats.goals + selectedPlayer.stats.assists],
                    ["MVP", selectedPlayer.stats.mvp],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="rounded-2xl border border-[var(--border)] bg-black/10 p-3 text-center"
                    >
                      <p className="text-2xl font-black text-[var(--foreground)]">
                        {value}
                      </p>
                      <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-[var(--muted)]">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant={selectedPlayer.eligible ? "success" : "default"}>
                    {selectedPlayer.eligible ? "Idoneo alla distinta" : "Non idoneo"}
                  </Badge>
                  {entries[selectedPlayer.id]?.status && (
                    <Badge variant="accent">
                      {entries[selectedPlayer.id].status === "STARTER" ? "Titolare" : "Panchina"}
                    </Badge>
                  )}
                  {formation === "MANUAL" && entries[selectedPlayer.id]?.status === "STARTER" && (
                    <Badge variant="default">Trascina la card sul campo</Badge>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}

        <Card>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-black text-[var(--foreground)]">Modulo</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Scegli un modulo standard oppure sposta direttamente un titolare sul campo: il sistema passerà automaticamente in modalità Libero.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {COACH_FORMATION_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={!initialData.editable}
                  onClick={() => chooseFormation(option)}
                  className={[
                    "rounded-xl border px-3 py-2 text-[10px] font-black transition",
                    formation === option
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "border-[var(--border)] bg-[var(--card-2)] text-[var(--muted)]",
                  ].join(" ")}
                >
                  {option === "MANUAL" ? "LIBERO" : option}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {err && <Badge variant="error">{err}</Badge>}
        {msg && <Badge variant="success">{msg}</Badge>}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
          <Card className="overflow-hidden !p-0">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] p-4">
              <div className="flex items-center gap-3">
                <Shirt size={18} className="text-[var(--accent)]" />
                <div>
                  <p className="font-black text-[var(--foreground)]">Campo</p>
                  <p className="text-xs text-[var(--muted)]">
                    {starters.length}/{initialData.maxStarters} titolari · {bench.length} panchina · {called}/{initialData.maxCalled} convocati
                  </p>
                </div>
              </div>
              {formation === "MANUAL" && (
                <span className="text-[10px] font-black uppercase text-[var(--accent)]">
                  Posizionamento libero
                </span>
              )}
            </div>

            <div className="p-3 sm:p-5">
              <div
                ref={fieldRef}
                onClick={placeSelected}
                className={[
                  "relative mx-auto aspect-[0.72] w-full max-w-[620px] overflow-hidden rounded-[28px] border-2 border-white/20 bg-[#1d7136]",
                  formation === "MANUAL" && selectedPlayerId ? "cursor-crosshair" : "",
                ].join(" ")}
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 50% 50%, rgba(255,255,255,.045), transparent 28%), repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 12.5%, rgba(0,0,0,.025) 12.5% 25%)",
                  boxShadow: "inset 0 0 70px rgba(0,0,0,.28)",
                }}
              >
                <div className="pointer-events-none absolute inset-[3%] rounded-[20px] border border-white/30" />
                <div className="pointer-events-none absolute left-1/2 top-[3%] bottom-[3%] w-px -translate-x-1/2 bg-white/25" />
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30" />
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/35" />
                <div className="pointer-events-none absolute inset-x-[18%] top-[3%] h-[15%] border border-white/30" />
                <div className="pointer-events-none absolute inset-x-[18%] bottom-[3%] h-[15%] border border-white/30" />

                {starters.map((player) => {
                  const entry = entries[player.id];
                  const selected = selectedPlayerId === player.id;
                  return (
                    <button
                      key={player.id}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedPlayerId(player.id);
                      }}
                      onPointerDown={(event) => {
                        if (!initialData.editable) return;
                        event.stopPropagation();
                        setSelectedPlayerId(player.id);
                        setFormation("MANUAL");
                        event.currentTarget.setPointerCapture(event.pointerId);
                      }}
                      onPointerMove={(event) => {
                        event.stopPropagation();
                        dragPlayer(event, player.id);
                      }}
                      onPointerUp={(event) => {
                        event.stopPropagation();
                        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                          event.currentTarget.releasePointerCapture(event.pointerId);
                        }
                      }}
                      className={[
                        "absolute w-[88px] -translate-x-1/2 -translate-y-1/2 select-none rounded-2xl border p-1.5 text-center text-white shadow-2xl backdrop-blur-md transition-[box-shadow,transform]",
                        selected
                          ? "z-20 border-[var(--accent)] bg-black/80 ring-2 ring-[var(--accent)]/30"
                          : "z-10 border-white/20 bg-black/65",
                      ].join(" ")}
                      style={{
                        left: `${entry.positionX ?? 50}%`,
                        top: `${entry.positionY ?? 50}%`,
                        touchAction: "none",
                      }}
                    >
                      <div className="mx-auto h-10 w-9 overflow-hidden rounded-lg bg-white/5">
                        {player.photoUrl ? (
                          <img
                            src={player.photoUrl}
                            alt=""
                            draggable={false}
                            className="h-full w-full object-contain"
                            style={{
                              objectPosition: `${player.photoPositionX}% ${player.photoPositionY}%`,
                              transform: `scale(${player.photoZoom})`,
                              transformOrigin: `${player.photoPositionX}% ${player.photoPositionY}%`,
                            }}
                          />
                        ) : (
                          <span className="grid h-full place-items-center text-[9px] font-black">
                            {player.firstName[0]}{player.lastName[0]}
                          </span>
                        )}
                      </div>
                      <span className="mt-1 block truncate text-[10px] font-black">
                        #{player.number} {player.lastName}
                      </span>
                      <span className="block truncate text-[8px] text-white/55">
                        {player.position ?? "—"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-[var(--border)] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--muted)]">
                Panchina
              </p>
              <div className="mt-2 flex min-h-16 flex-wrap gap-2">
                {bench.length ? (
                  bench.map((player) => (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => setSelectedPlayerId(player.id)}
                      className={[
                        "flex items-center gap-2 rounded-xl border bg-[var(--card-2)] px-2.5 py-2 text-left",
                        selectedPlayerId === player.id
                          ? "border-[var(--accent)]"
                          : "border-[var(--border)]",
                      ].join(" ")}
                    >
                      <PlayerPhoto player={player} />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-black text-[var(--foreground)]">
                          #{player.number} {player.lastName}
                        </span>
                        <span className="block text-[9px] font-bold text-[var(--muted)]">
                          {player.stats.goals}G · {player.stats.assists}A · {player.stats.mvp} MVP
                        </span>
                      </span>
                    </button>
                  ))
                ) : (
                  <span className="text-xs text-[var(--muted)]">Nessun giocatore in panchina.</span>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <Users size={18} className="text-[var(--accent)]" />
              <div>
                <p className="font-black text-[var(--foreground)]">Convocazioni</p>
                <p className="text-xs text-[var(--muted)]">
                  Titolare, panchina o fuori. Nessuna scelta è obbligatoria.
                </p>
              </div>
            </div>

            <div className="mt-4 max-h-[760px] space-y-2 overflow-y-auto pr-1">
              {initialData.players.map((player) => {
                const status = entries[player.id]?.status ?? "OUT";
                return (
                  <div
                    key={player.id}
                    className={[
                      "rounded-2xl border bg-[var(--card-2)] p-3 transition",
                      selectedPlayerId === player.id
                        ? "border-[var(--accent)] shadow-[0_0_0_1px_var(--accent-soft)]"
                        : "border-[var(--border)]",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedPlayerId(player.id)}
                      className="flex w-full items-center gap-3 text-left"
                    >
                      <PlayerPhoto player={player} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-[var(--foreground)]">
                          #{player.number} {player.firstName} {player.lastName}
                        </p>
                        <p className="text-[10px] font-bold uppercase text-[var(--muted)]">
                          {player.position ?? "Giocatore"} · {player.stats.goals}G {player.stats.assists}A · {player.stats.mvp} MVP
                        </p>
                      </div>
                      {!player.eligible && (
                        <ShieldAlert
                          size={16}
                          className="shrink-0 text-amber-300"
                          aria-label="Non idoneo alla distinta"
                        />
                      )}
                    </button>

                    <div className="mt-3 grid grid-cols-3 gap-1">
                      {(["STARTER", "BENCH", "OUT"] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          disabled={!initialData.editable || (!player.eligible && value !== "OUT")}
                          onClick={() => setStatus(player, value)}
                          className={[
                            "rounded-xl px-2 py-2 text-[9px] font-black transition",
                            status === value
                              ? "bg-[var(--accent)] text-black"
                              : "bg-black/10 text-[var(--muted)]",
                            !initialData.editable || (!player.eligible && value !== "OUT")
                              ? "cursor-not-allowed opacity-40"
                              : "",
                          ].join(" ")}
                        >
                          {value === "STARTER" ? "TITOLARE" : value === "BENCH" ? "PANCA" : "FUORI"}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <Card className="sticky bottom-20 z-20 border-[var(--accent)]/20 bg-[var(--tabbar-bg)] backdrop-blur-xl lg:bottom-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-black text-[var(--foreground)]">
                {starters.length} titolari · {bench.length} panchina · {called} convocati
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {initialData.deadline
                  ? `Modificabile fino a ${formatDate(initialData.deadline)}`
                  : "Nessuna data assegnata: il piano resta modificabile."}
              </p>
            </div>
            <Button
              onClick={save}
              disabled={saving || !initialData.editable}
            >
              {saving ? (
                "Salvataggio…"
              ) : (
                <>
                  <Save size={16} /> Salva piano partita
                </>
              )}
            </Button>
          </div>
        </Card>

        <Card className="border-sky-400/20 bg-sky-400/[0.04]">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-sky-300" />
            <p className="text-xs leading-relaxed text-[var(--muted)]">
              Questa formazione è una proposta tecnica. Non finalizza la distinta,
              non modifica il risultato e non blocca una squadra che non utilizza Coach Mode.
            </p>
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
