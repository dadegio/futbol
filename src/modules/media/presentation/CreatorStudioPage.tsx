"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CalendarDays, Camera, CheckCircle2, Clock3, ExternalLink, Image as ImageIcon, MapPin, Settings2, UploadCloud, Video } from "lucide-react";
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

export default function CreatorStudioPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { user, loading: authLoading } = useAuth();
  const canCreate = useCanCreateMedia(leagueId);
  const router = useRouter();
  const [data, setData] = useState<StudioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

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
  const profile = data?.profile ?? null;
  const assignmentGroups = useMemo(() => {
    const groups = new Map<string, { title: string; matches: CreatorAssignmentMatch[] }>();
    for (const match of data?.assignments ?? []) {
      const parsed = match.date ? new Date(match.date) : null;
      const valid = parsed && !Number.isNaN(parsed.getTime());
      const key = valid ? parsed.toISOString().slice(0, 10) : `round-${match.round}`;
      const title = valid
        ? new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "2-digit", month: "long" }).format(parsed)
        : "Data da definire";
      const existing = groups.get(key);
      if (existing) existing.matches.push(match);
      else groups.set(key, { title, matches: [match] });
    }
    return [...groups.values()];
  }, [data?.assignments]);
  const upcomingAssignments = useMemo(
    () => (data?.assignments ?? []).filter((match) => !match.date || new Date(match.slotEnd ?? match.date).getTime() >= Date.now()).length,
    [data?.assignments]
  );

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
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent)]">{data?.canAdmin ? "Media upload" : "Creator workspace"}</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] text-[var(--foreground)]">{data?.canAdmin ? "Carica contenuti" : "I miei incarichi"}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
                {data?.canAdmin
                  ? "Carica o collega contenuti del torneo dal Media Center."
                  : "Il calendario operativo mostra soltanto le partite che devi seguire. Da qui puoi vedere ruolo, orario, campo e caricare subito il materiale della gara."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {user?.role === "CREATOR" && (
                <Link href={`/leagues/${leagueId}/creator/profile`}>
                  <Button type="button" variant="secondary"><Settings2 size={16} className="mr-2" /> Il mio profilo</Button>
                </Link>
              )}
              <Link href={`/leagues/${leagueId}/media`}>
                <Button type="button" variant="secondary"><Camera size={16} className="mr-2" /> Media Center</Button>
              </Link>
            </div>
          </div>
        </Card>

        {err && <Badge variant="error">{err}</Badge>}
        {msg && <Badge variant="success"><CheckCircle2 size={16} /> {msg}</Badge>}
        {loading && <p className="text-sm text-[var(--muted)]">Caricamento…</p>}

        {data?.assignments && data.assignments.length > 0 ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="!p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Incarichi totali</p>
                <p className="mt-2 text-3xl font-black text-[var(--foreground)]">{data.assignments.length}</p>
              </Card>
              <Card className="!p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Da svolgere</p>
                <p className="mt-2 text-3xl font-black text-[var(--foreground)]">{upcomingAssignments}</p>
              </Card>
              <Card className="!p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Il tuo ruolo</p>
                <p className="mt-2 truncate text-lg font-black text-[var(--foreground)]">{profile?.roleLabel || "Creator"}</p>
              </Card>
            </div>

            {assignmentGroups.map((group) => (
              <section key={group.title}>
                <div className="mb-3 flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                    <CalendarDays size={17} />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--accent)]">Agenda</p>
                    <h2 className="capitalize text-lg font-black text-[var(--foreground)]">{group.title}</h2>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  {group.matches.map((match) => {
                    const parsed = match.date ? new Date(match.date) : null;
                    const time = parsed && !Number.isNaN(parsed.getTime())
                      ? new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(parsed)
                      : "Da definire";
                    const roleIsVideo = match.assignmentRole === "VIDEO";
                    return (
                      <article key={match.id} className="overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--card)] shadow-[0_12px_34px_rgba(0,0,0,0.06)]">
                        <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--card-2)] px-5 py-3">
                          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Giornata {match.round}</span>
                          <span className={[
                            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em]",
                            roleIsVideo ? "bg-violet-500/12 text-violet-300" : "bg-amber-500/12 text-amber-300",
                          ].join(" ")}>
                            {roleIsVideo ? <Video size={12} /> : <Camera size={12} />}
                            {roleIsVideo ? "Video" : "Foto"}
                          </span>
                        </div>

                        <div className="p-5">
                          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                            <CreatorTeam team={match.homeTeam} />
                            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--muted)]">vs</span>
                            <CreatorTeam team={match.awayTeam} align="right" />
                          </div>

                          <div className="mt-5 grid gap-2 text-xs font-bold text-[var(--muted)] sm:grid-cols-2">
                            <p className="flex items-center gap-2 rounded-2xl bg-[var(--card-2)] px-3 py-2.5">
                              <Clock3 size={14} className="text-[var(--accent)]" /> {time}
                            </p>
                            <p className="flex min-w-0 items-center gap-2 rounded-2xl bg-[var(--card-2)] px-3 py-2.5">
                              <MapPin size={14} className="shrink-0 text-[var(--accent)]" />
                              <span className="truncate">{match.venueName || match.venueAddress || "Campo da definire"}</span>
                            </p>
                          </div>

                          <div className="mt-4 flex justify-end">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                setMatchId(match.id);
                                setRound(String(match.round));
                                document.getElementById("creator-upload")?.scrollIntoView({ behavior: "smooth", block: "start" });
                              }}
                            >
                              <UploadCloud size={14} className="mr-2" /> Carica materiale
                            </Button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : !loading && user?.role === "CREATOR" ? (
          <Card>
            <CardHeader tag="Agenda" title="Nessun incarico assegnato" description="Quando l'admin assegna una partita, comparirà qui con ruolo, ora e campo." />
          </Card>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <Card id="creator-upload">
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


function CreatorTeam({
  team,
  align = "left",
}: {
  team: { id: string; name: string; badgeUrl: string | null };
  align?: "left" | "right";
}) {
  return (
    <div className={["min-w-0", align === "right" ? "text-right" : "text-left"].join(" ")}>
      <div className={["flex items-center gap-2.5", align === "right" ? "flex-row-reverse" : ""].join(" ")}>
        {team.badgeUrl ? (
          <img src={team.badgeUrl} alt="" className="h-11 w-11 shrink-0 rounded-2xl object-contain" loading="lazy" decoding="async" />
        ) : (
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-xs font-black text-[var(--accent)]">
            {team.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <span className="min-w-0 text-sm font-black leading-tight text-[var(--foreground)]">{team.name}</span>
      </div>
    </div>
  );
}
