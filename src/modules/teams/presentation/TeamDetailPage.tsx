"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Trash2, Plus, ArrowLeft, X, Search, Crown } from "lucide-react";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card from "src/app/_components/ui/card";
import Button from "src/app/_components/ui/button";
import Badge from "src/app/_components/ui/badge";
import Input from "src/app/_components/ui/input";
import Select from "src/app/_components/ui/select";
import OptimizedPlayerImage from "src/app/_components/optimized-player-image";
import { useAuth, useCanEditTeam, authFetch } from "@/lib/client-auth";
import { FUTPOLI_RULES } from "@/lib/tournament-rules";

type Player = {
  id: string;
  firstName: string;
  lastName: string;
  number: number;
  position?: string | null;
  photoUrl?: string | null;
  photoZoom?: number;
  photoPositionX?: number;
  photoPositionY?: number;
  isTeamCaptain?: boolean;
  goals?: number;
  assists?: number;
  appearances?: number;
  feeCents?: number;
  status?: string;
  documentSigned?: boolean;
  mediaConsent?: boolean;
  registrationStatus?: string;
  isEligibleForMatchSheet?: boolean;
  adminMissingItems?: string[];
};

type Team = {
  id: string;
  name: string;
  badgeUrl?: string | null;
  description?: string | null;
  colorHex?: string | null;
  secondaryColorHex?: string | null;
  league: { id: string; name: string };
  players: Player[];
};

const POSITIONS = ["Portiere", "Difensore", "Centrocampista", "Attaccante"];
const MAX_PLAYERS_PER_TEAM = FUTPOLI_RULES.maxPlayersPerTeam;

const ROLE_ORDER = ["Portiere", "Difensore", "Centrocampista", "Attaccante"];

function formatEuro(cents: number) {
  return (cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function isAdminOk(player: Player) {
  return player.isEligibleForMatchSheet === true || Boolean(player.status === "AUTHORIZED" && player.documentSigned && player.mediaConsent);
}

function playerStatusLabel(player: Player) {
  if (isAdminOk(player)) return "Iscrizione OK";
  if (player.status === "SUSPENDED") return "Squalificato";
  if (player.status === "BLOCKED") return "Bloccato";
  if (player.status === "IN_REVIEW") return "In verifica";
  if (player.status === "RETIRED") return "Ritirato";
  return player.registrationStatus ?? "Da completare";
}

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

export default function TeamPage({
  leagueId,
  teamId,
  initialTeam,
}: {
  leagueId: string;
  teamId: string;
  initialTeam: Team;
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || (user?.role === "LEAGUE_ADMIN" && user.leagueId === leagueId);
  const canEdit = useCanEditTeam(teamId, leagueId);

  const [team, setTeam] = useState<Team>(initialTeam);
  const [name, setName] = useState(initialTeam.name ?? "");
  const [badgeUrl, setBadgeUrl] = useState(initialTeam.badgeUrl ?? "");
  const [description, setDescription] = useState(initialTeam.description ?? "");
  const [colorHex, setColorHex] = useState(initialTeam.colorHex ?? "#F97316");
  const [secondaryColorHex, setSecondaryColorHex] = useState(
    initialTeam.secondaryColorHex ?? initialTeam.colorHex ?? "#F97316"
  );
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

    const res = await authFetch(`/api/teams/${teamId}`, {
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.error ?? "Errore");
    }

    setTeam(data);
    setName(data.name ?? "");
    setBadgeUrl(data.badgeUrl ?? "");
    setDescription(data.description ?? "");
    setColorHex(data.colorHex ?? "#F97316");
    setSecondaryColorHex(data.secondaryColorHex ?? data.colorHex ?? "#F97316");
    setBadgeFile(null);
    setRemoveBadge(false);
  }

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
          description: description.trim() || null,
          colorHex,
          secondaryColorHex,
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

  const eagerPlayerIds = useMemo(
    () => new Set(allPlayers.slice(0, 4).map((player) => player.id)),
    [allPlayers]
  );

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

          <div className="grid gap-5 xl:grid-cols-[180px_minmax(0,1fr)_180px] xl:items-center 2xl:grid-cols-[220px_minmax(0,1fr)_180px]">
            <TeamLogo name={team.name} badgeUrl={team.badgeUrl ?? null} />

            <div className="min-w-0 flex-1">
              <h1 className="[overflow-wrap:anywhere] text-4xl font-black leading-[0.95] tracking-[-0.07em] text-[var(--foreground)] lg:text-5xl">
                {team.name}
              </h1>
              {team.colorHex && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--muted)]">
                  <span
                    className="h-3 w-10 rounded-full border border-[var(--border)]"
                    style={{
                      background: `linear-gradient(90deg, ${team.colorHex} 0 50%, ${team.secondaryColorHex ?? team.colorHex} 50% 100%)`,
                    }}
                  />
                  <span>{team.colorHex}</span>
                  <span aria-hidden="true">+</span>
                  <span>{team.secondaryColorHex ?? team.colorHex}</span>
                </div>
              )}
              {team.description && (
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
                  {team.description}
                </p>
              )}
            </div>

            <div className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-5 text-right shadow-[0_1px_3px_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.04)]">
              <div className="text-4xl font-black tracking-[-0.06em] text-[var(--foreground)]">
                {team.players.length}
              </div>
              <div className="text-sm text-[var(--muted)]">giocatori / {MAX_PLAYERS_PER_TEAM}</div>
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
                    : "border-[var(--border-strong)] bg-[var(--card-2)] text-[var(--foreground)]",
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
                disabled={team.players.length >= MAX_PLAYERS_PER_TEAM}
                className={[
                  "flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition disabled:opacity-40",
                  showAddPlayer
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--border-strong)] bg-[var(--card-2)] text-[var(--foreground)]",
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
                  className="h-28 w-28 shrink-0 rounded-xl border border-[var(--border)] object-contain"
                />
              ) : (
                <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[#eef0ec] text-xs text-[var(--muted)]">
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
                  className="block w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--accent)] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white"
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
                    className="text-xs font-semibold text-amber-300"
                  >
                    Rimuovi logo
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                Colori maglia
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-3">
                  <span className="text-xs font-bold text-[var(--muted)]">Colore 1</span>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={/^#[0-9A-F]{6}$/.test(colorHex) ? colorHex : "#F97316"}
                      onChange={(event) => setColorHex(event.target.value.toUpperCase())}
                      className="h-11 w-14 cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--card)] p-1"
                      aria-label="Primo colore maglia"
                    />
                    <Input
                      value={colorHex}
                      onChange={(event) => {
                        const value = event.target.value.toUpperCase();
                        if (/^#[0-9A-F]{0,6}$/.test(value)) setColorHex(value);
                      }}
                      placeholder="#F97316"
                      className="min-w-0 flex-1 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-3">
                  <span className="text-xs font-bold text-[var(--muted)]">Colore 2</span>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={/^#[0-9A-F]{6}$/.test(secondaryColorHex) ? secondaryColorHex : "#F97316"}
                      onChange={(event) => setSecondaryColorHex(event.target.value.toUpperCase())}
                      className="h-11 w-14 cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--card)] p-1"
                      aria-label="Secondo colore maglia"
                    />
                    <Input
                      value={secondaryColorHex}
                      onChange={(event) => {
                        const value = event.target.value.toUpperCase();
                        if (/^#[0-9A-F]{0,6}$/.test(value)) setSecondaryColorHex(value);
                      }}
                      placeholder="#FFFFFF"
                      className="min-w-0 flex-1 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div
                className="h-10 w-full rounded-xl border border-[var(--border)]"
                style={{
                  background:
                    /^#[0-9A-F]{6}$/.test(colorHex) && /^#[0-9A-F]{6}$/.test(secondaryColorHex)
                      ? `linear-gradient(90deg, ${colorHex} 0 50%, ${secondaryColorHex} 50% 100%)`
                      : "transparent",
                }}
                aria-label="Anteprima colori maglia"
              />

              <p className="text-xs text-[var(--muted)]">
                I due colori vengono mostrati insieme nel Match Center e restano modificabili dall'app.
              </p>
            </div>

            <div className="space-y-3">
              <textarea
                aria-label="Descrizione squadra"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Racconta identità, stile o motto della squadra"
                rows={4}
                className="min-h-28 w-full resize-none rounded-2xl border border-[var(--border)] bg-white/[0.04] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:bg-white/[0.07]"
              />

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={saveTeam} disabled={savingTeam}>
                  {savingTeam ? "Salvataggio…" : "Salva"}
                </Button>

                <Button variant="secondary" onClick={() => setEditingTeam(false)}>
                  Annulla
                </Button>
              </div>
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
            className="h-11 w-full rounded-[14px] border border-[var(--border)] bg-[var(--card)] pl-11 pr-4 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)] shadow-[0_1px_3px_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.04)]"
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
                      isAdmin={isAdmin}
                      eagerPhoto={eagerPlayerIds.has(player.id)}
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
  isAdmin,
  eagerPhoto = false,
  onDelete,
}: {
  leagueId: string;
  player: Player;
  role: string;
  canEdit: boolean;
  isAdmin: boolean;
  eagerPhoto?: boolean;
  onDelete: () => void;
}) {
  const shortRole = SHORT_ROLE[role] ?? "—";
  const fullName = `${player.firstName} ${player.lastName}`;

  return (
    <div className={[
      "grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--border)] px-4 py-4 last:border-b-0 sm:grid-cols-[104px_minmax(0,1fr)_auto]",
      isAdminOk(player) ? "" : "bg-amber-400/5",
    ].join(" ")}>
      <PlayerPhoto
        name={fullName}
        photoUrl={player.photoUrl ?? null}
        photoZoom={player.photoZoom ?? 1}
        photoPositionX={player.photoPositionX ?? 50}
        photoPositionY={player.photoPositionY ?? 50}
        eager={eagerPhoto}
      />

      <Link
        href={`/leagues/${leagueId}/players/${player.id}`}
        className="min-w-0"
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="break-words text-[16px] font-semibold text-[var(--foreground)]">
            {fullName}
          </div>
          {player.isTeamCaptain && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-amber-300">
              <Crown size={11} /> Capitano
            </span>
          )}
        </div>

        <div className="mt-1 flex items-center gap-2 text-sm text-[var(--muted)]">
          <span>#{player.number}</span>
          <span>·</span>
          <span>{shortRole}</span>
          <span>·</span>
          <span>{playerStatusLabel(player)}</span>
        </div>
        <div className="mt-1 text-xs text-[var(--muted)]">
          {player.appearances ?? 0} presenze
          {isAdmin && <> · {formatEuro(player.feeCents ?? 0)} quota</>}
        </div>
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
            className="grid h-9 w-9 place-items-center rounded-lg text-[var(--muted)] active:bg-red-50 active:text-amber-300"
            aria-label={`Elimina ${fullName}`}
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
        className="h-36 w-36 shrink-0 rounded-[34px] object-contain xl:h-44 xl:w-44"
      />
    );
  }

  return (
    <span className="flex h-36 w-36 shrink-0 items-center justify-center rounded-[34px] bg-green-200 text-4xl font-black text-green-900 xl:h-44 xl:w-44">
      {initials}
    </span>
  );
}

function PlayerPhoto({
  name,
  photoUrl,
  photoZoom = 1,
  photoPositionX = 50,
  photoPositionY = 50,
  eager = false,
}: {
  name: string;
  photoUrl?: string | null;
  photoZoom?: number;
  photoPositionX?: number;
  photoPositionY?: number;
  eager?: boolean;
}) {
  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (photoUrl) {
    return (
      <div className="relative h-[95px] w-[76px] shrink-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background)] sm:h-[115px] sm:w-[92px]">
        <OptimizedPlayerImage
          src={photoUrl}
          alt={`Foto ${name}`}
          sizes="(max-width: 640px) 76px, 92px"
          eager={eager}
          className="absolute inset-0 h-full w-full object-contain"
          style={{
            objectPosition: `${photoPositionX}% ${photoPositionY}%`,
            transform: `scale(${photoZoom})`,
            transformOrigin: `${photoPositionX}% ${photoPositionY}%`,
          }}
        />
      </div>
    );
  }

  return (
    <div className="relative flex h-[95px] w-[76px] shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--background)] text-lg font-black text-[var(--accent)] sm:h-[115px] sm:w-[92px]">
      {initials}
    </div>
  );
}
