"use client";

import Link from "next/link";
import {
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
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
import { authFetch } from "@/lib/client-auth";
import { readApiError } from "@/modules/core/client-error";
import {
  COACH_FORMATIONS,
  COACH_FORMATION_OPTIONS,
  assignPlayersToFormation,
  coachRolePreferences,
  fieldZoneRole,
  isCoachRoleCompatible,
  type CoachFormation,
  type CoachSlotRole,
} from "@/modules/coaches/domain/coach-formations";

type TeamInfo = {
  id: string;
  name: string;
  badgeUrl: string | null;
  colorHex: string | null;
  secondaryColorHex: string | null;
  kitHomeUrl?: string | null;
  kitAwayUrl?: string | null;
  kitGoalkeeperUrl?: string | null;
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

const ROLE_LABEL: Record<CoachSlotRole, string> = {
  GK: "POR",
  DEF: "DIF",
  MID: "CC",
  ATT: "ATT",
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

function PlayerPhoto({
  player,
  compact = false,
}: {
  player: Player;
  compact?: boolean;
}) {
  const size = compact ? "h-11 w-9" : "h-16 w-13";
  if (!player.photoUrl) {
    return (
      <div className={`${size} grid shrink-0 place-items-center rounded-xl bg-black/20 text-[10px] font-black text-[var(--muted)]`}>
        {player.firstName[0]}{player.lastName[0]}
      </div>
    );
  }
  return (
    <div className={`${size} shrink-0 overflow-hidden rounded-xl bg-black/20`}>
      <img
        src={player.photoUrl}
        alt={`${player.firstName} ${player.lastName}`}
        draggable={false}
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

function TeamKit({
  url,
  number,
  primary,
  secondary,
  goalkeeper = false,
}: {
  url?: string | null;
  number: number;
  primary: string;
  secondary: string;
  goalkeeper?: boolean;
}) {
  if (url) {
    return (
      <div className="relative mx-auto h-16 w-16">
        <img
          src={url}
          alt=""
          draggable={false}
          className="h-full w-full object-contain drop-shadow-[0_8px_7px_rgba(0,0,0,.35)]"
        />
        <span className="absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 rounded bg-black/35 px-1 text-[9px] font-black text-white shadow">
          {number}
        </span>
      </div>
    );
  }

  const first = goalkeeper ? secondary : primary;
  const second = goalkeeper ? primary : secondary;

  return (
    <div className="relative mx-auto h-16 w-16 drop-shadow-[0_8px_7px_rgba(0,0,0,.3)]">
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id={`kit-${number}-${goalkeeper ? "gk" : "out"}`} x1="0" x2="1">
            <stop offset="0%" stopColor={first} />
            <stop offset="100%" stopColor={second} />
          </linearGradient>
        </defs>
        <path
          d="M29 18 42 11h16l13 7 20 14-12 18-10-7v45H31V43l-10 7L9 32l20-14Z"
          fill={`url(#kit-${number}-${goalkeeper ? "gk" : "out"})`}
          stroke="rgba(255,255,255,.45)"
          strokeWidth="2"
        />
        <path d="M42 11c1 10 15 10 16 0" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="2" />
      </svg>
      <span className="absolute left-1/2 top-[48%] -translate-x-1/2 -translate-y-1/2 text-[11px] font-black text-white drop-shadow">
        {number}
      </span>
    </div>
  );
}

function closestPresetRole(
  formation: Exclude<CoachFormation, "MANUAL">,
  x: number,
  y: number
): CoachSlotRole {
  let bestRole: CoachSlotRole = COACH_FORMATIONS[formation][0].role;
  let distance = Number.POSITIVE_INFINITY;

  for (const slot of COACH_FORMATIONS[formation]) {
    const current = Math.hypot(slot.x - x, slot.y - y);
    if (current < distance) {
      distance = current;
      bestRole = slot.role;
    }
  }

  return bestRole;
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

  const playerById = useMemo(
    () => new Map(initialData.players.map((player) => [player.id, player])),
    [initialData.players]
  );

  const selectedPlayer =
    (selectedPlayerId ? playerById.get(selectedPlayerId) : null) ??
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

  function automaticLayout(
    nextFormation: Exclude<CoachFormation, "MANUAL">,
    source: Record<string, Entry>
  ) {
    const starterPlayers = initialData.players
      .filter((player) => source[player.id]?.status === "STARTER")
      .map((player) => ({
        playerId: player.id,
        position: player.position,
      }));

    const assigned = assignPlayersToFormation(starterPlayers, nextFormation);
    if (!assigned) return null;

    const next = { ...source };
    starterPlayers.forEach((player, index) => {
      const point = assigned[player.playerId];
      next[player.playerId] = {
        ...next[player.playerId],
        positionX: point.x,
        positionY: point.y,
        sortOrder: index,
      };
    });
    return next;
  }

  function chooseFormation(value: CoachFormation) {
    if (!initialData.editable) return;
    setErr(null);

    if (value === "MANUAL") {
      setFormation("MANUAL");
      return;
    }

    const next = automaticLayout(value, entries);
    if (!next) {
      setErr(
        "I titolari attuali non entrano tutti nei ruoli previsti da questo modulo. Sposta qualcuno in panchina oppure usa Libero."
      );
      return;
    }

    setFormation(value);
    setEntries(next);
  }

  function setStatus(
    player: Player,
    status: "STARTER" | "BENCH" | "OUT",
    manualPoint?: { x: number; y: number }
  ) {
    if (!initialData.editable) return;
    setErr(null);

    if (!player.eligible && status !== "OUT") {
      setErr(`${player.firstName} ${player.lastName} non è idoneo alla distinta.`);
      return;
    }

    setEntries((current) => {
      const existing = current[player.id];
      const totalCalled = Object.keys(current).length;
      const totalStarters = Object.values(current).filter(
        (entry) => entry.status === "STARTER"
      ).length;

      if (status === "OUT") {
        const next = { ...current };
        delete next[player.id];

        if (formation !== "MANUAL") {
          return automaticLayout(formation, next) ?? next;
        }
        return next;
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

      let next: Record<string, Entry> = {
        ...current,
        [player.id]: {
          playerId: player.id,
          status,
          positionX:
            status === "STARTER"
              ? manualPoint?.x ?? existing?.positionX ?? 50
              : null,
          positionY:
            status === "STARTER"
              ? manualPoint?.y ?? existing?.positionY ?? 50
              : null,
          sortOrder: existing?.sortOrder ?? totalCalled,
        },
      };

      if (status === "STARTER" && formation !== "MANUAL") {
        const laidOut = automaticLayout(formation, next);
        if (!laidOut) {
          setErr(
            `${player.firstName} ${player.lastName} non trova uno slot compatibile nel ${formation}. Usa Libero per forzare il ruolo oppure cambia modulo.`
          );
          return current;
        }
        next = laidOut;
      }

      return next;
    });

    setSelectedPlayerId(player.id);
  }

  function pointFromClient(clientX: number, clientY: number) {
    if (!fieldRef.current) return null;
    const rect = fieldRef.current.getBoundingClientRect();
    return {
      x: Math.round(
        Math.max(4, Math.min(96, ((clientX - rect.left) / rect.width) * 100))
      ),
      y: Math.round(
        Math.max(5, Math.min(95, ((clientY - rect.top) / rect.height) * 100))
      ),
    };
  }

  function moveStarter(
    clientX: number,
    clientY: number,
    playerId: string
  ) {
    if (!initialData.editable || entries[playerId]?.status !== "STARTER") return;
    const point = pointFromClient(clientX, clientY);
    if (!point) return;

    setFormation("MANUAL");
    setEntries((current) => ({
      ...current,
      [playerId]: {
        ...current[playerId],
        positionX: point.x,
        positionY: point.y,
      },
    }));
  }

  function placeSelected(event: MouseEvent<HTMLDivElement>) {
    if (
      formation !== "MANUAL" ||
      !selectedPlayerId ||
      entries[selectedPlayerId]?.status !== "STARTER"
    ) {
      return;
    }
    moveStarter(event.clientX, event.clientY, selectedPlayerId);
  }

  function dragFieldPlayer(
    event: ReactPointerEvent<HTMLButtonElement>,
    playerId: string
  ) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    moveStarter(event.clientX, event.clientY, playerId);
  }

  function beginRosterDrag(event: DragEvent<HTMLElement>, player: Player) {
    if (!initialData.editable || !player.eligible) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/coach-player-id", player.id);
    event.dataTransfer.setData("text/plain", player.id);
    setSelectedPlayerId(player.id);
  }

  function draggedPlayer(event: DragEvent<HTMLElement>) {
    const id =
      event.dataTransfer.getData("text/coach-player-id") ||
      event.dataTransfer.getData("text/plain");
    return playerById.get(id) ?? null;
  }

  function dropOnField(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const player = draggedPlayer(event);
    if (!player) return;

    if (formation === "MANUAL") {
      const point = pointFromClient(event.clientX, event.clientY);
      if (!point) return;
      setStatus(player, "STARTER", point);
      return;
    }

    setStatus(player, "STARTER");
  }

  function dropOnBench(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const player = draggedPlayer(event);
    if (!player) return;
    setStatus(player, "BENCH");
  }

  function dropOnStarter(event: DragEvent<HTMLElement>, target: Player) {
    event.preventDefault();
    event.stopPropagation();
    const source = draggedPlayer(event);
    if (!source || source.id === target.id || !source.eligible) return;
    const targetEntry = entries[target.id];
    if (!targetEntry || targetEntry.status !== "STARTER") return;

    setEntries((current) => {
      const sourceEntry = current[source.id];
      const next = { ...current };
      next[source.id] = { ...targetEntry, playerId: source.id };

      if (sourceEntry?.status === "STARTER") {
        next[target.id] = { ...sourceEntry, playerId: target.id };
      } else if (sourceEntry?.status === "BENCH") {
        next[target.id] = {
          playerId: target.id,
          status: "BENCH",
          positionX: null,
          positionY: null,
          sortOrder: sourceEntry.sortOrder,
        };
      } else {
        delete next[target.id];
      }
      return next;
    });
    setSelectedPlayerId(source.id);
  }

  function roleForEntry(entry: Entry): CoachSlotRole {
    if (formation === "MANUAL") {
      return fieldZoneRole(entry.positionY ?? 50);
    }
    return closestPresetRole(
      formation,
      entry.positionX ?? 50,
      entry.positionY ?? 50
    );
  }

  function playerOutOfRole(player: Player) {
    const entry = entries[player.id];
    if (!entry || entry.status !== "STARTER") return false;
    return !isCoachRoleCompatible(player.position, roleForEntry(entry));
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
      if (!res.ok) {
        throw new Error(readApiError(body, "Errore salvataggio formazione"));
      }
      setMsg(
        "Piano partita salvato. Se la distinta ufficiale è ancora vuota, arbitro e admin lo vedranno come proposta."
      );
    } catch (error) {
      setErr(
        error instanceof Error ? error.message : "Errore salvataggio formazione"
      );
    } finally {
      setSaving(false);
    }
  }

  const primary = safeColor(initialData.team.colorHex, "#F97316");
  const secondary = safeColor(
    initialData.team.secondaryColorHex ?? initialData.team.colorHex,
    "#7C3AED"
  );
  const outfieldKitUrl =
    initialData.match.isHome
      ? initialData.team.kitHomeUrl
      : initialData.team.kitAwayUrl ?? initialData.team.kitHomeUrl;

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
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
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

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/leagues/${leagueId}/teams/${initialData.team.id}`}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card-2)] px-3 text-xs font-black text-[var(--foreground)]"
                >
                  Pagina squadra <ExternalLink size={13} />
                </Link>
                <Link
                  href={`/leagues/${leagueId}/teams/${initialData.opponent.id}`}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card-2)] px-3 text-xs font-black text-[var(--muted)]"
                >
                  Avversario <ExternalLink size={13} />
                </Link>
              </div>
            </div>
          </div>
        </Card>

        {selectedPlayer && (
          <Card className="overflow-hidden !p-0">
            <div
              className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5"
              style={{
                background: `linear-gradient(100deg, ${primary}18 0%, var(--card) 48%, ${secondary}16 100%)`,
              }}
            >
              <PlayerPhoto player={selectedPlayer} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h2 className="truncate text-2xl font-black text-[var(--foreground)]">
                    {selectedPlayer.firstName} {selectedPlayer.lastName}
                  </h2>
                  <span className="text-xs font-black uppercase text-[var(--accent)]">
                    #{selectedPlayer.number} · {selectedPlayer.position ?? "—"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                  {[
                    ["P", selectedPlayer.stats.appearances],
                    ["G", selectedPlayer.stats.goals],
                    ["A", selectedPlayer.stats.assists],
                    ["G+A", selectedPlayer.stats.goals + selectedPlayer.stats.assists],
                    ["MVP", selectedPlayer.stats.mvp],
                  ].map(([label, value]) => (
                    <span key={String(label)} className="text-sm">
                      <b className="text-lg font-black text-[var(--foreground)]">
                        {value}
                      </b>{" "}
                      <span className="text-[10px] font-black uppercase text-[var(--muted)]">
                        {label}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
              <Link
                href={`/leagues/${leagueId}/players/${selectedPlayer.id}`}
                className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card-2)] px-3 text-xs font-black text-[var(--accent)]"
              >
                Profilo <ExternalLink size={13} />
              </Link>
            </div>
          </Card>
        )}

        {!initialData.editable && (
          <Card className="border-amber-400/20 bg-amber-400/[0.04]">
            <div className="flex items-start gap-3">
              <Lock size={18} className="mt-0.5 shrink-0 text-amber-300" />
              <div>
                <p className="font-black text-[var(--foreground)]">
                  Formazione in sola lettura
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Le modifiche si chiudono {initialData.lockMinutes} minuti prima della partita.
                </p>
              </div>
            </div>
          </Card>
        )}

        <Card>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-black text-[var(--foreground)]">Modulo</p>
              <p className="mt-1 max-w-2xl text-xs text-[var(--muted)]">
                Nei moduli standard il sistema assegna automaticamente POR, difensori,
                centrocampisti ed attaccanti agli slot compatibili. Libero permette di
                forzare qualunque disposizione.
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

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.28fr)_minmax(330px,.72fr)]">
          <Card className="overflow-hidden !p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-4">
              <div className="flex items-center gap-3">
                <Shirt size={18} className="text-[var(--accent)]" />
                <div>
                  <p className="font-black text-[var(--foreground)]">Campo</p>
                  <p className="text-xs text-[var(--muted)]">
                    {starters.length}/{initialData.maxStarters} titolari · {bench.length} panchina · {called}/{initialData.maxCalled} convocati
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase text-[var(--muted)]">
                Trascina dalla rosa →
              </span>
            </div>

            <div className="p-3 sm:p-5">
              <div
                ref={fieldRef}
                onClick={placeSelected}
                onDragOver={(event) => {
                  if (!initialData.editable) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={dropOnField}
                className={[
                  "relative mx-auto aspect-[0.72] w-full max-w-[640px] overflow-hidden rounded-[28px] border-2 border-white/20 bg-[#1d7136]",
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
                <div className="pointer-events-none absolute inset-x-[18%] top-[3%] h-[15%] border border-white/30" />
                <div className="pointer-events-none absolute inset-x-[18%] bottom-[3%] h-[15%] border border-white/30" />

                {formation !== "MANUAL" &&
                  COACH_FORMATIONS[formation].map((slot, index) => {
                    const occupied = starters.some((player) => {
                      const entry = entries[player.id];
                      return (
                        Math.abs((entry?.positionX ?? -100) - slot.x) < 1 &&
                        Math.abs((entry?.positionY ?? -100) - slot.y) < 1
                      );
                    });
                    if (occupied) return null;
                    return (
                      <div
                        key={`${slot.role}-${index}`}
                        className="pointer-events-none absolute grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-dashed border-white/35 bg-black/10 text-[9px] font-black text-white/45"
                        style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                      >
                        {ROLE_LABEL[slot.role]}
                      </div>
                    );
                  })}

                {starters.map((player) => {
                  const entry = entries[player.id];
                  const selected = selectedPlayerId === player.id;
                  const outOfRole = playerOutOfRole(player);

                  return (
                    <button
                      key={player.id}
                      type="button"
                      draggable={initialData.editable && player.eligible}
                      onDragStart={(event) => beginRosterDrag(event, player)}
                      onDragOver={(event) => {
                        if (initialData.editable) event.preventDefault();
                      }}
                      onDrop={(event) => dropOnStarter(event, player)}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedPlayerId(player.id);
                      }}
                      onPointerDown={(event) => {
                        if (!initialData.editable) return;
                        event.stopPropagation();
                        setSelectedPlayerId(player.id);
                        event.currentTarget.setPointerCapture(event.pointerId);
                      }}
                      onPointerMove={(event) => {
                        event.stopPropagation();
                        dragFieldPlayer(event, player.id);
                      }}
                      onPointerUp={(event) => {
                        event.stopPropagation();
                        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                          event.currentTarget.releasePointerCapture(event.pointerId);
                        }
                      }}
                      className={[
                        "absolute w-[104px] -translate-x-1/2 -translate-y-1/2 select-none rounded-2xl p-1 text-center text-white transition",
                        selected
                          ? "z-20 bg-black/15 ring-2 ring-[var(--accent)]/70"
                          : "z-10 hover:bg-black/10",
                        outOfRole ? "ring-1 ring-amber-300/80" : "",
                      ].join(" ")}
                      style={{
                        left: `${entry.positionX ?? 50}%`,
                        top: `${entry.positionY ?? 50}%`,
                        touchAction: "none",
                      }}
                    >
                      <TeamKit
                        url={
                          roleForEntry(entry) === "GK"
                            ? initialData.team.kitGoalkeeperUrl ?? outfieldKitUrl
                            : outfieldKitUrl
                        }
                        number={player.number}
                        primary={primary}
                        secondary={secondary}
                        goalkeeper={roleForEntry(entry) === "GK"}
                      />
                      <span className="mt-0.5 block truncate text-[10px] font-black">
                        {player.lastName}
                      </span>
                      <span className="block truncate text-[8px] text-white/55">
                        {ROLE_LABEL[roleForEntry(entry)]}
                        {outOfRole ? " · FUORI RUOLO" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              onDragOver={(event) => {
                if (!initialData.editable) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={dropOnBench}
              className="border-t border-[var(--border)] p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--muted)]">
                  Panchina
                </p>
                <span className="text-[9px] font-bold text-[var(--muted)]">
                  Trascina qui per mettere in panchina
                </span>
              </div>
              <div className="mt-2 flex min-h-20 flex-wrap gap-2 rounded-2xl border border-dashed border-[var(--border)] p-2">
                {bench.length ? (
                  bench.map((player) => (
                    <button
                      key={player.id}
                      type="button"
                      draggable={initialData.editable && player.eligible}
                      onDragStart={(event) => beginRosterDrag(event, player)}
                      onClick={() => setSelectedPlayerId(player.id)}
                      className={[
                        "flex items-center gap-2 rounded-xl border bg-[var(--card-2)] px-2.5 py-2 text-left",
                        selectedPlayerId === player.id
                          ? "border-[var(--accent)]"
                          : "border-[var(--border)]",
                      ].join(" ")}
                    >
                      <PlayerPhoto player={player} compact />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-black text-[var(--foreground)]">
                          #{player.number} {player.lastName}
                        </span>
                        <span className="block text-[9px] font-bold text-[var(--muted)]">
                          {player.stats.goals}G · {player.stats.assists}A
                        </span>
                      </span>
                    </button>
                  ))
                ) : (
                  <span className="self-center px-2 text-xs text-[var(--muted)]">
                    Nessun giocatore in panchina.
                  </span>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <Users size={18} className="text-[var(--accent)]" />
              <div>
                <p className="font-black text-[var(--foreground)]">Rosa</p>
                <p className="text-xs text-[var(--muted)]">
                  Trascina un giocatore sul campo: verrà schierato automaticamente nel suo ruolo.
                </p>
              </div>
            </div>

            <div className="mt-4 max-h-[790px] space-y-2 overflow-y-auto pr-1">
              {initialData.players.map((player) => {
                const status = entries[player.id]?.status ?? "OUT";
                const preferences = coachRolePreferences(player.position);

                return (
                  <div
                    key={player.id}
                    draggable={initialData.editable && player.eligible}
                    onDragStart={(event) => beginRosterDrag(event, player)}
                    className={[
                      "rounded-2xl border bg-[var(--card-2)] p-3 transition",
                      selectedPlayerId === player.id
                        ? "border-[var(--accent)]"
                        : "border-[var(--border)]",
                      initialData.editable && player.eligible
                        ? "cursor-grab active:cursor-grabbing"
                        : "",
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
                          {player.position ?? "Giocatore"} · preferenza {preferences.map((role) => ROLE_LABEL[role]).join(" / ")}
                        </p>
                        <p className="mt-1 text-[10px] font-bold text-[var(--muted)]">
                          {player.stats.appearances}P · {player.stats.goals}G · {player.stats.assists}A · {player.stats.mvp} MVP
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

                    <div className="mt-3 grid grid-cols-[1fr_1fr_1fr_auto] gap-1">
                      {(["STARTER", "BENCH", "OUT"] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          disabled={
                            !initialData.editable ||
                            (!player.eligible && value !== "OUT")
                          }
                          onClick={() => setStatus(player, value)}
                          className={[
                            "rounded-xl px-2 py-2 text-[9px] font-black transition",
                            status === value
                              ? "bg-[var(--accent)] text-black"
                              : "bg-black/10 text-[var(--muted)]",
                            !initialData.editable ||
                            (!player.eligible && value !== "OUT")
                              ? "cursor-not-allowed opacity-40"
                              : "",
                          ].join(" ")}
                        >
                          {value === "STARTER"
                            ? "TITOLARE"
                            : value === "BENCH"
                              ? "PANCA"
                              : "FUORI"}
                        </button>
                      ))}
                      <Link
                        href={`/leagues/${leagueId}/players/${player.id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="grid min-h-8 place-items-center rounded-xl border border-[var(--border)] px-2 text-[var(--accent)]"
                        aria-label={`Apri profilo di ${player.firstName} ${player.lastName}`}
                      >
                        <ExternalLink size={13} />
                      </Link>
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
            <Button onClick={save} disabled={saving || !initialData.editable}>
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
              I moduli standard rispettano i ruoli. Per una scelta volutamente fuori ruolo
              passa a Libero o trascina direttamente un titolare già in campo.
              La formazione resta una proposta tecnica e non sostituisce la distinta ufficiale.
            </p>
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
