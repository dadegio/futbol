"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import DashboardShell from "src/app/_components/dashboard-shell";

type Player = {
  id: string;
  firstName: string;
  lastName: string;
  number: number;
  position?: string | null;
  photoUrl?: string | null;
  team: {
    id: string;
    name: string;
    leagueId: string;
  };
};

const POSITIONS = ["Portiere", "Difensore", "Centrocampista", "Attaccante"];

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error((data as any)?.error ?? "Errore upload immagine");
  }

  return data.url as string;
}

export default function PlayerPage() {
  const { leagueId, playerId } = useParams<{ leagueId: string; playerId: string }>();

  const [player, setPlayer] = useState<Player | null>(null);
  const [goals, setGoals] = useState(0);
  const [assists, setAssists] = useState(0);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [number, setNumber] = useState("");
  const [position, setPosition] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);

  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setErr(null);
    setLoading(true);

    try {
      const playerRes = await fetch(`/api/players/${playerId}`, { cache: "no-store" });
      const playerData = await playerRes.json().catch(() => ({}));

      if (!playerRes.ok) {
        throw new Error((playerData as any)?.error ?? "Errore caricamento giocatore");
      }

      const statsRes = await fetch(`/api/leagues/${leagueId}/stats`, { cache: "no-store" });
      const statsData = await statsRes.json().catch(() => ({}));

      let g = 0;
      let a = 0;

      if (statsRes.ok) {
        const scorer = (statsData.scorers ?? []).find((x: any) => x.playerId === playerId);
        const assistman = (statsData.assists ?? []).find((x: any) => x.playerId === playerId);
        g = scorer?.value ?? 0;
        a = assistman?.value ?? 0;
      }

      setPlayer(playerData);
      setGoals(g);
      setAssists(a);

      setFirstName(playerData.firstName ?? "");
      setLastName(playerData.lastName ?? "");
      setNumber(String(playerData.number ?? ""));
      setPosition(playerData.position ?? "");
      setPhotoUrl(playerData.photoUrl ?? "");
      setPhotoFile(null);
      setRemovePhoto(false);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!leagueId || !playerId) return;
    load();
  }, [leagueId, playerId]);

  const photoPreview = useMemo(() => {
    if (removePhoto) return "";
    if (photoFile) return URL.createObjectURL(photoFile);
    return photoUrl || "";
  }, [photoFile, photoUrl, removePhoto]);

  async function savePlayer() {
    setErr(null);
    setMsg(null);

    const n = Number(number);

    if (!firstName.trim() || !lastName.trim()) {
      setErr("Inserisci nome e cognome");
      return;
    }

    if (!Number.isInteger(n) || n <= 0 || n > 99) {
      setErr("Numero maglia non valido");
      return;
    }

    try {
      setSaving(true);

      let finalPhotoUrl: string | null = removePhoto ? null : photoUrl.trim() || null;

      if (photoFile) {
        if (!photoFile.type.startsWith("image/")) {
          throw new Error("Seleziona un'immagine valida");
        }

        if (photoFile.size > 5 * 1024 * 1024) {
          throw new Error("La foto deve essere massimo 5 MB");
        }

        finalPhotoUrl = await uploadImage(photoFile);
      }

      const res = await fetch(`/api/players/${playerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          number: n,
          position: position || null,
          photoUrl: finalPhotoUrl,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error((data as any)?.error ?? "Errore aggiornamento giocatore");
      }

      setMsg("Profilo giocatore aggiornato ✅");
      setEditing(false);
      await load();
    } catch (e: any) {
      setErr(e.message ?? "Errore");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <DashboardShell leagueId={leagueId}>
        <div className="text-white/70">Caricamento…</div>
      </DashboardShell>
    );
  }

  if (!player) {
    return (
      <DashboardShell leagueId={leagueId}>
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {err ?? "Giocatore non trovato"}
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="space-y-6">
        <section className="rounded-[28px] border border-white/8 bg-[#121214]/95 p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              {player.photoUrl ? (
                <img
                  src={player.photoUrl}
                  alt={`${player.firstName} ${player.lastName}`}
                  className="h-24 w-24 rounded-3xl border border-white/10 object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white/5 text-sm font-bold text-white/35">
                  NO PHOTO
                </div>
              )}

              <div className="min-w-0">
                <div className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
                  Player
                </div>
                <h1 className="mt-2 break-words text-3xl font-black text-white">
                  #{player.number} {player.firstName} {player.lastName}
                </h1>
                <p className="mt-2 text-sm text-white/60">
                  {player.position || "Ruolo non impostato"} • {player.team.name}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setEditing((v) => !v)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/10"
              >
                {editing ? "Chiudi modifica" : "Modifica profilo"}
              </button>

              <Link
                href={`/leagues/${leagueId}/teams/${player.team.id}`}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/10"
              >
                ← Vai alla squadra
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

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-white/8 bg-[#121214]/95 p-5 shadow-xl shadow-black/15">
            <div className="text-sm uppercase tracking-[0.18em] text-white/40">Squadra</div>
            <div className="mt-2 text-2xl font-black text-white">{player.team.name}</div>
          </div>

          <div className="rounded-[24px] border border-white/8 bg-[#121214]/95 p-5 shadow-xl shadow-black/15">
            <div className="text-sm uppercase tracking-[0.18em] text-white/40">Gol</div>
            <div className="mt-2 text-2xl font-black text-white">{goals}</div>
          </div>

          <div className="rounded-[24px] border border-white/8 bg-[#121214]/95 p-5 shadow-xl shadow-black/15">
            <div className="text-sm uppercase tracking-[0.18em] text-white/40">Assist</div>
            <div className="mt-2 text-2xl font-black text-white">{assists}</div>
          </div>
        </section>

        {editing ? (
          <section className="rounded-[28px] border border-white/8 bg-[#121214]/95 p-5 shadow-2xl shadow-black/20">
            <div className="mb-4 text-xl font-black text-white">Modifica giocatore</div>

            <div className="grid gap-4">
              <div className="grid gap-4 lg:grid-cols-[120px_minmax(0,1fr)] lg:items-start">
                <div>
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Preview giocatore"
                      className="h-24 w-24 rounded-3xl border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white/5 text-xs font-bold text-white/35">
                      NO PHOTO
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setPhotoFile(file);
                      if (file) {
                        setRemovePhoto(false);
                      }
                    }}
                    className="block w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-[var(--accent)] file:px-4 file:py-2 file:font-semibold file:text-black"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      setPhotoFile(null);
                      setPhotoUrl("");
                      setRemovePhoto(true);
                    }}
                    className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-2 text-sm text-red-200"
                  >
                    Rimuovi foto
                  </button>

                  <p className="text-sm text-white/50">
                    Carica un’immagine dal dispositivo. Max 5 MB.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Nome"
                  className="h-14 rounded-2xl border border-white/10 bg-white/5 px-4 text-white outline-none placeholder:text-white/35"
                />

                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Cognome"
                  className="h-14 rounded-2xl border border-white/10 bg-white/5 px-4 text-white outline-none placeholder:text-white/35"
                />

                <input
                  value={number}
                  onChange={(e) => setNumber(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="Numero"
                  inputMode="numeric"
                  className="h-14 rounded-2xl border border-white/10 bg-white/5 px-4 text-white outline-none placeholder:text-white/35"
                />

                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
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
              </div>
            </div>

            <button
              onClick={savePlayer}
              disabled={saving}
              className="mt-4 rounded-2xl bg-[var(--accent)] px-5 py-3 font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Salvataggio..." : "Salva modifiche"}
            </button>
          </section>
        ) : null}
      </div>
    </DashboardShell>
  );
}