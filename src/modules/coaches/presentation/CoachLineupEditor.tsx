"use client";

import Link from "next/link";
import {
  useMemo,
  useState,
  type DragEvent,
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

function primaryRoleLabel(position: string | null) {
  const [role] = coachRolePreferences(position);
  return role ? ROLE_LABEL[role] : "CC";
}

function BenchPlayerPhoto({ player }: { player: Player }) {
  if (!player.photoUrl) {
    return (
      <div className="grid h-24 w-full place-items-center text-2xl font-black text-white/35 sm:h-28 lg:h-32">
        {player.firstName[0]}{player.lastName[0]}
      </div>
    );
  }

  return (
    <div className="relative h-24 w-full overflow-hidden sm:h-28 lg:h-32">
      <img
        src={player.photoUrl}
        alt={`${player.firstName} ${player.lastName}`}
        draggable={false}
        className="h-full w-full object-contain object-bottom drop-shadow-[0_8px_8px_rgba(0,0,0,.45)]"
        style={{
          objectPosition: `${player.photoPositionX}% ${player.photoPositionY}%`,
          transform: `scale(${player.photoZoom})`,
          transformOrigin: `${player.photoPositionX}% ${player.photoPositionY}%`,
        }}
      />
    </div>
  );
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
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const normalizedUrl = url?.trim() || null;
  const showUploadedKit = Boolean(normalizedUrl && failedUrl !== normalizedUrl);

  if (showUploadedKit && normalizedUrl) {
    return (
      <div className="relative mx-auto h-14 w-14 sm:h-[72px] sm:w-[72px] lg:h-[82px] lg:w-[82px]">
        <img
          src={normalizedUrl}
          alt="Divisa squadra"
          draggable={false}
          onError={() => setFailedUrl(normalizedUrl)}
          className="h-full w-full object-contain drop-shadow-[0_9px_8px_rgba(0,0,0,.42)]"
        />
      </div>
    );
  }

  const first = goalkeeper ? secondary : primary;
  const second = goalkeeper ? primary : secondary;

  return (
    <div className="relative mx-auto h-14 w-14 drop-shadow-[0_9px_8px_rgba(0,0,0,.35)] sm:h-[72px] sm:w-[72px] lg:h-[82px] lg:w-[82px]">
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
          stroke="rgba(255,255,255,.55)"
          strokeWidth="2"
        />
        <path d="M42 11c1 10 15 10 16 0" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="2" />
      </svg>
    </div>
  );
}

function closestPresetRole(
  formation: CoachFormation,
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

function entryMatchesSlot(
  entry: Entry | undefined,
  slot: { x: number; y: number },
  tolerance = 1
) {
  return Boolean(
    entry?.status === "STARTER" &&
      entry.positionX !== null &&
      entry.positionY !== null &&
      Math.abs(entry.positionX - slot.x) <= tolerance &&
      Math.abs(entry.positionY - slot.y) <= tolerance
  );
}

function entriesFitFormation(
  source: Record<string, Entry>,
  formation: CoachFormation
) {
  const used = new Set<number>();
  for (const entry of Object.values(source)) {
    if (entry.status !== "STARTER") continue;
    const slotIndex = COACH_FORMATIONS[formation].findIndex(
      (slot, index) => !used.has(index) && entryMatchesSlot(entry, slot, 4)
    );
    if (slotIndex < 0) return false;
    used.add(slotIndex);
  }
  return true;
}

function layoutEntriesForFormation(
  source: Record<string, Entry>,
  players: Player[],
  formation: CoachFormation
) {
  const starterPlayers = players
    .filter((player) => source[player.id]?.status === "STARTER")
    .map((player) => ({ playerId: player.id, position: player.position }));

  const preferred = assignPlayersToFormation(starterPlayers, formation);
  const assigned: Record<string, { x: number; y: number; role: CoachSlotRole }> =
    preferred ? { ...preferred } : {};

  if (!preferred) {
    const slots = COACH_FORMATIONS[formation].map((slot, index) => ({ ...slot, index }));
    const used = new Set<number>();
    const ordered = [...starterPlayers].sort((a, b) => {
      const aPrefs = coachRolePreferences(a.position).length;
      const bPrefs = coachRolePreferences(b.position).length;
      if (aPrefs !== bPrefs) return aPrefs - bPrefs;
      return a.playerId.localeCompare(b.playerId);
    });

    for (const player of ordered) {
      const preferences = coachRolePreferences(player.position);
      let selected = slots.find(
        (slot) => !used.has(slot.index) && preferences.includes(slot.role)
      );
      selected ??= slots.find((slot) => !used.has(slot.index));
      if (!selected) break;
      used.add(selected.index);
      assigned[player.playerId] = {
        x: selected.x,
        y: selected.y,
        role: selected.role,
      };
    }
  }

  const next = { ...source };
  starterPlayers.forEach((player, index) => {
    const point = assigned[player.playerId];
    if (!point) return;
    next[player.playerId] = {
      ...next[player.playerId],
      positionX: point.x,
      positionY: point.y,
      sortOrder: index,
    };
  });
  return next;
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
    : "3-3-1";

  const [formation, setFormation] = useState<CoachFormation>(initialFormation);
  const [entries, setEntries] = useState<Record<string, Entry>>(() => {
    const source = Object.fromEntries(
      initialData.lineup.players.map((entry) => [entry.playerId, entry])
    );
    return entriesFitFormation(source, initialFormation)
      ? source
      : layoutEntriesForFormation(source, initialData.players, initialFormation);
  });
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(
    initialData.lineup.players[0]?.playerId ?? initialData.players[0]?.id ?? null
  );
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
    nextFormation: CoachFormation,
    source: Record<string, Entry>
  ) {
    return layoutEntriesForFormation(source, initialData.players, nextFormation);
  }

  function chooseFormation(value: CoachFormation) {
    if (!initialData.editable) return;
    setErr(null);
    setFormation(value);
    setEntries((current) => automaticLayout(value, current));
  }

  function playerIdAtSlot(
    source: Record<string, Entry>,
    slot: { x: number; y: number }
  ) {
    return Object.values(source).find(
      (entry) => entryMatchesSlot(entry, slot, 1)
    )?.playerId ?? null;
  }

  function setStatus(
    player: Player,
    status: "STARTER" | "BENCH" | "OUT"
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
        return next;
      }

      if (!existing && totalCalled >= initialData.maxCalled) {
        setErr(`Puoi convocare al massimo ${initialData.maxCalled} giocatori.`);
        return current;
      }

      if (status === "BENCH") {
        return {
          ...current,
          [player.id]: {
            playerId: player.id,
            status: "BENCH",
            positionX: null,
            positionY: null,
            sortOrder: existing?.sortOrder ?? totalCalled,
          },
        };
      }

      if (existing?.status === "STARTER") return current;
      if (totalStarters >= initialData.maxStarters) {
        setErr(`Puoi schierare al massimo ${initialData.maxStarters} titolari.`);
        return current;
      }

      const preferences = coachRolePreferences(player.position);
      const freeSlots = COACH_FORMATIONS[formation].filter(
        (slot) => !playerIdAtSlot(current, slot)
      );
      const selectedSlot =
        freeSlots.find((slot) => preferences.includes(slot.role)) ?? freeSlots[0];

      if (!selectedSlot) {
        setErr("Non ci sono slot liberi nel modulo selezionato.");
        return current;
      }

      return {
        ...current,
        [player.id]: {
          playerId: player.id,
          status: "STARTER",
          positionX: selectedSlot.x,
          positionY: selectedSlot.y,
          sortOrder: existing?.sortOrder ?? totalCalled,
        },
      };
    });

    setSelectedPlayerId(player.id);
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

  function dropOnSlot(
    event: DragEvent<HTMLDivElement>,
    slot: { x: number; y: number },
    slotIndex: number
  ) {
    event.preventDefault();
    event.stopPropagation();
    setDragOverSlot(null);

    const source = draggedPlayer(event);
    if (!source || !source.eligible || !initialData.editable) return;

    setEntries((current) => {
      const sourceEntry = current[source.id];
      const targetPlayerId = playerIdAtSlot(current, slot);
      if (targetPlayerId === source.id) return current;

      const targetEntry = targetPlayerId ? current[targetPlayerId] : null;
      const totalCalled = Object.keys(current).length;
      const totalStarters = Object.values(current).filter(
        (entry) => entry.status === "STARTER"
      ).length;

      if (!sourceEntry && !targetEntry && totalCalled >= initialData.maxCalled) {
        setErr(`Puoi convocare al massimo ${initialData.maxCalled} giocatori.`);
        return current;
      }
      if (sourceEntry?.status !== "STARTER" && !targetEntry && totalStarters >= initialData.maxStarters) {
        setErr(`Puoi schierare al massimo ${initialData.maxStarters} titolari.`);
        return current;
      }

      const next = { ...current };
      next[source.id] = {
        playerId: source.id,
        status: "STARTER",
        positionX: slot.x,
        positionY: slot.y,
        sortOrder: targetEntry?.sortOrder ?? sourceEntry?.sortOrder ?? slotIndex,
      };

      if (targetPlayerId && targetEntry) {
        if (sourceEntry?.status === "STARTER") {
          next[targetPlayerId] = {
            ...targetEntry,
            playerId: targetPlayerId,
            positionX: sourceEntry.positionX,
            positionY: sourceEntry.positionY,
            sortOrder: sourceEntry.sortOrder,
          };
        } else if (sourceEntry?.status === "BENCH") {
          next[targetPlayerId] = {
            playerId: targetPlayerId,
            status: "BENCH",
            positionX: null,
            positionY: null,
            sortOrder: sourceEntry.sortOrder,
          };
        } else {
          delete next[targetPlayerId];
        }
      }

      return next;
    });

    setErr(null);
    setSelectedPlayerId(source.id);
  }

  function dropOnBench(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOverSlot(null);
    const player = draggedPlayer(event);
    if (!player) return;
    setStatus(player, "BENCH");
  }

  function roleForEntry(entry: Entry): CoachSlotRole {
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
                Scegli un modulo: i giocatori restano agganciati agli otto slot.
                Trascina una maglia sopra un'altra per scambiarle oppure trascina
                un giocatore dalla rosa o dalla panchina direttamente nello slot desiderato.
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
                  {option}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {err && <Badge variant="error">{err}</Badge>}
        {msg && <Badge variant="success">{msg}</Badge>}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.48fr)_minmax(360px,.52fr)]">
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
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--muted)]">
                  Divisa {initialData.match.isHome ? "casa" : "trasferta"}
                </span>
                {!outfieldKitUrl && (
                  <span className="text-[10px] font-bold text-amber-300">
                    Nessuna immagine divisa salvata: uso i colori squadra
                  </span>
                )}
              </div>

              <div
                className="relative mx-auto aspect-[4/5] w-full max-w-[900px] overflow-hidden rounded-[18px] border border-[#d7efb8]/70 bg-[#79b94d] shadow-[0_18px_55px_rgba(0,0,0,.28)] sm:aspect-[7/5] sm:rounded-[22px]"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, rgba(20,74,24,.10), transparent 14%, transparent 86%, rgba(20,74,24,.10)), repeating-linear-gradient(180deg, rgba(255,255,255,.075) 0 12.5%, rgba(20,92,31,.055) 12.5% 25%)",
                  boxShadow:
                    "inset 0 0 0 1px rgba(255,255,255,.12), inset 0 0 65px rgba(25,77,30,.18), 0 18px 55px rgba(0,0,0,.28)",
                }}
              >
                <div className="pointer-events-none absolute inset-[3.2%] rounded-[10px] border border-white/75 sm:rounded-[14px]" />
                <div className="pointer-events-none absolute left-[3.2%] right-[3.2%] top-1/2 h-px -translate-y-1/2 bg-white/65" />
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/75 sm:h-24 sm:w-24 lg:h-28 lg:w-28" />
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/75" />

                <div className="pointer-events-none absolute inset-x-[24%] top-[3.2%] h-[18%] border border-white/75" />
                <div className="pointer-events-none absolute inset-x-[35%] top-[3.2%] h-[8%] border border-white/70" />
                <div className="pointer-events-none absolute left-1/2 top-[18.7%] h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/75" />

                <div className="pointer-events-none absolute inset-x-[24%] bottom-[3.2%] h-[18%] border border-white/75" />
                <div className="pointer-events-none absolute inset-x-[35%] bottom-[3.2%] h-[8%] border border-white/70" />
                <div className="pointer-events-none absolute bottom-[18.7%] left-1/2 h-1.5 w-1.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-white/75" />

                <div className="pointer-events-none absolute left-1/2 top-[3.2%] h-[2.4%] w-[18%] -translate-x-1/2 -translate-y-full border-x border-t border-white/55" />
                <div className="pointer-events-none absolute bottom-[3.2%] left-1/2 h-[2.4%] w-[18%] -translate-x-1/2 translate-y-full border-x border-b border-white/55" />

                {COACH_FORMATIONS[formation].map((slot, index) => {
                  const playerId = playerIdAtSlot(entries, slot);
                  const player = playerId ? playerById.get(playerId) ?? null : null;
                  const entry = player ? entries[player.id] : null;
                  const selected = Boolean(player && selectedPlayerId === player.id);
                  const outOfRole = Boolean(player && playerOutOfRole(player));
                  const isDropTarget = dragOverSlot === index;

                  return (
                    <div
                      key={`${slot.role}-${index}`}
                      onDragOver={(event) => {
                        if (!initialData.editable) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        setDragOverSlot(index);
                      }}
                      onDrop={(event) => dropOnSlot(event, slot, index)}
                      className={[
                        "absolute z-10 flex h-[86px] w-[74px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl transition sm:h-[112px] sm:w-[104px] lg:h-[124px] lg:w-[118px]",
                        isDropTarget ? "bg-white/10 ring-2 ring-white/60" : "",
                      ].join(" ")}
                      style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                    >
                      {player && entry ? (
                        <button
                          type="button"
                          draggable={initialData.editable && player.eligible}
                          onDragStart={(event) => beginRosterDrag(event, player)}
                          onDragEnd={() => setDragOverSlot(null)}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedPlayerId(player.id);
                          }}
                          className={[
                            "group w-[72px] select-none text-center text-white transition sm:w-[102px] lg:w-[116px]",
                            initialData.editable && player.eligible
                              ? "cursor-grab active:cursor-grabbing"
                              : "",
                            selected ? "scale-[1.04]" : "hover:scale-[1.03]",
                          ].join(" ")}
                        >
                          <div
                            className={[
                              "mx-auto w-fit rounded-2xl transition",
                              selected ? "ring-2 ring-[var(--accent)]/80 ring-offset-2 ring-offset-transparent" : "",
                              outOfRole ? "drop-shadow-[0_0_7px_rgba(252,211,77,.7)]" : "",
                            ].join(" ")}
                          >
                            <TeamKit
                              url={
                                slot.role === "GK"
                                  ? initialData.team.kitGoalkeeperUrl ?? outfieldKitUrl
                                  : outfieldKitUrl
                              }
                              number={player.number}
                              primary={primary}
                              secondary={secondary}
                              goalkeeper={slot.role === "GK"}
                            />
                          </div>
                          <span className="mx-auto -mt-1 flex max-w-[72px] items-center justify-center gap-1 truncate rounded bg-[#173b18]/80 px-1.5 py-1 text-[9px] font-black leading-none shadow sm:max-w-[102px] sm:px-2 sm:text-[11px] lg:max-w-[116px]">
                            <span className="shrink-0 text-white/80">#{player.number}</span>
                            <span className="truncate">{player.lastName}</span>
                          </span>
                          <span
                            className={[
                              "mt-1 block text-[8px] font-black uppercase tracking-[0.08em]",
                              outOfRole ? "text-amber-200" : "text-white/65",
                            ].join(" ")}
                          >
                            {ROLE_LABEL[slot.role]}{outOfRole ? " · fuori ruolo" : ""}
                          </span>
                        </button>
                      ) : (
                        <div
                          className={[
                            "grid h-11 w-11 place-items-center rounded-full border border-dashed text-[9px] font-black transition sm:h-12 sm:w-12",
                            isDropTarget
                              ? "border-white bg-white/15 text-white"
                              : "border-white/40 bg-black/10 text-white/55",
                          ].join(" ")}
                        >
                          {ROLE_LABEL[slot.role]}
                        </div>
                      )}
                    </div>
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
              <div className="mt-3 min-h-28 rounded-2xl border border-dashed border-[var(--border)] bg-black/10 p-3 sm:min-h-32">
                {bench.length ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {bench.map((player) => (
                      <button
                        key={player.id}
                        type="button"
                        draggable={initialData.editable && player.eligible}
                        onDragStart={(event) => beginRosterDrag(event, player)}
                        onDragEnd={() => setDragOverSlot(null)}
                        onClick={() => setSelectedPlayerId(player.id)}
                        className={[
                          "group min-w-0 overflow-hidden rounded-xl border bg-[#080b09] text-left transition hover:-translate-y-0.5",
                          selectedPlayerId === player.id
                            ? "border-[var(--accent)] shadow-[0_0_0_1px_var(--accent)]"
                            : "border-white/10 hover:border-white/25",
                        ].join(" ")}
                      >
                        <span className="block bg-[linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,0))] px-2 pt-2">
                          <BenchPlayerPhoto player={player} />
                        </span>
                        <span className="block border-t border-white/10 bg-black/35 px-2.5 py-2">
                          <span className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-[0.08em] sm:text-[11px]">
                            <span className="text-emerald-400">{primaryRoleLabel(player.position)}</span>
                            <span className="text-white/55">#{player.number}</span>
                          </span>
                          <span className="mt-1 block truncate text-center text-xs font-black text-white sm:text-sm">
                            {player.lastName}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="block px-2 py-8 text-center text-xs text-[var(--muted)]">
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
                  Trascina un giocatore direttamente sullo slot desiderato; sopra un titolare lo sostituisce o lo scambia.
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
                    onDragEnd={() => setDragOverSlot(null)}
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
              I giocatori sono sempre agganciati agli slot del modulo selezionato.
              Il drag & drop può anche creare scelte fuori ruolo, segnalate in giallo,
              senza spostare liberamente le maglie fuori dalla struttura del modulo.
              La formazione resta una proposta tecnica e non sostituisce la distinta ufficiale.
            </p>
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
