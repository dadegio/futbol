"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Pencil, Trash2, Plus, ArrowLeft, X } from "lucide-react";
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
  const res = await authFetch("/api/upload", { method: "POST", body: formData });
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

  async function saveTeam() {
    setErr(null);
    setMsg(null);
    const trimmedName = name.trim();
    if (!trimmedName) { setErr("Inserisci il nome squadra"); return; }
    try {
      setSavingTeam(true);
      let finalBadgeUrl: string | null = removeBadge ? null : badgeUrl.trim() || null;
      if (badgeFile) {
        if (!badgeFile.type.startsWith("image/")) throw new Error("Seleziona un'immagine valida");
        if (badgeFile.size > 5 * 1024 * 1024) throw new Error("Il logo deve essere massimo 5 MB");
        finalBadgeUrl = await uploadImage(badgeFile);
      }
      const res = await authFetch(`/api/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, badgeUrl: finalBadgeUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Errore");
      setMsg("Squadra aggiornata");
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
    if (!newFirstName.trim() || !newLastName.trim()) { setErr("Inserisci nome e cognome"); return; }
    if (!Number.isInteger(n) || n <= 0) { setErr("Numero non valido"); return; }
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
    setNewFirstName(""); setNewLastName(""); setNewNumber("");
    setNewPosition(""); setNewPhotoUrl("");
    setMsg("Giocatore aggiunto");
    setShowAddPlayer(false);
    await load();
  }

  async function deletePlayer(playerId: string, label: string) {
    setErr(null);
    setMsg(null);
    if (!window.confirm(`Eliminare "${label}"?`)) return;
    const res = await authFetch(`/api/players/${playerId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(data?.error ?? "Errore eliminazione giocatore");
    setMsg("Giocatore eliminato");
    await load();
  }

  if (!team) {
    return (
      <DashboardShell leagueId={leagueId}>
        <div className="text-[var(--foreground)]/50">Caricamento…</div>
      </DashboardShell>
    );
  }

  const allPlayers = [...team.players].sort((a, b) => a.number - b.number);
  const groupedPlayers = [
    ...ROLE_ORDER.map((role) => ({
      role,
      players: allPlayers.filter((p) => p.position === role),
    })).filter((g) => g.players.length > 0),
    ...(allPlayers.filter((p) => !p.position || !ROLE_ORDER.includes(p.position)).length > 0
      ? [{ role: "—", players: allPlayers.filter((p) => !p.position || !ROLE_ORDER.includes(p.position)) }]
      : []),
  ];

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="space-y-5">

        {/* Header card */}
        <Card>
          <div className="flex items-start gap-4">
            {/* Badge */}
            {team.badgeUrl ? (
              <img src={team.badgeUrl} alt={team.name}
                className="h-16 w-16 shrink-0 rounded-xl border border-[var(--border)] object-cover" />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-white/5 text-xs font-medium text-[var(--foreground)]/30">
                Logo
              </div>
            )}

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-widest text-[var(--accent)]/70">
                {team.league.name}
              </p>
              <h1 className="mt-1 text-2xl font-bold text-[var(--foreground)]">{team.name}</h1>
              <p className="mt-0.5 text-sm text-[var(--foreground)]/45">
                {team.players.length} giocatori
              </p>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-2">
              {canEdit && (
                <button
                  onClick={() => { setEditingTeam((v) => !v); setShowAddPlayer(false); }}
                  title="Modifica squadra"
                  className={[
                    "rounded-xl border p-2 transition-colors",
                    editingTeam
                      ? "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "border-[var(--border)] bg-white/5 text-[var(--foreground)]/50 hover:text-[var(--foreground)]",
                  ].join(" ")}
                >
                  {editingTeam ? <X size={16} /> : <Pencil size={16} />}
                </button>
              )}
              <Link
                href={`/leagues/${leagueId}/teams`}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-white/5 px-3 py-2 text-xs text-[var(--foreground)]/60 transition-colors hover:text-[var(--foreground)]"
              >
                <ArrowLeft size={13} />
                Squadre
              </Link>
            </div>
          </div>
        </Card>

        {/* Feedback */}
        {msg && <Badge variant="success">{msg}</Badge>}
        {err && <Badge variant="error">{err}</Badge>}

        {/* Edit team form — only visible when toggled */}
        {canEdit && editingTeam && (
          <Card variant="inner">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-[var(--foreground)]">Modifica squadra</h2>
              <button onClick={() => setEditingTeam(false)} className="text-[var(--foreground)]/40 hover:text-[var(--foreground)]">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome squadra"
                className="w-full"
              />

              <div className="flex items-start gap-4">
                {badgePreview ? (
                  <img src={badgePreview} alt="Preview"
                    className="h-16 w-16 shrink-0 rounded-xl border border-[var(--border)] object-cover" />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-white/5 text-xs text-[var(--foreground)]/30">
                    Logo
                  </div>
                )}

                <div className="flex-1 space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setBadgeFile(file);
                      if (file) setRemoveBadge(false);
                    }}
                    className="block w-full rounded-xl border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-[var(--foreground)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--accent)] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-black"
                  />
                  <p className="text-xs text-[var(--foreground)]/40">Max 5 MB.</p>
                  {(badgePreview) && (
                    <button
                      type="button"
                      onClick={() => { setBadgeFile(null); setBadgeUrl(""); setRemoveBadge(true); }}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Rimuovi logo
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button onClick={saveTeam} disabled={savingTeam}>
                {savingTeam ? "Salvataggio…" : "Salva"}
              </Button>
              <Button variant="secondary" onClick={() => setEditingTeam(false)}>
                Annulla
              </Button>
            </div>
          </Card>
        )}

        {/* Player roster */}
        <Card>
          {/* Section header with add button */}
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-[var(--foreground)]">Rosa</h2>
              <p className="text-xs text-[var(--foreground)]/40">
                {team.players.length} / 16 giocatori
              </p>
            </div>
            {canEdit && (
              <Button
                size="sm"
                variant={showAddPlayer ? "secondary" : "primary"}
                onClick={() => { setShowAddPlayer((v) => !v); setEditingTeam(false); }}
                disabled={team.players.length >= 16}
              >
                {showAddPlayer ? (
                  <span className="flex items-center gap-1.5"><X size={13} /> Chiudi</span>
                ) : (
                  <span className="flex items-center gap-1.5"><Plus size={13} /> Aggiungi giocatore</span>
                )}
              </Button>
            )}
          </div>

          {/* Add player form — inline, near the roster */}
          {canEdit && showAddPlayer && (
            <div className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--card-2)] p-4">
              <h3 className="mb-3 text-sm font-medium text-[var(--foreground)]">Nuovo giocatore</h3>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                <Input
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  placeholder="Nome"
                />
                <Input
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  placeholder="Cognome"
                />
                <Input
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="Numero"
                  inputMode="numeric"
                />
                <Select value={newPosition} onChange={(e) => setNewPosition(e.target.value)}>
                  <option value="" className="text-black">Ruolo</option>
                  {POSITIONS.map((p) => (
                    <option key={p} value={p} className="text-black">{p}</option>
                  ))}
                </Select>
              </div>
              <Input
                value={newPhotoUrl}
                onChange={(e) => setNewPhotoUrl(e.target.value)}
                placeholder="URL foto (opzionale)"
                className="mt-2.5 w-full"
              />
              <div className="mt-3 flex gap-2">
                <Button onClick={addPlayer} size="sm">Aggiungi</Button>
                <Button variant="secondary" size="sm" onClick={() => setShowAddPlayer(false)}>Annulla</Button>
              </div>
            </div>
          )}

          {/* Player list */}
          {team.players.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] py-10 text-center text-sm text-[var(--foreground)]/40">
              Nessun giocatore. Aggiungi il primo dalla rosa.
            </div>
          ) : (
            <div className="space-y-6">
              {groupedPlayers.map(({ role, players }) => (
                <div key={role}>
                  <div className="mb-2.5 flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-[var(--foreground)]/40">
                      {role === "—" ? "Ruolo non impostato" : role}
                    </span>
                    <div className="h-px flex-1 bg-[var(--border)]" />
                  </div>

                  <div className="grid gap-3 xl:grid-cols-2">
                    {players.map((player) => (
                      <div
                        key={player.id}
                        className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card-2)] p-3"
                      >
                        {/* Photo */}
                        {player.photoUrl ? (
                          <img src={player.photoUrl} alt={`${player.firstName} ${player.lastName}`}
                            className="h-12 w-12 shrink-0 rounded-xl border border-[var(--border)] object-cover" />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/5 text-lg font-bold text-[var(--foreground)]/20">
                            {player.firstName[0]}
                          </div>
                        )}

                        {/* Name */}
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-[var(--foreground)]">
                            {player.firstName} {player.lastName}
                          </div>
                          <div className="text-xs text-[var(--foreground)]/40">
                            #{player.number}{player.position ? ` · ${player.position}` : ""}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Link
                            href={`/leagues/${leagueId}/players/${player.id}`}
                            className="rounded-lg border border-[var(--border)] bg-white/5 px-2.5 py-1.5 text-xs text-[var(--foreground)]/60 transition-colors hover:text-[var(--foreground)]"
                          >
                            Profilo
                          </Link>
                          {canEdit && (
                            <button
                              onClick={() => deletePlayer(player.id, `${player.firstName} ${player.lastName}`)}
                              title="Elimina giocatore"
                              className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--foreground)]/35 transition-colors hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-300"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

      </div>
    </DashboardShell>
  );
}
