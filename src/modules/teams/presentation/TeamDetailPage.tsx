"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Plus, X, Search } from "lucide-react";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card from "src/app/_components/ui/card";
import Badge from "src/app/_components/ui/badge";
import { useAuth, useCanEditTeam, authFetch } from "@/lib/client-auth";
import {
  MAX_PLAYERS_PER_TEAM,
  ROLE_ORDER,
  PlayerRow,
  TeamLogo,
  type Player,
  type Team,
} from "./TeamDetailParts";
import { AddPlayerPanel, TeamEditPanel } from "./TeamManagementPanels";

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

        <TeamEditPanel
          visible={canEdit && editingTeam}
          name={name}
          setName={setName}
          badgePreview={badgePreview}
          setBadgeFile={setBadgeFile}
          setBadgeUrl={setBadgeUrl}
          setRemoveBadge={setRemoveBadge}
          colorHex={colorHex}
          setColorHex={setColorHex}
          secondaryColorHex={secondaryColorHex}
          setSecondaryColorHex={setSecondaryColorHex}
          description={description}
          setDescription={setDescription}
          saveTeam={saveTeam}
          savingTeam={savingTeam}
          close={() => setEditingTeam(false)}
        />

        <AddPlayerPanel
          visible={canEdit && showAddPlayer}
          firstName={newFirstName}
          setFirstName={setNewFirstName}
          lastName={newLastName}
          setLastName={setNewLastName}
          number={newNumber}
          setNumber={setNewNumber}
          position={newPosition}
          setPosition={setNewPosition}
          photoUrl={newPhotoUrl}
          setPhotoUrl={setNewPhotoUrl}
          addPlayer={addPlayer}
          close={() => setShowAddPlayer(false)}
        />

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
