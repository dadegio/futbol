"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Pencil, Trash2, Plus, ArrowLeft, X, Search } from "lucide-react";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card from "src/app/_components/ui/card";
import Button from "src/app/_components/ui/button";
import Badge from "src/app/_components/ui/badge";
import Input from "src/app/_components/ui/input";
import Select from "src/app/_components/ui/select";
import { useCanEditTeam, authFetch } from "@/lib/client-auth";

type Player = {
  id: string;
  firstName: string;
  lastName: string;
  number: number;
  position?: string | null;
  photoUrl?: string | null;
  goals?: number;
  assists?: number;
};

type Team = {
  id: string;
  name: string;
  badgeUrl?: string | null;
  league: { id: string; name: string };
  players: Player[];
};

const POSITIONS = ["Portiere", "Difensore", "Centrocampista", "Attaccante"];
const ROLE_ORDER = ["Portiere", "Difensore", "Centrocampista", "Attaccante"];

const SHORT_ROLE: Record<string, string> = {
  Portiere: "POR",
  Difensore: "DIF",
  Centrocampista: "CEN",
  Attaccante: "ATT",
};

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await authFetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error ?? "Errore upload immagine");
  }

  return data.url as string;
}

export default function TeamPage() {
  const { leagueId, teamId } = useParams<{
    leagueId: string;
    teamId: string;
  }>();

  const canEdit = useCanEditTeam(teamId);

  const [team, setTeam] = useState<Team | null>(null);
  const [name, setName] = useState("");
  const [badgeUrl, setBadgeUrl] = useState("");
  const [badgeFile, setBadgeFile] = useState<File | null>(null);
  const [removeBadge, setRemoveBadge] = useState(false);
  const [editingTeam, setEditingTeam] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [newPosition, setNewPosition] = useState("");
  const [newPhotoUrl, setNewPhotoUrl] = useState("");

  async function load() {
    setErr(null);

    const res = await fetch(`/api/teams/${teamId}`, {
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.error ?? "Errore");
    }

    setTeam(data);
    setName(data.name ?? "");
    setBadgeUrl(data.badgeUrl ?? "");
    setBadgeFile(null);
    setRemoveBadge(false);
  }

  useEffect(() => {
    if (!teamId) return;

    load().catch((error) => {
      setErr(error.message);
    });
  }, [teamId]);

  const badgePreview = useMemo(() => {
    if (removeBadge) return "";
    if (badgeFile) return URL.createObjectURL(badgeFile);
    return badgeUrl || "";
  }, [badgeFile, badgeUrl, removeBadge]);

  async function saveTeam() {
    setErr(null);
    setMsg(null);

    const trimmedName = name.trim();

    if (!trimmedName) {
      setErr("Inserisci il nome squadra");
      return;
    }

    try {
      setSavingTeam(true);

      let finalBadgeUrl: string | null = removeBadge
        ? null
        : badgeUrl.trim() || null;

      if (badgeFile) {
        if (!badgeFile.type.startsWith("image/")) {
          throw new Error("Seleziona un'immagine valida");
        }

        if (badgeFile.size > 5 * 1024 * 1024) {
          throw new Error("Il logo deve essere massimo 5 MB");
        }

        finalBadgeUrl = await uploadImage(badgeFile);
      }

      const res = await authFetch(`/api/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          badgeUrl: finalBadgeUrl,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error ?? "Errore");
      }

      setMsg("Squadra aggiornata");
      setEditingTeam(false);
      await load();
    } catch (error: any) {
      setErr(error.message ?? "Errore");
    } finally {
      setSavingTeam(false);
    }
  }

  async function addPlayer() {
    setErr(null);
    setMsg(null);

    const n = Number(newNumber);

    if (!newFirstName.trim() || !newLastName.trim()) {
      setErr("Inserisci nome e cognome");
      return;
    }

    if (!Number.isInteger(n) || n <= 0) {
      setErr("Numero non valido");
      return;
    }

    const res = await authFetch(`/api/teams/${teamId}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: newFirstName.trim(),
        lastName: newLastName.trim(),
        number: n,
        position: newPosition || null,
        photoUrl: newPhotoUrl.trim() ? newPhotoUrl.trim() : null,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setErr(data?.error ?? "Errore aggiunta giocatore");
      return;
    }

    setNewFirstName("");
    setNewLastName("");
    setNewNumber("");
    setNewPosition("");
    setNewPhotoUrl("");
    setMsg("Giocatore aggiunto");
    setShowAddPlayer(false);
    await load();
  }

  async function deletePlayer(playerId: string, label: string) {
    setErr(null);
    setMsg(null);

    if (!window.confirm(`Eliminare "${label}"?`)) return;

    const res = await authFetch(`/api/players/${playerId}`, {
      method: "DELETE",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setErr(data?.error ?? "Errore eliminazione giocatore");
      return;
    }

    setMsg("Giocatore eliminato");
    await load();
  }

  const allPlayers = useMemo(() => {
    if (!team) return [];

    const q = query.trim().toLowerCase();

    return [...team.players]
      .filter((player) => {
        if (!q) return true;

        const fullName = `${player.firstName} ${player.lastName}`.toLowerCase();
        const number = String(player.number);

        return fullName.includes(q) || number.includes(q);
      })
      .sort((a, b) => a.number - b.number);
  }, [team, query]);

  const groupedPlayers = useMemo(() => {
    const unknownPlayers = allPlayers.filter(
      (player) => !player.position || !ROLE_ORDER.includes(player.position)
    );

    return [
      ...ROLE_ORDER.map((role) => ({
        role,
        players: allPlayers.filter((player) => player.position === role),
      })).filter((group) => group.players.length > 0),
      ...(unknownPlayers.length > 0
        ? [{ role: "Ruolo non impostato", players: unknownPlayers }]
        : []),
    ];
  }, [allPlayers]);

  if (!team) {
    return (
      <DashboardShell leagueId={leagueId}>
        <div className="text-sm text-[var(--muted)]">Caricamento…</div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="w-full space-y-5 pb-8">
        <header className="pt-2">
          <Link
            href={`/leagues/${leagueId}/teams`}
            className="mb-7 flex items-center gap-3 text-sm text-[var(--muted)]"
          >
            <span className="text-xl leading-none">‹</span>
            <span>{team.name}</span>
          </Link>

          <div className="flex items-center gap-4">
            <TeamLogo name={team.name} badgeUrl={team.badgeUrl ?? null} />

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[27px] font-black tracking-[-0.06em] text-[var(--foreground)]">
                {team.name}
              </h1>
            </div>

            <div className="text-right">
              <div className="text-2xl font-black tracking-[-0.06em] text-[var(--foreground)]">
                {team.players.length}
              </div>
              <div className="text-sm text-[var(--muted)]">giocatori</div>
            </div>
          </div>

          {canEdit && (
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingTeam((value) => !value);
                  setShowAddPlayer(false);
                }}
                className={[
                  "flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition",
                  editingTeam
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--border)] bg-white text-[var(--foreground)]",
                ].join(" ")}
              >
                {editingTeam ? <X size={16} /> : <Pencil size={16} />}
                {editingTeam ? "Chiudi" : "Modifica"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowAddPlayer((value) => !value);
                  setEditingTeam(false);
                }}
                disabled={team.players.length >= 16}
                className={[
                  "flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition disabled:opacity-40",
                  showAddPlayer
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--border)] bg-white text-[var(--foreground)]",
                ].join(" ")}
              >
                {showAddPlayer ? <X size={16} /> : <Plus size={16} />}
                {showAddPlayer ? "Chiudi" : "Aggiungi"}
              </button>
            </div>
          )}
        </header>

        {msg && <Badge variant="success">{msg}</Badge>}
        {err && <Badge variant="error">{err}</Badge>}

        {canEdit && editingTeam && (
          <Card className="space-y-4">
            <div>
              <h2 className="text-lg font-black tracking-[-0.04em] text-[var(--foreground)]">
                Modifica squadra
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Aggiorna nome e logo della squadra.
              </p>
            </div>

            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nome squadra"
              className="w-full"
            />

            <div className="flex items-start gap-4">
              {badgePreview ? (
                <img
                  src={badgePreview}
                  alt="Preview logo"
                  className="h-16 w-16 shrink-0 rounded-xl border border-[var(--border)] object-contain"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[#eef0ec] text-xs text-[var(--muted)]">
                  Logo
                </div>
              )}

              <div className="min-w-0 flex-1 space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setBadgeFile(file);
                    if (file) setRemoveBadge(false);
                  }}
                  className="block w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--accent)] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white"
                />

                <p className="text-xs text-[var(--muted)]">Max 5 MB.</p>

                {badgePreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setBadgeFile(null);
                      setBadgeUrl("");
                      setRemoveBadge(true);
                    }}
                    className="text-xs font-semibold text-red-600"
                  >
                    Rimuovi logo
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={saveTeam} disabled={savingTeam}>
                {savingTeam ? "Salvataggio…" : "Salva"}
              </Button>

              <Button variant="secondary" onClick={() => setEditingTeam(false)}>
                Annulla
              </Button>
            </div>
          </Card>
        )}

        {canEdit && showAddPlayer && (
          <Card className="space-y-4">
            <div>
              <h2 className="text-lg font-black tracking-[-0.04em] text-[var(--foreground)]">
                Nuovo giocatore
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Aggiungi un giocatore alla rosa.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                aria-label="Nome"
                value={newFirstName}
                onChange={(event) => setNewFirstName(event.target.value)}
                placeholder="Nome"
              />

              <Input
                aria-label="Cognome"
                value={newLastName}
                onChange={(event) => setNewLastName(event.target.value)}
                placeholder="Cognome"
              />

              <Input
                aria-label="Numero maglia"
                value={newNumber}
                onChange={(event) =>
                  setNewNumber(event.target.value.replace(/[^\d]/g, ""))
                }
                placeholder="Numero"
                inputMode="numeric"
              />

              <Select
                aria-label="Ruolo"
                value={newPosition}
                onChange={(event) => setNewPosition(event.target.value)}
              >
                <option value="" className="text-black">
                  Ruolo
                </option>
                {POSITIONS.map((position) => (
                  <option key={position} value={position} className="text-black">
                    {position}
                  </option>
                ))}
              </Select>
            </div>

            <Input
              aria-label="URL foto giocatore"
              value={newPhotoUrl}
              onChange={(event) => setNewPhotoUrl(event.target.value)}
              placeholder="URL foto opzionale"
            />

            <div className="flex gap-2">
              <Button onClick={addPlayer}>Aggiungi</Button>
              <Button variant="secondary" onClick={() => setShowAddPlayer(false)}>
                Annulla
              </Button>
            </div>
          </Card>
        )}

        <div className="relative">
          <Search
            size={17}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
          />

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cerca giocatore..."
            className="h-12 w-full rounded-[16px] border border-[var(--border)] bg-white pl-11 pr-4 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
          />
        </div>

        {team.players.length === 0 ? (
          <Card>
            <p className="font-medium text-[var(--foreground)]">
              Nessun giocatore.
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Aggiungi il primo giocatore alla rosa.
            </p>
          </Card>
        ) : groupedPlayers.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--muted)]">
              Nessun giocatore trovato.
            </p>
          </Card>
        ) : (
          <div className="space-y-5">
            {groupedPlayers.map(({ role, players }) => (
              <section key={role}>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-base font-medium text-[var(--foreground)]">
                    {role}
                  </h2>

                  <span className="text-sm font-medium text-[var(--muted)]">
                    {players.length}
                  </span>
                </div>

                <Card className="overflow-hidden !p-0">
                  {players.map((player) => (
                    <PlayerRow
                      key={player.id}
                      leagueId={leagueId}
                      player={player}
                      role={role}
                      canEdit={canEdit}
                      onDelete={() =>
                        deletePlayer(
                          player.id,
                          `${player.firstName} ${player.lastName}`
                        )
                      }
                    />
                  ))}
                </Card>
              </section>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function PlayerRow({
  leagueId,
  player,
  role,
  canEdit,
  onDelete,
}: {
  leagueId: string;
  player: Player;
  role: string;
  canEdit: boolean;
  onDelete: () => void;
}) {
  const shortRole = SHORT_ROLE[role] ?? "—";

  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--border)] px-4 py-4 last:border-b-0">
      <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#efede7] font-mono text-sm font-black text-[var(--muted)]">
        {player.number}
      </div>

      <Link
        href={`/leagues/${leagueId}/players/${player.id}`}
        className="min-w-0"
      >
        <div className="truncate text-[16px] font-semibold text-[var(--foreground)]">
          {player.firstName} {player.lastName}
        </div>

        <div className="mt-0.5 text-sm text-[var(--muted)]">{shortRole}</div>
      </Link>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="font-mono text-base font-black text-[var(--foreground)]">
            {player.goals ?? 0}
          </div>
          <div className="text-xs text-[var(--muted)]">
            {player.assists ?? 0}a
          </div>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={onDelete}
            className="grid h-9 w-9 place-items-center rounded-lg text-[var(--muted)] active:bg-red-50 active:text-red-600"
            aria-label={`Elimina ${player.firstName} ${player.lastName}`}
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

function TeamLogo({
  name,
  badgeUrl,
}: {
  name: string;
  badgeUrl: string | null;
}) {
  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (badgeUrl) {
    return (
      <img
        src={badgeUrl}
        alt={`Logo ${name}`}
        className="h-14 w-14 shrink-0 rounded-[15px] object-contain"
      />
    );
  }

  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[15px] bg-green-200 text-lg font-black text-green-900">
      {initials}
    </span>
  );
}