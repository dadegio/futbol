"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { CalendarDays, Camera, CheckCircle2, ExternalLink, Image as ImageIcon, Instagram, Mail, MapPin, Save, UploadCloud, UserRound, Video } from "lucide-react";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card, { CardHeader } from "src/app/_components/ui/card";
import Badge from "src/app/_components/ui/badge";
import Button from "src/app/_components/ui/button";
import Input from "src/app/_components/ui/input";
import Select from "src/app/_components/ui/select";
import { authFetch, useAuth, useCanCreateMedia } from "@/lib/client-auth";

type Profile = {
  id: string;
  displayName: string;
  roleLabel: string | null;
  avatarUrl: string | null;
  bio: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  youtubeUrl: string | null;
  email: string | null;
  phone: string | null;
  websiteUrl: string | null;
  primaryColor: string | null;
  showEmail: boolean;
  showInstagram: boolean;
  showTikTok: boolean;
  showYoutube: boolean;
  showPhone: boolean;
  active: boolean;
};

type Team = { id: string; name: string; players: Array<{ id: string; firstName: string; lastName: string; number: number }> };
type Match = { id: string; round: number; date: string | null; homeTeam: { name: string }; awayTeam: { name: string } };
type CreatorAssignmentMatch = {
  id: string;
  round: number;
  date: string | null;
  slotEnd: string | null;
  venueName: string | null;
  venueAddress: string | null;
  homeTeam: { id: string; name: string; badgeUrl: string | null };
  awayTeam: { id: string; name: string; badgeUrl: string | null };
  assignmentRole: "PHOTO" | "VIDEO";
};
type MediaItem = { id: string; type: string; status: string; title: string | null; caption: string | null; fileUrl: string; createdAt: string; socialUrl: string | null };

type StudioData = {
  profile: Profile | null;
  canAdmin: boolean;
  league: { id: string; name: string } | null;
  teams: Team[];
  matches: Match[];
  assignments: CreatorAssignmentMatch[];
  media: MediaItem[];
};

const typeOptions = [
  ["PHOTO", "Foto"],
  ["VIDEO", "Video"],
  ["REEL", "Reel"],
  ["HIGHLIGHT", "Highlights"],
  ["INTERVIEW", "Intervista"],
  ["BACKSTAGE", "Backstage"],
  ["OTHER", "Altro"],
] as const;

const statusLabels: Record<string, string> = {
  DRAFT: "bozza",
  PENDING_REVIEW: "in revisione",
  APPROVED: "pubblicato",
  HIDDEN: "nascosto",
  REJECTED: "rifiutato",
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function normalizeSocialInput(value: string) {
  return value.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "@").replace(/^https?:\/\/www\.tiktok\.com\/@?/i, "@");
}

export default function CreatorStudioPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { user, loading: authLoading } = useAuth();
  const canCreate = useCanCreateMedia(leagueId);
  const router = useRouter();
  const [data, setData] = useState<StudioData | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [mediaType, setMediaType] = useState("PHOTO");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [socialUrl, setSocialUrl] = useState("");
  const [round, setRound] = useState("");
  const [matchId, setMatchId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    if (!leagueId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await authFetch(`/api/leagues/${leagueId}/creator/me`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Errore caricamento studio creator");
      setData(body);
      setProfile(body.profile ?? null);
    } catch (error) {
      setErr(getErrorMessage(error, "Errore caricamento studio creator"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [leagueId]);

  useEffect(() => {
    if (!authLoading && !canCreate) router.replace(`/leagues/${leagueId}/media`);
  }, [authLoading, canCreate, leagueId, router]);

  const players = useMemo(() => data?.teams.flatMap((team) => team.players.map((player) => ({ ...player, teamName: team.name }))) ?? [], [data?.teams]);

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0];
    if (!next) return;
    setUploadingAvatar(true);
    setErr(null);
    try {
      const form = new FormData();
      form.append("file", next);
      const res = await authFetch("/api/upload", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Errore upload avatar");
      setProfile((current) => current ? { ...current, avatarUrl: body.url } : current);
    } catch (error) {
      setErr(getErrorMessage(error, "Errore upload avatar"));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function saveProfile() {
    if (!profile) return;
    setSavingProfile(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await authFetch(`/api/leagues/${leagueId}/creator/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Errore salvataggio profilo");
      setProfile(body);
      setMsg("Profilo creator aggiornato");
    } catch (error) {
      setErr(getErrorMessage(error, "Errore salvataggio profilo"));
    } finally {
      setSavingProfile(false);
    }
  }

  async function uploadMediaFile() {
    if (!file) return;
    setUploadingFile(true);
    setErr(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await authFetch(`/api/leagues/${leagueId}/media/upload`, { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Errore upload file");
      setFileUrl(body.url);
      if (body.mediaKind === "video" && mediaType === "PHOTO") setMediaType("VIDEO");
    } catch (error) {
      setErr(getErrorMessage(error, "Errore upload file"));
    } finally {
      setUploadingFile(false);
    }
  }

  async function submitMedia() {
    setErr(null);
    setMsg(null);
    const finalUrl = fileUrl.trim();
    if (!finalUrl) { setErr("Carica un file oppure incolla un link al contenuto"); return; }
    setSubmitting(true);
    try {
      const res = await authFetch(`/api/leagues/${leagueId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: mediaType,
          title,
          caption,
          fileUrl: finalUrl,
          socialUrl,
          round: round ? Number(round) : null,
          matchId: matchId || null,
          teamId: teamId || null,
          playerId: playerId || null,
          creditName: profile?.displayName || user?.username || "Creator",
          creditInstagram: profile?.instagramUrl || null,
          creditEmail: profile?.email || null,
          showCreditEmail: profile?.showEmail === true,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Errore pubblicazione contenuto");
      setFile(null); setFileUrl(""); setTitle(""); setCaption(""); setSocialUrl(""); setRound(""); setMatchId(""); setTeamId(""); setPlayerId(""); setMediaType("PHOTO");
      setMsg(data?.canAdmin ? "Contenuto pubblicato" : "Contenuto inviato in revisione");
      await load();
    } catch (error) {
      setErr(getErrorMessage(error, "Errore pubblicazione contenuto"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!canCreate && !authLoading) return null;

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="space-y-5 pb-8">
        <Card>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <CardHeader tag="Creator Studio" title="Carica contenuti del torneo" description="Foto, video, reel, highlights e backstage con credits e collegamenti ai social." level={1} />
            <Link href={`/leagues/${leagueId}/media`}><Button type="button" variant="secondary"><Camera size={17} className="mr-2" /> Vai al Media Center</Button></Link>
          </div>
        </Card>

        {err && <Badge variant="error">{err}</Badge>}
        {msg && <Badge variant="success"><CheckCircle2 size={16} /> {msg}</Badge>}
        {loading && <p className="text-sm text-[var(--muted)]">Caricamento…</p>}

        {profile && (
          <Card>
            <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
              <div className="rounded-[28px] border border-[var(--border)] bg-[var(--card-2)] p-4 text-center" style={{ borderColor: profile.primaryColor || undefined }}>
                {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" loading="lazy" decoding="async" className="mx-auto h-32 w-32 rounded-[32px] object-cover" /> : <div className="mx-auto grid h-32 w-32 place-items-center rounded-[32px] bg-[var(--accent-soft)] text-[var(--accent)]"><UserRound size={44} /></div>}
                <label className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-xs font-black text-[var(--foreground)]">
                  {uploadingAvatar ? "Caricamento…" : "Cambia avatar"}
                  <input type="file" accept="image/*" onChange={uploadAvatar} className="sr-only" />
                </label>
                <p className="mt-4 text-xl font-black text-[var(--foreground)]">{profile.displayName}</p>
                <p className="text-sm text-[var(--muted)]">{profile.roleLabel || "Creator"}</p>
              </div>

              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <Input value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} placeholder="Nome pubblico" />
                  <Input value={profile.roleLabel ?? ""} onChange={(e) => setProfile({ ...profile, roleLabel: e.target.value })} placeholder="Ruolo: fotografo, videomaker…" />
                  <Input value={normalizeSocialInput(profile.instagramUrl ?? "")} onChange={(e) => setProfile({ ...profile, instagramUrl: e.target.value })} placeholder="Instagram, es. @nome" />
                  <Input value={profile.tiktokUrl ?? ""} onChange={(e) => setProfile({ ...profile, tiktokUrl: e.target.value })} placeholder="TikTok / profilo" />
                  <Input value={profile.youtubeUrl ?? ""} onChange={(e) => setProfile({ ...profile, youtubeUrl: e.target.value })} placeholder="YouTube / canale" />
                  <Input value={profile.websiteUrl ?? ""} onChange={(e) => setProfile({ ...profile, websiteUrl: e.target.value })} placeholder="Portfolio / sito" />
                  <Input value={profile.email ?? ""} onChange={(e) => setProfile({ ...profile, email: e.target.value })} placeholder="Email contatto" />
                  <Input value={profile.primaryColor ?? ""} onChange={(e) => setProfile({ ...profile, primaryColor: e.target.value })} placeholder="Colore profilo #A855F7" />
                </div>
                <textarea value={profile.bio ?? ""} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} placeholder="Bio breve, stile contenuti, disponibilità…" className="min-h-24 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]" />
                <div className="flex flex-wrap gap-3 text-xs font-bold text-[var(--foreground)]">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={profile.showInstagram} onChange={(e) => setProfile({ ...profile, showInstagram: e.target.checked })} /> Mostra Instagram</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={profile.showTikTok} onChange={(e) => setProfile({ ...profile, showTikTok: e.target.checked })} /> Mostra TikTok</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={profile.showYoutube} onChange={(e) => setProfile({ ...profile, showYoutube: e.target.checked })} /> Mostra YouTube</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={profile.showEmail} onChange={(e) => setProfile({ ...profile, showEmail: e.target.checked })} /> Mostra email</label>
                </div>
                <Button type="button" onClick={saveProfile} disabled={savingProfile}><Save size={16} className="mr-2" /> {savingProfile ? "Salvataggio…" : "Salva profilo"}</Button>
              </div>
            </div>
          </Card>
        )}

        {data?.assignments && data.assignments.length > 0 && (
          <Card>
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <CalendarDays size={20} />
              </div>
              <CardHeader
                tag="Copertura assegnata"
                title="Il tuo calendario"
                description="Qui trovi solo le partite che devi seguire, con ruolo, orario e campo. Non serve consultare il calendario generale del torneo."
              />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.assignments.map((match) => {
                const when = match.date
                  ? new Intl.DateTimeFormat("it-IT", {
                      weekday: "short",
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(match.date))
                  : "Data da definire";
                return (
                  <div
                    key={match.id}
                    className="rounded-3xl border border-[var(--border)] bg-[var(--card-2)] p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--accent)]">
                        Giornata {match.round}
                      </p>
                      <Badge variant={match.assignmentRole === "VIDEO" ? "default" : "success"}>
                        {match.assignmentRole === "VIDEO" ? "Video" : "Foto"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm font-black text-[var(--foreground)]">
                      {match.homeTeam.name} <span className="text-[var(--muted)]">vs</span> {match.awayTeam.name}
                    </p>
                    <p className="mt-2 text-xs font-bold text-[var(--muted)]">{when}</p>
                    {(match.venueName || match.venueAddress) && (
                      <p className="mt-2 flex items-start gap-1.5 text-xs text-[var(--muted)]">
                        <MapPin size={13} className="mt-0.5 shrink-0" />
                        <span>{match.venueName || match.venueAddress}</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader tag="Upload" title="Nuovo contenuto" description="Carica dal telefono oppure incolla un link già pubblicato su Instagram, TikTok o YouTube." />
            <div className="mt-5 space-y-3">
              <div className="rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--card-2)] p-5 text-center">
                <input id="media-file" type="file" accept="image/*,video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="sr-only" />
                <label htmlFor="media-file" className="mx-auto flex max-w-sm cursor-pointer flex-col items-center gap-3 rounded-3xl px-4 py-5 text-[var(--foreground)]">
                  <UploadCloud size={34} className="text-[var(--accent)]" />
                  <span className="font-black">{file ? file.name : "Scegli foto o video"}</span>
                  <span className="text-xs text-[var(--muted)]">Foto fino a 10 MB, video fino a 75 MB. Per video lunghi usa il link YouTube/TikTok.</span>
                </label>
                {file && <Button type="button" size="sm" variant="secondary" onClick={uploadMediaFile} disabled={uploadingFile}>{uploadingFile ? "Upload…" : "Carica file"}</Button>}
                {fileUrl && <p className="mt-3 break-all text-xs font-bold text-[var(--accent)]">File pronto: {fileUrl}</p>}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Select value={mediaType} onChange={(e) => setMediaType(e.target.value)}>
                  {typeOptions.map(([value, label]) => <option key={value} value={value} className="text-black">{label}</option>)}
                </Select>
                <Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="Oppure link file/YouTube/TikTok" />
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titolo opzionale" />
                <Input value={socialUrl} onChange={(e) => setSocialUrl(e.target.value)} placeholder="Link social pubblicato" />
                <Input value={round} onChange={(e) => setRound(e.target.value.replace(/\D/g, ""))} placeholder="Giornata" inputMode="numeric" />
                <Select value={matchId} onChange={(e) => setMatchId(e.target.value)}>
                  <option value="" className="text-black">Associa a partita…</option>
                  {data?.matches.map((match) => <option key={match.id} value={match.id} className="text-black">G{match.round} · {match.homeTeam.name} - {match.awayTeam.name}</option>)}
                </Select>
                <Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                  <option value="" className="text-black">Tagga squadra…</option>
                  {data?.teams.map((team) => <option key={team.id} value={team.id} className="text-black">{team.name}</option>)}
                </Select>
                <Select value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
                  <option value="" className="text-black">Tagga giocatore…</option>
                  {players.map((player) => <option key={player.id} value={player.id} className="text-black">#{player.number} {player.firstName} {player.lastName} · {player.teamName}</option>)}
                </Select>
              </div>
              <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption, descrizione o note per l'admin…" className="min-h-24 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]" />
              <Button type="button" onClick={submitMedia} disabled={submitting}>{submitting ? "Invio…" : data?.canAdmin ? "Pubblica contenuto" : "Invia in revisione"}</Button>
            </div>
          </Card>

          <Card>
            <CardHeader tag="Archivio" title="I tuoi contenuti" description="Stato dei caricamenti e link rapidi." />
            <div className="mt-5 space-y-3">
              {data?.media.length === 0 && <p className="text-sm text-[var(--muted)]">Non hai ancora caricato contenuti.</p>}
              {data?.media.map((item) => (
                <div key={item.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-3">
                  <div className="flex items-start gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">{item.type === "PHOTO" ? <ImageIcon size={19} /> : <Video size={19} />}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-[var(--foreground)]">{item.title || item.caption || "Contenuto"}</p>
                      <p className="text-xs font-bold text-[var(--muted)]">{statusLabels[item.status] || item.status}</p>
                    </div>
                    <a href={item.fileUrl} target="_blank" rel="noreferrer" className="shrink-0 text-[var(--accent)]"><ExternalLink size={16} /></a>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
