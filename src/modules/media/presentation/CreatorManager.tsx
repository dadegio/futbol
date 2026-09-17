"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Camera, CheckCircle2, EyeOff, ExternalLink, RefreshCw, Star, UserRound, Video } from "lucide-react";
import Card, { CardHeader } from "src/app/_components/ui/card";
import Badge from "src/app/_components/ui/badge";
import Button from "src/app/_components/ui/button";
import Select from "src/app/_components/ui/select";
import { authFetch } from "@/lib/client-auth";
import CreatorAssignmentPlanner from "./CreatorAssignmentPlanner";

type Creator = {
  id: string;
  displayName: string;
  roleLabel: string | null;
  avatarUrl: string | null;
  instagramUrl: string | null;
  email: string | null;
  active: boolean;
  _count?: { mediaItems: number; matchAssignments?: number };
};

type MediaItem = {
  id: string;
  type: "PHOTO" | "VIDEO" | "REEL" | "HIGHLIGHT" | "INTERVIEW" | "BACKSTAGE" | "OTHER";
  status: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "HIDDEN" | "REJECTED";
  featured: boolean;
  title: string | null;
  caption: string | null;
  fileUrl: string;
  thumbnailUrl: string | null;
  socialUrl: string | null;
  createdAt: string;
  creator: { id: string; displayName: string; roleLabel: string | null; avatarUrl: string | null } | null;
};

const statusLabels: Record<MediaItem["status"], string> = {
  DRAFT: "bozza",
  PENDING_REVIEW: "da approvare",
  APPROVED: "pubblicato",
  HIDDEN: "nascosto",
  REJECTED: "rifiutato",
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isVideo(item: MediaItem) {
  return ["VIDEO", "REEL", "HIGHLIGHT", "INTERVIEW"].includes(item.type) || item.fileUrl.match(/\.(mp4|webm|mov)(\?|$)/i);
}

export default function CreatorManager({ leagueId }: { leagueId: string }) {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [creatorsRes, mediaRes] = await Promise.all([
        authFetch(`/api/leagues/${leagueId}/creators`, { cache: "no-store" }),
        authFetch(`/api/leagues/${leagueId}/media?includeAll=1`, { cache: "no-store" }),
      ]);
      const creatorsData = await creatorsRes.json().catch(() => ({}));
      const mediaData = await mediaRes.json().catch(() => ({}));
      if (!creatorsRes.ok) throw new Error(creatorsData?.error ?? "Errore caricamento creator");
      if (!mediaRes.ok) throw new Error(mediaData?.error ?? "Errore caricamento media");
      setCreators(Array.isArray(creatorsData) ? creatorsData : []);
      setMedia(Array.isArray(mediaData) ? mediaData : []);
    } catch (error) {
      setErr(getErrorMessage(error, "Errore caricamento Media Center"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [leagueId]);

  const pending = useMemo(() => media.filter((item) => item.status === "PENDING_REVIEW"), [media]);
  const published = useMemo(() => media.filter((item) => item.status === "APPROVED"), [media]);

  async function updateMedia(item: MediaItem, data: Partial<Pick<MediaItem, "status" | "featured">>) {
    setUpdatingId(item.id);
    setErr(null);
    try {
      const res = await authFetch(`/api/media/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Errore aggiornamento contenuto");
      await load();
    } catch (error) {
      setErr(getErrorMessage(error, "Errore aggiornamento contenuto"));
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <CardHeader
          tag="Creator"
          title="Media Center"
          description="Profili creator e contenuti caricati da fotografi, videomaker e social media manager del torneo."
        />
        <div className="flex flex-wrap gap-2">
          <Link href={`/leagues/${leagueId}/creator`}><Button type="button" size="sm" variant="secondary"><Camera size={15} className="mr-1" /> Studio creator</Button></Link>
          <Button type="button" size="sm" variant="secondary" onClick={load} disabled={loading}><RefreshCw size={15} className="mr-1" /> Aggiorna</Button>
        </div>
      </div>

      {err && <div className="mt-4"><Badge variant="error">{err}</Badge></div>}

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <MiniStat label="Creator" value={creators.length} />
        <MiniStat label="Da approvare" value={pending.length} />
        <MiniStat label="Pubblicati" value={published.length} />
      </div>

      <CreatorAssignmentPlanner leagueId={leagueId} />

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--card-2)] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-black uppercase tracking-[0.14em] text-[var(--foreground)]">Creator del torneo</h3>
            <span className="text-xs text-[var(--muted)]">creali da Utenti</span>
          </div>
          {loading ? <p className="text-sm text-[var(--muted)]">Caricamento…</p> : creators.length === 0 ? (
            <p className="text-sm leading-relaxed text-[var(--muted)]">Crea un utente con ruolo Creator: qui comparirà il suo profilo e potrà caricare foto/video dal proprio Studio.</p>
          ) : (
            <div className="space-y-2">
              {creators.map((creator) => (
                <div key={creator.id} className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
                  {creator.avatarUrl ? <img src={creator.avatarUrl} alt="" loading="lazy" decoding="async" className="h-12 w-12 rounded-2xl object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><UserRound size={20} /></div>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-[var(--foreground)]">{creator.displayName}</p>
                    <p className="truncate text-xs text-[var(--muted)]">{creator.roleLabel || "Creator"} · {creator._count?.mediaItems ?? 0} contenuti · {creator._count?.matchAssignments ?? 0} partite</p>
                  </div>
                  {!creator.active && <Badge variant="default">off</Badge>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--card-2)] p-4">
          <h3 className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-[var(--foreground)]">Revisione contenuti</h3>
          {loading ? <p className="text-sm text-[var(--muted)]">Caricamento…</p> : media.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Nessun contenuto caricato.</p>
          ) : (
            <div className="space-y-3">
              {media.slice(0, 12).map((item) => (
                <article key={item.id} className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 md:grid-cols-[112px_1fr]">
                  <div className="relative aspect-video overflow-hidden rounded-2xl border border-[var(--border)] bg-black/25">
                    {isVideo(item) ? (
                      <div className="grid h-full place-items-center text-[var(--accent)]"><Video size={26} /></div>
                    ) : (
                      <img src={item.thumbnailUrl || item.fileUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    )}
                    {item.featured && <span className="absolute right-2 top-2 rounded-full bg-yellow-300 px-2 py-1 text-[10px] font-black text-black">TOP</span>}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-black text-[var(--foreground)]">{item.title || "Senza titolo"}</p>
                      <Badge variant={item.status === "APPROVED" ? "success" : item.status === "REJECTED" ? "error" : "default"}>{statusLabels[item.status]}</Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-[var(--muted)]">{item.creator?.displayName || "Creator"}</p>
                    {item.caption && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--muted)]">{item.caption}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Select value={item.status} onChange={(event) => updateMedia(item, { status: event.target.value as MediaItem["status"] })} disabled={updatingId === item.id} className="h-9 min-w-[155px]">
                        {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value} className="text-black">{label}</option>)}
                      </Select>
                      <Button type="button" size="sm" variant="secondary" onClick={() => updateMedia(item, { featured: !item.featured })} disabled={updatingId === item.id}>
                        <Star size={14} className="mr-1" /> {item.featured ? "Togli top" : "In evidenza"}
                      </Button>
                      {item.fileUrl && <a href={item.fileUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1 rounded-xl border border-[var(--border)] px-3 text-xs font-bold text-[var(--muted)]"><ExternalLink size={14} /> Apri</a>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-black text-[var(--foreground)]">{value}</p>
    </div>
  );
}
