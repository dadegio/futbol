"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import DashboardShell from "src/app/_components/dashboard-shell";
import { useCanEditTeam, authFetch } from "@/lib/client-auth";

type Player = {
  id: string;
  firstName: string;
  lastName: string;
  number: number;
  position?: string | null;
  photoUrl?: string | null;
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

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await authFetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Errore upload immagine");

  return data.url as string;
}

export default function TeamPage() {
  const { leagueId, teamId } = useParams<{ leagueId: string; teamId: string }>();
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

  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [newPosition, setNewPosition] = useState("");
  const [newPhotoUrl, setNewPhotoUrl] = useState("");

  async function load() {
    setErr(null);

    const res = await fetch(`/api/teams/${teamId}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) throw new Error(data?.error ?? "Errore");

    setTeam(data);
    setName(data.name ?? "");
    setBadgeUrl(data.badgeUrl ?? "");
    setBadgeFile(null);
    setRemoveBadge(false);
  }

  useEffect(() => {
    if (!teamId) return;
    load().catch((e) => setErr(e.message));
  }, [teamId]);

  const badgePreview = useMemo(() => {
    if (removeBadge) return "";
    if (badgeFile) return URL.createObjectURL(badgeFile);
    return badgeUrl || "";
  }, [badgeFile, badgeUrl, removeBadge]);

  useEffect(() => {
    return () => {
      if (badgeFile) {
        URL.revokeObjectURL(URL.createObjectURL(badgeFile));
      }
    };
  }, [badgeFile]);

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

      let finalBadgeUrl: string | null = removeBadge ? null : badgeUrl.trim() || null;

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
      if (!res.ok) throw new Error(data?.error ?? "Errore");

      setMsg("Squadra aggiornata ✅");
      setEditingTeam(false);
      await load();
    } catch (e: any) {
      setErr(e.message ?? "Errore");
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
    if (!res.ok) return setErr(data?.error ?? "Errore aggiunta giocatore");

    setNewFirstName("");
    setNewLastName("");
    setNewNumber("");
    setNewPosition("");
    setNewPhotoUrl("");
    setMsg("Giocatore aggiunto ✅");
    await load();
  }

  async function deletePlayer(playerId: string, label: string) {
    setErr(null);
    setMsg(null);

    const ok = window.confirm(`Eliminare il giocatore "${label}"?`);
    if (!ok) return;

    const res = await authFetch(`/api/players/${playerId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) return setErr(data?.error ?? "Errore eliminazione giocatore");

    setMsg("Giocatore eliminato ✅");
    await load();
  }

  if (!team) {
    return (
      <DashboardShell leagueId={leagueId}>
        <div className="text-white/70">Caricamento…</div>
      </DashboardShell>
    );
  }

  const groupedPlayers = ROLE_ORDER.map((role) => ({
    role,
    players: [...team.players]
      .filter((p) => p.position === role)
      .sort((a, b) => a.number - b.number),
  }));

  const unassignedPlayers = [...team.players]
    .filter((p) => !p.position || !ROLE_ORDER.includes(p.position))
    .sort((a, b) => a.number - b.number);

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="space-y-6">
        <section className="rounded-[28px] border border-white/8 bg-[#121214]/95 p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              {team.badgeUrl ? (
                <img
                  src={team.badgeUrl}
                  alt={team.name}
                  className="h-20 w-20 rounded-3xl border border-white/10 object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5 text-sm font-bold text-white/35">
                  NO LOGO
                </div>
              )}

              <div className="min-w-0">
                <div className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
                  Team
                </div>
                <h1 className="mt-2 break-words text-3xl font-black text-white">
                  {team.name}
                </h1>
                <p className="mt-2 text-sm text-white/60">
                  Gestisci informazioni squadra e rosa giocatori.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {canEdit && (
                <>
                  <button
                    onClick={() => setEditingTeam((v) => !v)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/10"
                  >
                    {editingTeam ? "Chiudi modifica" : "Modifica squadra"}
                  </button>

                  <button
                    onClick={() => setShowAddPlayer((v) => !v)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/10"
                  >
                    {showAddPlayer ? "Nascondi aggiunta giocatore" : "Aggiungi giocatore"}
                  </button>
                </>
              )}

              <Link
                href={`/leagues/${leagueId}/teams`}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/10"
              >
                Torna alla Lista squadre
              </Link>
            </div>
          </div>
        </section>

        {msg ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {msg}
          </div>
        ) : null}

        {err ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        ) : null}

        {canEdit && editingTeam ? (
          <section className="rounded-[28px] border border-white/8 bg-[#121214]/95 p-5 shadow-2xl shadow-black/20">
            <div className="mb-4 text-xl font-black text-white">Modifica squadra</div>

            <div className="grid gap-4">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome squadra"
                className="h-14 rounded-2xl border border-white/10 bg-white/5 px-4 text-white outline-none placeholder:text-white/35"
              />

              <div className="grid gap-4 lg:grid-cols-[120px_minmax(0,1fr)] lg:items-start">
                <div>
                  {badgePreview ? (
                    <img
                      src={badgePreview}
                      alt="Preview logo squadra"
                      className="h-24 w-24 rounded-3xl border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white/5 text-xs font-bold text-white/35">
                      NO LOGO
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setBadgeFile(file);
                      if (file) {
                        setRemoveBadge(false);
                      }
                    }}
                    className="block w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-[var(--accent)] file:px-4 file:py-2 file:font-semibold file:text-black"
                  />

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setBadgeFile(null);
                        setBadgeUrl("");
                        setRemoveBadge(true);
                      }}
                      className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-2 text-sm text-red-200"
                    >
                      Rimuovi logo
                    </button>
                  </div>

                  <p className="text-sm text-white/50">
                    Carica un’immagine dal dispositivo. Max 5 MB.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={saveTeam}
              disabled={savingTeam}
              className="mt-4 rounded-2xl bg-[var(--accent)] px-5 py-3 font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingTeam ? "Salvataggio..." : "Salva squadra"}
            </button>
          </section>
        ) : null}

        {canEdit && showAddPlayer ? (
          <section className="rounded-[28px] border border-white/8 bg-[#121214]/95 p-5 shadow-2xl shadow-black/20">
            <div className="mb-4 text-xl font-black text-white">Aggiungi giocatore</div>

            <div className="grid gap-3 lg:grid-cols-2">
              <input
                value={newFirstName}
                onChange={(e) => setNewFirstName(e.target.value)}
                placeholder="Nome"
                className="h-14 rounded-2xl border border-white/10 bg-white/5 px-4 text-white outline-none placeholder:text-white/35"
              />

              <input
                value={newLastName}
                onChange={(e) => setNewLastName(e.target.value)}
                placeholder="Cognome"
                className="h-14 rounded-2xl border border-white/10 bg-white/5 px-4 text-white outline-none placeholder:text-white/35"
              />

              <input
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="Numero"
                inputMode="numeric"
                className="h-14 rounded-2xl border border-white/10 bg-white/5 px-4 text-white outline-none placeholder:text-white/35"
              />

              <select
                value={newPosition}
                onChange={(e) => setNewPosition(e.target.value)}
                className="h-14 rounded-2xl border border-white/10 bg-white/5 px-4 text-white outline-none"
              >
                <option value="" className="text-black">
                  Ruolo
                </option>
                {POSITIONS.map((p) => (
                  <option key={p} value={p} className="text-black">
                    {p}
                  </option>
                ))}
              </select>

              <input
                value={newPhotoUrl}
                onChange={(e) => setNewPhotoUrl(e.target.value)}
                placeholder="Foto giocatore (URL) opzionale"
                className="h-14 rounded-2xl border border-white/10 bg-white/5 px-4 text-white outline-none placeholder:text-white/35 lg:col-span-2"
              />
            </div>

            <button
              onClick={addPlayer}
              disabled={team.players.length >= 16}
              className="mt-4 rounded-2xl bg-[var(--accent)] px-5 py-3 font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {team.players.length >= 16 ? "Rosa completa (16)" : "Aggiungi giocatore"}
            </button>
          </section>
        ) : null}

        <section className="rounded-[28px] border border-white/8 bg-[#121214]/95 p-5 shadow-2xl shadow-black/20">
          <div className="mb-5 text-xl font-black text-white">Rosa squadra</div>

          {team.players.length === 0 ? (
            <div className="rounded-2xl bg-white/[0.04] px-4 py-4 text-white/55">
              Nessun giocatore presente.
            </div>
          ) : (
            <div className="space-y-8">
              {groupedPlayers.map((group) => (
                <div key={group.role}>
                  <div className="mb-4 text-lg font-bold text-[var(--accent)]">
                    {group.role}
                  </div>

                  {group.players.length === 0 ? (
                    <div className="rounded-2xl bg-white/[0.04] px-4 py-4 text-white/45">
                      Nessun {group.role.toLowerCase()}.
                    </div>
                  ) : (
                    <div className="grid gap-4 xl:grid-cols-2">
                      {group.players.map((player) => (
                        <div
                          key={player.id}
                          className="rounded-[24px] border border-white/8 bg-[#17171a] p-5"
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                            {player.photoUrl ? (
                              <img
                                src={player.photoUrl}
                                alt={`${player.firstName} ${player.lastName}`}
                                className="h-16 w-16 rounded-2xl border border-white/10 object-cover"
                              />
                            ) : (
                              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-xs font-bold text-white/35">
                                N/A
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <div className="break-words text-xl font-bold text-white">
                                    {player.firstName} {player.lastName}
                                  </div>
                                  <div className="mt-2 text-sm text-white/50">
                                    {player.position || "Ruolo non impostato"}
                                  </div>
                                </div>

                                <div className="inline-flex w-fit rounded-2xl bg-[var(--accent)] px-4 py-2 text-lg font-black text-black">
                                  #{player.number}
                                </div>
                              </div>

                              <div className="mt-4 flex flex-wrap gap-3">
                                <Link
                                  href={`/leagues/${leagueId}/players/${player.id}`}
                                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
                                >
                                  Apri profilo
                                </Link>

                                {canEdit && (
                                  <button
                                    onClick={() =>
                                      deletePlayer(
                                        player.id,
                                        `${player.firstName} ${player.lastName}`
                                      )
                                    }
                                    className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-2 text-sm text-red-200"
                                  >
                                    Elimina
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {unassignedPlayers.length > 0 ? (
                <div>
                  <div className="mb-4 text-lg font-bold text-white/75">
                    Ruolo non impostato
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    {unassignedPlayers.map((player) => (
                      <div
                        key={player.id}
                        className="rounded-[24px] border border-white/8 bg-[#17171a] p-5"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                          {player.photoUrl ? (
                            <img
                              src={player.photoUrl}
                              alt={`${player.firstName} ${player.lastName}`}
                              className="h-16 w-16 rounded-2xl border border-white/10 object-cover"
                            />
                          ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-xs font-bold text-white/35">
                              N/A
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <div className="break-words text-xl font-bold text-white">
                                  {player.firstName} {player.lastName}
                                </div>
                                <div className="mt-2 text-sm text-white/50">
                                  Ruolo non impostato
                                </div>
                              </div>

                              <div className="inline-flex w-fit rounded-2xl bg-[var(--accent)] px-4 py-2 text-lg font-black text-black">
                                #{player.number}
                              </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-3">
                              <Link
                                href={`/leagues/${leagueId}/players/${player.id}`}
                                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
                              >
                                Apri profilo
                              </Link>

                              <button
                                onClick={() =>
                                  deletePlayer(
                                    player.id,
                                    `${player.firstName} ${player.lastName}`
                                  )
                                }
                                className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-2 text-sm text-red-200"
                              >
                                Elimina
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}