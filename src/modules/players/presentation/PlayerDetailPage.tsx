"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Crown, Goal, Handshake, Pencil, WalletCards } from "lucide-react";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card from "src/app/_components/ui/card";
import Button from "src/app/_components/ui/button";
import Badge from "src/app/_components/ui/badge";
import Input from "src/app/_components/ui/input";
import Select from "src/app/_components/ui/select";
import OptimizedPlayerImage from "src/app/_components/optimized-player-image";
import { authFetch, useAuth } from "@/lib/client-auth";

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
  birthDate?: string | null;
  documentSigned?: boolean;
  signedAt?: string | null;
  mediaConsent?: boolean;
  wildcardUsed?: boolean;
  status?: string;
  statusNote?: string | null;
  registrationStatus?: string;
  isEligibleForMatchSheet?: boolean;
  adminMissingItems?: string[];
  teamId?: string | null;
  team?: {
    id: string;
    name: string;
    badgeUrl?: string | null;
    leagueId: string;
    league?: { id: string; name: string } | null;
  } | null;
};

type PlayerStatsResponse = {
  goals?: number;
  assists?: number;
  appearances?: number;
  feeCents?: number;
  recentMatches?: Array<{
    matchId: string;
    date: string | null;
    homeTeamName: string;
    awayTeamName: string;
    homeGoals: number | null;
    awayGoals: number | null;
    goals: number;
    assists: number;
  }>;
};

const POSITIONS = ["Portiere", "Difensore", "Centrocampista", "Attaccante"];

const PLAYER_STATUS_OPTIONS = [
  ["PENDING", "Da completare"],
  ["IN_REVIEW", "In verifica"],
  ["AUTHORIZED", "Autorizzato"],
  ["BLOCKED", "Bloccato"],
  ["SUSPENDED", "Squalificato"],
  ["RETIRED", "Ritirato"],
] as const;

function formatEuro(cents: number) {
  return (cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function playerStatusLabel(player: Player | null) {
  if (!player) return "Da completare";
  if (player.registrationStatus) return player.registrationStatus;
  if (player.isEligibleForMatchSheet) return "Iscrizione OK";
  return PLAYER_STATUS_OPTIONS.find(([value]) => value === player.status)?.[1] ?? "Da completare";
}

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await authFetch("/api/upload", { method: "POST", body: formData });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error((data as any)?.error ?? "Errore upload immagine");
  if (!(data as any)?.url) throw new Error("Upload completato ma URL immagine mancante");

  return (data as any).url as string;
}

export default function PlayerPage({
  leagueId,
  playerId,
  initialPlayer,
  initialStats,
}: {
  leagueId: string;
  playerId: string;
  initialPlayer: Player;
  initialStats: PlayerStatsResponse;
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || (user?.role === "LEAGUE_ADMIN" && user.leagueId === leagueId);

  const [player, setPlayer] = useState<Player>(initialPlayer);
  const [goals, setGoals] = useState(initialStats.goals ?? 0);
  const [assists, setAssists] = useState(initialStats.assists ?? 0);
  const [appearances, setAppearances] = useState(initialStats.appearances ?? 0);
  const [feeCents, setFeeCents] = useState<number | null>(
    typeof initialStats.feeCents === "number" ? initialStats.feeCents : null
  );
  const [recentMatches, setRecentMatches] = useState<PlayerStatsResponse["recentMatches"]>(
    initialStats.recentMatches ?? []
  );

  const [firstName, setFirstName] = useState(initialPlayer.firstName ?? "");
  const [lastName, setLastName] = useState(initialPlayer.lastName ?? "");
  const [number, setNumber] = useState(String(initialPlayer.number ?? ""));
  const [position, setPosition] = useState(initialPlayer.position ?? "");
  const [photoUrl, setPhotoUrl] = useState(initialPlayer.photoUrl ?? "");
  const [photoZoom, setPhotoZoom] = useState(
    typeof initialPlayer.photoZoom === "number" ? initialPlayer.photoZoom : 1
  );
  const [photoPositionX, setPhotoPositionX] = useState(
    typeof initialPlayer.photoPositionX === "number" ? initialPlayer.photoPositionX : 50
  );
  const [photoPositionY, setPhotoPositionY] = useState(
    typeof initialPlayer.photoPositionY === "number" ? initialPlayer.photoPositionY : 50
  );
  const [isTeamCaptain, setIsTeamCaptain] = useState(Boolean(initialPlayer.isTeamCaptain));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [birthDate, setBirthDate] = useState(
    initialPlayer.birthDate ? String(initialPlayer.birthDate).slice(0, 10) : ""
  );
  const [documentSigned, setDocumentSigned] = useState(Boolean(initialPlayer.documentSigned));
  const [signedAt, setSignedAt] = useState(
    initialPlayer.signedAt ? String(initialPlayer.signedAt).slice(0, 10) : ""
  );
  const [mediaConsent, setMediaConsent] = useState(Boolean(initialPlayer.mediaConsent));
  const [wildcardUsed, setWildcardUsed] = useState(Boolean(initialPlayer.wildcardUsed));
  const [status, setStatus] = useState(initialPlayer.status ?? "PENDING");
  const [statusNote, setStatusNote] = useState(initialPlayer.statusNote ?? "");

  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setErr(null);

    try {
      const playerRes = await authFetch(`/api/players/${playerId}`, { cache: "no-store" });
      const playerData = await playerRes.json().catch(() => ({}));
      if (!playerRes.ok) throw new Error((playerData as any)?.error ?? "Errore caricamento giocatore");

      const statsRes = await authFetch(`/api/players/${playerId}/stats`, { cache: "no-store" });
      const statsData: PlayerStatsResponse = await statsRes.json().catch(() => ({}));

      setPlayer(playerData);
      setGoals(statsRes.ok ? (statsData.goals ?? 0) : 0);
      setAssists(statsRes.ok ? (statsData.assists ?? 0) : 0);
      setAppearances(statsRes.ok ? (statsData.appearances ?? 0) : 0);
      setFeeCents(statsRes.ok && typeof statsData.feeCents === "number" ? statsData.feeCents : null);
      setRecentMatches(statsRes.ok ? (statsData.recentMatches ?? []) : []);

      setFirstName(playerData.firstName ?? "");
      setLastName(playerData.lastName ?? "");
      setNumber(String(playerData.number ?? ""));
      setPosition(playerData.position ?? "");
      setPhotoUrl(playerData.photoUrl ?? "");
      setPhotoZoom(typeof playerData.photoZoom === "number" ? playerData.photoZoom : 1);
      setPhotoPositionX(typeof playerData.photoPositionX === "number" ? playerData.photoPositionX : 50);
      setPhotoPositionY(typeof playerData.photoPositionY === "number" ? playerData.photoPositionY : 50);
      setIsTeamCaptain(Boolean(playerData.isTeamCaptain));
      setPhotoFile(null);
      setRemovePhoto(false);
      setBirthDate(playerData.birthDate ? String(playerData.birthDate).slice(0, 10) : "");
      setDocumentSigned(Boolean(playerData.documentSigned));
      setSignedAt(playerData.signedAt ? String(playerData.signedAt).slice(0, 10) : "");
      setMediaConsent(Boolean(playerData.mediaConsent));
      setWildcardUsed(Boolean(playerData.wildcardUsed));
      setStatus(playerData.status ?? "PENDING");
      setStatusNote(playerData.statusNote ?? "");
    } catch (e: any) {
      setErr(e.message ?? "Errore");
    }
  }

  const photoPreview = useMemo(() => {
    if (removePhoto) return "";
    if (photoFile) return URL.createObjectURL(photoFile);
    return photoUrl || "";
  }, [photoFile, photoUrl, removePhoto]);

  async function savePlayer() {
    setErr(null);
    setMsg(null);

    const n = Number(number);
    if (!firstName.trim() || !lastName.trim()) return setErr("Inserisci nome e cognome");
    if (!Number.isInteger(n) || n <= 0 || n > 99) return setErr("Numero maglia non valido");

    try {
      setSaving(true);
      let finalPhotoUrl: string | null = removePhoto ? null : photoUrl.trim() || null;

      if (isAdmin && photoFile) {
        if (!photoFile.type.startsWith("image/")) throw new Error("Seleziona un'immagine valida");
        if (photoFile.size > 5 * 1024 * 1024) throw new Error("La foto deve essere massimo 5 MB");
        finalPhotoUrl = await uploadImage(photoFile);
      }

      const body: Record<string, unknown> = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        number: n,
        position: position || null,
      };

      if (isAdmin) {
        Object.assign(body, {
          photoUrl: finalPhotoUrl,
          photoZoom,
          photoPositionX,
          photoPositionY,
          birthDate: birthDate || null,
          documentSigned,
          signedAt: signedAt || null,
          mediaConsent,
          wildcardUsed,
          status,
          statusNote: statusNote.trim() || null,
          isTeamCaptain,
        });
      }

      const res = await authFetch(`/api/players/${playerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error ?? "Errore aggiornamento giocatore");

      if ((data as any)?.requestCreated) {
        setMsg("Rosa bloccata: richiesta di modifica inviata all'admin");
        setEditing(false);
        return;
      }

      setMsg("Profilo aggiornato");
      setEditing(false);
      await load();
    } catch (e: any) {
      setErr(e.message ?? "Errore");
    } finally {
      setSaving(false);
    }
  }

  const fullName = `${player.firstName} ${player.lastName}`;
  const canEditSport = isAdmin || (user?.role === "CAPTAIN" && user.teamId === player.team?.id);

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="w-full space-y-5 pb-8">
        <Link href={player.team ? `/leagues/${leagueId}/teams/${player.team.id}` : `/leagues/${leagueId}/players`} className="inline-flex items-center gap-2 text-sm font-bold text-[var(--muted)] hover:text-[var(--foreground)]">
          <ArrowLeft size={15} /> Torna alla squadra
        </Link>

        {msg && <Badge variant="success">{msg}</Badge>}
        {err && <Badge variant="error">{err}</Badge>}

        <Card className="overflow-hidden !p-0">
          <div className="matchroom-hero grid lg:grid-cols-[minmax(280px,34%)_minmax(0,1fr)]">
            <div className="relative flex min-h-[330px] items-end justify-center overflow-hidden border-b border-white/10 bg-black/20 p-5 sm:min-h-[390px] lg:min-h-[430px] lg:border-b-0 lg:border-r">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.10),transparent_48%)]" />
              <PlayerAvatar firstName={player.firstName} lastName={player.lastName} number={player.number} photoUrl={player.photoUrl ?? null} photoZoom={player.photoZoom ?? 1} photoPositionX={player.photoPositionX ?? 50} photoPositionY={player.photoPositionY ?? 50} />
            </div>

            <div className="relative flex min-w-0 flex-col justify-between gap-7 overflow-hidden p-5 sm:p-7 lg:p-8">
              {player.team?.badgeUrl && (
                <img src={player.team.badgeUrl} alt="" aria-hidden="true" className="pointer-events-none absolute -right-16 top-1/2 h-72 w-72 -translate-y-1/2 rotate-[-10deg] object-contain opacity-[0.055] blur-[1px]" />
              )}
              <div className="relative">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--accent)]">#{player.number}</span>
                  {player.position && <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">{player.position}</span>}
                  {player.isTeamCaptain && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-300">
                      <Crown size={12} /> Capitano
                    </span>
                  )}
                </div>

                <p className="mt-5 text-[11px] font-black uppercase tracking-[0.24em] text-[var(--muted)]">Profilo giocatore</p>
                <h1 className="mt-2 break-words text-4xl font-black leading-[0.94] tracking-[-0.07em] text-[var(--foreground)] sm:text-6xl xl:text-7xl">{fullName}</h1>

                {player.team ? (
                  <Link href={`/leagues/${leagueId}/teams/${player.team.id}`} className="mt-5 inline-flex max-w-full items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 transition hover:border-[var(--accent)]/35 hover:bg-black/30">
                    <TeamBadge name={player.team.name} badgeUrl={player.team.badgeUrl ?? null} />
                    <span className="min-w-0 truncate text-sm font-black text-[var(--foreground)]">{player.team.name}</span>
                  </Link>
                ) : (
                  <p className="mt-5 text-sm font-semibold text-[var(--muted)]">Squadra non disponibile</p>
                )}
              </div>

              <div className="relative">
                {isAdmin && (
                  <div className="mb-3 flex items-center gap-2">
                    <span className={[
                      "h-2 w-2 rounded-full",
                      player.isEligibleForMatchSheet ? "bg-[var(--accent)]" : "bg-amber-300",
                    ].join(" ")} />
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">{playerStatusLabel(player)}</span>
                  </div>
                )}

                <div className={isAdmin ? "grid grid-cols-2 gap-2 sm:grid-cols-4" : "grid grid-cols-3 gap-2"}>
                  <HeroStat label="Gol" value={goals} icon={<Goal size={15} />} />
                  <HeroStat label="Assist" value={assists} icon={<Handshake size={15} />} />
                  <HeroStat label="Presenze" value={appearances} icon={<CalendarDays size={15} />} />
                  {isAdmin && <HeroStat label="Quote" value={formatEuro(feeCents ?? appearances * 50)} icon={<WalletCards size={15} />} />}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className={isAdmin ? "grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)] 2xl:grid-cols-[minmax(0,1.45fr)_420px]" : "grid gap-5"}>
          <Card className={!isAdmin ? "xl:col-span-2" : undefined}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-[var(--foreground)]">Scheda giocatore</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">Informazioni sportive essenziali, senza dati amministrativi.</p>
              </div>
              {canEditSport && (
                <button onClick={() => setEditing((v) => !v)} className="grid h-11 w-11 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--card-2)] text-[var(--muted)] hover:text-[var(--foreground)]">
                  <Pencil size={16} />
                </button>
              )}
            </div>

            <div className={isAdmin ? "mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" : "mt-5 grid gap-3 sm:grid-cols-3"}>
              <InfoRow label="Nome" value={fullName} />
              <InfoRow label="Numero" value={`#${player.number}`} />
              <InfoRow label="Ruolo" value={player.position || "Non impostato"} />
              {isAdmin && <InfoRow label="Iscrizione" value={playerStatusLabel(player)} />}
            </div>
          </Card>

          {isAdmin && (
            <Card>
              <h2 className="text-xl font-black text-[var(--foreground)]">Area admin</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Dettagli tecnici visibili solo all'amministratore.</p>
              <div className="mt-5 space-y-3">
                <CheckLine ok={Boolean(player.documentSigned)} label="Modulo unico firmato" />
                <CheckLine ok={Boolean(player.mediaConsent)} label="Liberatoria video/foto" />
                <CheckLine ok={player.status === "AUTHORIZED"} label={`Stato: ${playerStatusLabel(player)}`} />
                <CheckLine ok={!player.wildcardUsed} label={player.wildcardUsed ? "Wildcard usata" : "Wildcard non usata"} />
                {player.statusNote && <p className="rounded-2xl bg-[var(--card-2)] p-3 text-sm text-[var(--muted)]">{player.statusNote}</p>}
              </div>
            </Card>
          )}
        </div>

        {editing && canEditSport && (
          <Card>
            <h2 className="mb-4 text-lg font-black text-[var(--foreground)]">Modifica giocatore</h2>
            <div className="grid gap-4">
              {isAdmin ? (
              <div className="grid gap-4 lg:grid-cols-[190px_minmax(0,1fr)] lg:items-start">
                <div className="space-y-2">
                  <div className="relative aspect-[4/5] w-full max-w-[190px] overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-black/20">
                    {photoPreview ? (
                      <img
                        src={photoPreview}
                        alt="Anteprima inquadratura"
                        className="absolute inset-0 h-full w-full object-contain"
                        style={{
                          objectPosition: `${photoPositionX}% ${photoPositionY}%`,
                          transform: `scale(${photoZoom})`,
                          transformOrigin: `${photoPositionX}% ${photoPositionY}%`,
                        }}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-bold text-[var(--foreground)]/35">N/A</div>
                    )}
                  </div>
                  <p className="text-xs text-[var(--muted)]">L’anteprima usa la stessa inquadratura delle card.</p>
                </div>

                <div className="space-y-4">
                  <input type="file" accept="image/*" aria-label="Carica foto giocatore" onChange={(e) => { const file = e.target.files?.[0] ?? null; setPhotoFile(file); if (file) setRemovePhoto(false); }} className="block w-full rounded-xl border border-[var(--border)] bg-white/5 px-3.5 py-2.5 text-sm text-[var(--foreground)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--accent)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-black" />

                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="rounded-2xl border border-[var(--border)] bg-white/[0.03] p-3">
                      <span className="flex items-center justify-between gap-2 text-xs font-bold text-[var(--foreground)]"><span>Zoom</span><span>{Math.round(photoZoom * 100)}%</span></span>
                      <input aria-label="Zoom foto" type="range" min="0.75" max="2" step="0.05" value={photoZoom} onChange={(e) => setPhotoZoom(Number(e.target.value))} className="mt-3 w-full accent-[var(--accent)]" />
                    </label>
                    <label className="rounded-2xl border border-[var(--border)] bg-white/[0.03] p-3">
                      <span className="flex items-center justify-between gap-2 text-xs font-bold text-[var(--foreground)]"><span>Orizzontale</span><span>{photoPositionX}%</span></span>
                      <input aria-label="Posizione orizzontale foto" type="range" min="0" max="100" step="1" value={photoPositionX} onChange={(e) => setPhotoPositionX(Number(e.target.value))} className="mt-3 w-full accent-[var(--accent)]" />
                    </label>
                    <label className="rounded-2xl border border-[var(--border)] bg-white/[0.03] p-3">
                      <span className="flex items-center justify-between gap-2 text-xs font-bold text-[var(--foreground)]"><span>Verticale</span><span>{photoPositionY}%</span></span>
                      <input aria-label="Posizione verticale foto" type="range" min="0" max="100" step="1" value={photoPositionY} onChange={(e) => setPhotoPositionY(Number(e.target.value))} className="mt-3 w-full accent-[var(--accent)]" />
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={() => { setPhotoZoom(1); setPhotoPositionX(50); setPhotoPositionY(50); }}>Reimposta inquadratura</Button>
                    <Button variant="destructive" size="sm" onClick={() => { setPhotoFile(null); setPhotoUrl(""); setRemovePhoto(true); }}>Rimuovi foto</Button>
                  </div>
                </div>
              </div>
              ) : (
                <p className="rounded-2xl border border-[var(--border)] bg-white/[0.03] px-4 py-3 text-sm text-[var(--muted)]">La foto profilo e la sua inquadratura sono gestite esclusivamente dall&apos;admin.</p>
              )}

              <div className="grid gap-3 lg:grid-cols-2">
                <Input aria-label="Nome" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Nome" />
                <Input aria-label="Cognome" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Cognome" />
                <Input aria-label="Numero maglia" value={number} onChange={(e) => setNumber(e.target.value.replace(/[^\d]/g, ""))} placeholder="Numero" inputMode="numeric" />
                <Select aria-label="Ruolo" value={position} onChange={(e) => setPosition(e.target.value)}>
                  <option value="" className="text-black">Ruolo</option>
                  {POSITIONS.map((p) => <option key={p} value={p} className="text-black">{p}</option>)}
                </Select>
              </div>

              {isAdmin && (
                <div className="rounded-2xl border border-[var(--border)] bg-white/[0.03] p-4">
                  <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-[var(--foreground)]/70">Documenti e autorizzazioni FUTPOLI</h3>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <Input aria-label="Data di nascita" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                    <Input aria-label="Data firma" type="date" value={signedAt} onChange={(e) => setSignedAt(e.target.value)} />
                    <Select aria-label="Stato admin" value={status} onChange={(e) => setStatus(e.target.value)}>{PLAYER_STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value} className="text-black">{label}</option>)}</Select>
                  </div>
                  <label className="mt-3 flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-3 py-3 text-sm text-[var(--foreground)]/85">
                    <input type="checkbox" checked={isTeamCaptain} onChange={(e) => setIsTeamCaptain(e.target.checked)} className="mt-0.5" />
                    <span>
                      <span className="flex items-center gap-1.5 font-bold text-[var(--foreground)]"><Crown size={14} className="text-amber-300" /> Capitano della squadra</span>
                      <span className="mt-0.5 block text-xs text-[var(--muted)]">Solo riconoscimento visivo. Se lo assegni, il capitano precedente della squadra viene rimosso automaticamente.</span>
                    </span>
                  </label>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {[["Modulo firmato", documentSigned, setDocumentSigned], ["Liberatoria video/foto", mediaConsent, setMediaConsent], ["Wildcard", wildcardUsed, setWildcardUsed]].map(([label, value, setter]) => (
                      <label key={label as string} className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]/80"><input type="checkbox" checked={value as boolean} onChange={(e) => (setter as (v: boolean) => void)(e.target.checked)} />{label as string}</label>
                    ))}
                  </div>
                  <Input aria-label="Note stato" value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="Note admin opzionali" className="mt-3" />
                </div>
              )}
            </div>
            <div className="mt-4 flex gap-3">
              <Button onClick={savePlayer} disabled={saving}>{saving ? "Salvataggio…" : "Salva modifiche"}</Button>
              <Button variant="secondary" onClick={() => setEditing(false)}>Annulla</Button>
            </div>
          </Card>
        )}

        <Card>
          <h2 className="mb-4 text-lg font-black text-[var(--foreground)]">Ultime presenze</h2>
          {recentMatches?.length === 0 ? <p className="text-sm text-[var(--foreground)]/55">Nessuna presenza registrata per questo giocatore.</p> : (
            <div className="space-y-3">{recentMatches?.map((match) => (
              <Link key={match.matchId} href={`/leagues/${leagueId}/matches/${match.matchId}`} className="block rounded-2xl border border-[var(--border)] bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.05]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0"><div className="break-words font-semibold text-[var(--foreground)]">{match.homeTeamName} vs {match.awayTeamName}</div><div className="mt-1 text-sm text-[var(--foreground)]/55">{match.date ? new Date(match.date).toLocaleDateString("it-IT") : "Data da definire"}</div></div>
                  <div className="flex items-center gap-4"><div className="text-sm font-bold text-[var(--foreground)]">{match.homeGoals ?? "-"} - {match.awayGoals ?? "-"}</div><div className="text-xs text-[var(--foreground)]/60">{match.goals} gol · {match.assists} assist</div></div>
                </div>
              </Link>
            ))}</div>
          )}
        </Card>
      </div>
    </DashboardShell>
  );
}

function PlayerAvatar({ firstName, lastName, number, photoUrl, photoZoom = 1, photoPositionX = 50, photoPositionY = 50 }: { firstName: string; lastName: string; number: number; photoUrl?: string | null; photoZoom?: number; photoPositionX?: number; photoPositionY?: number }) {
  const fullName = `${firstName} ${lastName}`;
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  const frameClass =
    "relative z-[1] aspect-[4/5] w-full max-w-[250px] shrink-0 overflow-hidden rounded-[28px] border border-white/10 bg-[var(--background)] shadow-[0_20px_60px_rgba(0,0,0,0.22)] sm:max-w-[285px]";

  if (photoUrl) {
    return (
      <div className={frameClass}>
        <OptimizedPlayerImage src={photoUrl} alt={`Foto ${fullName}`} sizes="(max-width: 640px) 250px, 285px" eager className="absolute inset-0 h-full w-full object-contain" style={{ objectPosition: `${photoPositionX}% ${photoPositionY}%`, transform: `scale(${Math.min(photoZoom, 1)})`, transformOrigin: `${photoPositionX}% ${photoPositionY}%` }} />
        <span className="absolute bottom-0 right-0 flex h-12 min-w-12 items-center justify-center rounded-tl-3xl bg-[var(--accent)] px-3 text-base font-black text-black">{number}</span>
      </div>
    );
  }

  return (
    <div className={`${frameClass} flex items-center justify-center text-4xl font-black text-[var(--accent)]`}>
      {initials || "?"}
      <span className="absolute bottom-0 right-0 flex h-12 min-w-12 items-center justify-center rounded-tl-3xl bg-[var(--accent)] px-3 text-base font-black text-black">{number}</span>
    </div>
  );
}

function HeroStat({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 sm:px-4">
      <div className="flex items-center gap-1.5 text-[var(--muted)]">{icon}<span className="text-[9px] font-black uppercase tracking-[0.14em]">{label}</span></div>
      <p className="mt-1.5 truncate text-xl font-black tracking-[-0.04em] text-[var(--foreground)] sm:text-2xl">{value}</p>
    </div>
  );
}

function TeamBadge({ name, badgeUrl }: { name: string; badgeUrl?: string | null }) {
  const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  if (badgeUrl) {
    return <img src={badgeUrl} alt={`Logo ${name}`} className="h-9 w-9 shrink-0 rounded-xl object-contain" />;
  }
  return <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-[10px] font-black text-[var(--muted)]">{initials || "?"}</span>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-[var(--card-2)] px-4 py-3"><p className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">{label}</p><p className="mt-1 font-black text-[var(--foreground)]">{value}</p></div>;
}

function CheckLine({ ok, label }: { ok: boolean; label: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--card-2)] px-4 py-3 text-sm"><span className="font-semibold text-[var(--foreground)]">{label}</span><span className={ok ? "text-[var(--accent)]" : "text-amber-300"}>{ok ? "OK" : "NO"}</span></div>;
}
