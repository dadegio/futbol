"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card from "src/app/_components/ui/card";
import Button from "src/app/_components/ui/button";
import Badge from "src/app/_components/ui/badge";
import Input from "src/app/_components/ui/input";
import Select from "src/app/_components/ui/select";

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
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error ?? "Errore upload immagine");
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
      if (!playerRes.ok) throw new Error((playerData as any)?.error ?? "Errore caricamento giocatore");

      const statsRes = await fetch(`/api/players/${playerId}/stats`, { cache: "no-store" });
      const statsData = await statsRes.json().catch(() => ({}));

      setPlayer(playerData);
      setGoals(statsRes.ok ? (statsData.goals ?? 0) : 0);
      setAssists(statsRes.ok ? (statsData.assists ?? 0) : 0);
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
    if (!firstName.trim() || !lastName.trim()) { setErr("Inserisci nome e cognome"); return; }
    if (!Number.isInteger(n) || n <= 0 || n > 99) { setErr("Numero maglia non valido"); return; }
    try {
      setSaving(true);
      let finalPhotoUrl: string | null = removePhoto ? null : photoUrl.trim() || null;
      if (photoFile) {
        if (!photoFile.type.startsWith("image/")) throw new Error("Seleziona un'immagine valida");
        if (photoFile.size > 5 * 1024 * 1024) throw new Error("La foto deve essere massimo 5 MB");
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
      if (!res.ok) throw new Error((data as any)?.error ?? "Errore aggiornamento giocatore");
      setMsg("Profilo aggiornato");
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
        <div className="text-[var(--foreground)]/60">Caricamento…</div>
      </DashboardShell>
    );
  }

  if (!player) {
    return (
      <DashboardShell leagueId={leagueId}>
        <Badge variant="error">{err ?? "Giocatore non trovato"}</Badge>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="space-y-5">

        {/* Header */}
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {player.photoUrl ? (
                <img
                  src={player.photoUrl}
                  alt={`${player.firstName} ${player.lastName}`}
                  className="h-16 w-16 rounded-2xl border border-[var(--border)] object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-xs font-bold text-[var(--foreground)]/35">
                  N/A
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-widest text-[var(--accent)]/70">
                  {player.team.name}
                </p>
                <h1 className="mt-0.5 text-2xl font-bold text-[var(--foreground)]">
                  <span className="mr-1.5 text-[var(--foreground)]/40">#{player.number}</span>
                  {player.firstName} {player.lastName}
                </h1>
                <p className="mt-0.5 text-sm text-[var(--foreground)]/50">
                  {player.position || "Ruolo non impostato"}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => setEditing((v) => !v)}
                aria-label={editing ? "Chiudi modifica profilo" : "Modifica profilo"}
                aria-pressed={editing}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[var(--border)] bg-white/5 text-[var(--foreground)]/60 transition-colors hover:bg-white/10 hover:text-[var(--foreground)]"
              >
                <Pencil size={15} />
              </button>
              <Link
                href={`/leagues/${leagueId}/teams/${player.team.id}`}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-xs text-[var(--foreground)]/60 hover:text-[var(--foreground)]"
              >
                <ArrowLeft size={13} /> Squadra
              </Link>
            </div>
          </div>
        </Card>

        {msg && <Badge variant="success">{msg}</Badge>}
        {err && <Badge variant="error">{err}</Badge>}

        {/* Stat cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { label: "Squadra", value: player.team.name },
            { label: "Gol", value: goals },
            { label: "Assist", value: assists },
          ].map((s) => (
            <Card key={s.label} variant="inner">
              <p className="text-xs font-medium uppercase tracking-widest text-[var(--foreground)]/50">
                {s.label}
              </p>
              <p className="mt-2 text-2xl font-black text-[var(--foreground)]">{s.value}</p>
            </Card>
          ))}
        </div>

        {/* Edit form */}
        {editing && (
          <Card>
            <h2 className="mb-4 text-lg font-black text-[var(--foreground)]">Modifica giocatore</h2>

            <div className="grid gap-4">
              {/* Photo section */}
              <div className="grid gap-4 lg:grid-cols-[96px_minmax(0,1fr)] lg:items-start">
                <div>
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="h-24 w-24 rounded-2xl border border-[var(--border)] object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white/5 text-xs font-bold text-[var(--foreground)]/35">
                      N/A
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <input
                    type="file"
                    accept="image/*"
                    aria-label="Carica foto giocatore"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setPhotoFile(file);
                      if (file) setRemovePhoto(false);
                    }}
                    className="block w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-2.5 text-sm text-[var(--foreground)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--accent)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => { setPhotoFile(null); setPhotoUrl(""); setRemovePhoto(true); }}
                  >
                    Rimuovi foto
                  </Button>
                  <p className="text-xs text-[var(--foreground)]/50">Max 5 MB.</p>
                </div>
              </div>

              {/* Fields */}
              <div className="grid gap-3 lg:grid-cols-2">
                <Input
                  aria-label="Nome"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Nome"
                />
                <Input
                  aria-label="Cognome"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Cognome"
                />
                <Input
                  aria-label="Numero maglia"
                  value={number}
                  onChange={(e) => setNumber(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="Numero"
                  inputMode="numeric"
                />
                <Select
                  aria-label="Ruolo"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                >
                  <option value="" className="text-black">Ruolo</option>
                  {POSITIONS.map((p) => (
                    <option key={p} value={p} className="text-black">{p}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <Button onClick={savePlayer} disabled={saving}>
                {saving ? "Salvataggio…" : "Salva modifiche"}
              </Button>
              <Button variant="secondary" onClick={() => setEditing(false)}>
                Annulla
              </Button>
            </div>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
