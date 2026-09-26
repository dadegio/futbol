"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Camera, ExternalLink, Filter, Image as ImageIcon, Instagram, Mail, Play, Search, UploadCloud, UserRound, Video } from "lucide-react";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card, { CardHeader } from "src/app/_components/ui/card";
import Badge from "src/app/_components/ui/badge";
import Button from "src/app/_components/ui/button";
import { useCanCreateMedia } from "@/lib/client-auth";
import { cachedJson } from "@/modules/core/client-cache";

type MediaItem = {
  id: string;
  type: "PHOTO" | "VIDEO" | "REEL" | "HIGHLIGHT" | "INTERVIEW" | "BACKSTAGE" | "OTHER";
  status: string;
  featured: boolean;
  title: string | null;
  caption: string | null;
  fileUrl: string;
  thumbnailUrl: string | null;
  socialUrl: string | null;
  matchId: string | null;
  teamId: string | null;
  playerId: string | null;
  round: number | null;
  creditName: string | null;
  creditInstagram: string | null;
  creditEmail: string | null;
  showCreditEmail: boolean;
  createdAt: string;
  creator: {
    id: string;
    displayName: string;
    roleLabel: string | null;
    avatarUrl: string | null;
    instagramUrl: string | null;
    tiktokUrl: string | null;
    youtubeUrl: string | null;
    email: string | null;
    showEmail: boolean;
    showInstagram: boolean;
    showTikTok: boolean;
    showYoutube: boolean;
  } | null;
};

type Creator = {
  id: string;
  displayName: string;
  roleLabel: string | null;
  avatarUrl: string | null;
  bio: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  youtubeUrl: string | null;
  email: string | null;
  showEmail: boolean;
  _count?: { mediaItems: number };
};

type League = { id: string; name: string };

const typeLabels: Record<MediaItem["type"], string> = {
  PHOTO: "Foto",
  VIDEO: "Video",
  REEL: "Reel",
  HIGHLIGHT: "Highlights",
  INTERVIEW: "Intervista",
  BACKSTAGE: "Backstage",
  OTHER: "Altro",
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isVideo(item: MediaItem) {
  return ["VIDEO", "REEL", "HIGHLIGHT", "INTERVIEW"].includes(item.type) || /\.(mp4|webm|mov)(\?|$)/i.test(item.fileUrl);
}

function canPlayVideo(item: MediaItem) {
  return /\.(mp4|webm|mov)(\?|$)/i.test(item.fileUrl) || item.fileUrl.startsWith("/media/");
}

function getCredit(item: MediaItem) {
  if (item.creditName) return item.creditName;
  return item.creator?.displayName ?? "Creator";
}

export default function LeagueMediaPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const canCreate = useCanCreateMedia(leagueId);
  const [league, setLeague] = useState<League | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [creatorFilter, setCreatorFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [activeItem, setActiveItem] = useState<MediaItem | null>(null);

  useEffect(() => {
    if (!leagueId) return;
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const [leagueData, mediaRes, creatorsRes] = await Promise.all([
          cachedJson<League>(`/api/leagues/${leagueId}`, { ttlMs: 30_000, fallbackMessage: "Errore caricamento torneo" }),
          fetch(`/api/leagues/${leagueId}/media`, { cache: "no-store" }),
          fetch(`/api/leagues/${leagueId}/creators`, { cache: "no-store" }),
        ]);
        const mediaData = await mediaRes.json().catch(() => ({}));
        const creatorsData = await creatorsRes.json().catch(() => ({}));
        if (!mediaRes.ok) throw new Error(mediaData?.error ?? "Errore caricamento media");
        if (!creatorsRes.ok) throw new Error(creatorsData?.error ?? "Errore caricamento creator");
        setLeague(leagueData);
        setMedia(Array.isArray(mediaData) ? mediaData : []);
        setCreators(Array.isArray(creatorsData) ? creatorsData : []);
      } catch (error) {
        setErr(getErrorMessage(error, "Errore caricamento Media Center"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [leagueId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("it");
    return media.filter((item) => {
      if (typeFilter !== "ALL" && item.type !== typeFilter) return false;
      if (creatorFilter !== "ALL" && item.creator?.id !== creatorFilter) return false;
      if (!needle) return true;
      const haystack = [item.title, item.caption, item.creditName, item.creator?.displayName, item.type].filter(Boolean).join(" ").toLocaleLowerCase("it");
      return haystack.includes(needle);
    });
  }, [media, typeFilter, creatorFilter, query]);

  const featured = filtered.filter((item) => item.featured).slice(0, 3);

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="space-y-5 pb-8">
        <Card className="overflow-hidden !rounded-none !border-x-0 !border-t-0 !bg-transparent !p-0">
          <div className="relative overflow-hidden px-5 py-7 md:px-8 md:py-9">
            <div className="absolute inset-0 border-b border-[var(--border-strong)]" />
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <CardHeader
                tag="Media Center"
                title="Foto, video e contenuti del torneo"
                description={league ? `Archivio ufficiale dei contenuti creator di ${league.name}.` : "Archivio ufficiale dei contenuti creator del torneo."}
                level={1}
              />
              {canCreate && (
                <Link href={`/leagues/${leagueId}/creator`}>
                  <Button type="button"><UploadCloud size={17} className="mr-2" /> Carica contenuti</Button>
                </Link>
              )}
            </div>
          </div>
        </Card>

        {err && <Badge variant="error">{err}</Badge>}

        <Card className="!rounded-none !border-x-0 !bg-transparent !p-0 !py-4">
          <div className="grid gap-3 lg:grid-cols-[1.2fr_180px_220px]">
            <label className="flex items-center gap-2 rounded-[5px] border border-[var(--border)] bg-transparent px-3">
              <Search size={17} className="text-[var(--muted)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cerca caption, creator, contenuto…"
                className="min-h-11 min-w-0 flex-1 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
              />
            </label>
            <label className="flex items-center gap-2 rounded-[5px] border border-[var(--border)] bg-transparent px-3">
              <Filter size={16} className="text-[var(--muted)]" />
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="min-h-11 min-w-0 flex-1 bg-transparent text-sm font-bold text-[var(--foreground)] outline-none">
                <option value="ALL" className="text-black">Tutti i formati</option>
                {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value} className="text-black">{label}</option>)}
              </select>
            </label>
            <select value={creatorFilter} onChange={(event) => setCreatorFilter(event.target.value)} className="min-h-11 rounded-[5px] border border-[var(--border)] bg-transparent px-3 text-sm font-bold text-[var(--foreground)] outline-none">
              <option value="ALL" className="text-black">Tutti i creator</option>
              {creators.map((creator) => <option key={creator.id} value={creator.id} className="text-black">{creator.displayName}</option>)}
            </select>
          </div>
        </Card>

        {creators.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {creators.map((creator) => (
              <Link key={creator.id} href={`/leagues/${leagueId}/creators/${creator.id}`} className="flex min-w-[210px] items-center gap-3 border-b border-[var(--border)] bg-transparent px-1 py-3 transition hover:border-[var(--accent)]">
                {creator.avatarUrl ? <img src={creator.avatarUrl} alt="" loading="lazy" decoding="async" className="h-12 w-12 rounded-2xl object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><UserRound size={20} /></div>}
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-[var(--foreground)]">{creator.displayName}</p>
                  <p className="truncate text-xs text-[var(--muted)]">{creator.roleLabel || "Creator"}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {featured.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-[var(--accent)]">In evidenza</h2>
            <div className="grid gap-4 lg:grid-cols-3">
              {featured.map((item) => <MediaCard key={item.id} item={item} leagueId={leagueId} onOpen={() => setActiveItem(item)} featured />)}
            </div>
          </section>
        )}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><Skeleton /><Skeleton /><Skeleton /></div>
        ) : filtered.length === 0 ? (
          <Card className="py-12 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl border border-[var(--border)] bg-[var(--card-2)] text-[var(--muted)]"><Camera size={28} /></div>
            <h2 className="mt-4 text-xl font-black text-[var(--foreground)]">Nessun contenuto pubblicato</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">Quando un creator carica e l'admin approva foto o video, li troverai in questa pagina.</p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => <MediaCard key={item.id} item={item} leagueId={leagueId} onOpen={() => setActiveItem(item)} />)}
          </div>
        )}

        {activeItem && <MediaModal item={activeItem} onClose={() => setActiveItem(null)} />}
      </div>
    </DashboardShell>
  );
}

function MediaCard({ item, leagueId, onOpen, featured = false }: { item: MediaItem; leagueId: string; onOpen: () => void; featured?: boolean }) {
  const video = isVideo(item);
  return (
    <article className="overflow-hidden rounded-[6px] border border-[var(--border)] bg-[var(--card)]">
      <button type="button" onClick={onOpen} className="group relative block aspect-[4/5] w-full overflow-hidden bg-black text-left">
        {video ? (
          item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover opacity-80 transition group-hover:scale-[1.02]" /> : <div className="grid h-full place-items-center bg-[var(--card-2)] text-[var(--accent)]"><Video size={44} /></div>
        ) : (
          <img src={item.thumbnailUrl || item.fileUrl} alt={item.title || item.caption || "Contenuto media"} loading="lazy" decoding="async" className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
        )}
        {video && <span className="absolute inset-0 grid place-items-center"><span className="grid h-16 w-16 place-items-center rounded-full bg-black/55 text-white backdrop-blur"><Play size={28} fill="currentColor" /></span></span>}
        <span className="absolute left-3 top-3 rounded-[3px] bg-black/65 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white">{typeLabels[item.type]}</span>
        {featured && <span className="absolute right-3 top-3 rounded-[3px] bg-yellow-300 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-black">Top</span>}
      </button>
      <div className="p-4">
        <h3 className="line-clamp-2 text-lg font-black tracking-[-0.04em] text-[var(--foreground)]">{item.title || item.caption || "Contenuto dal campo"}</h3>
        {item.caption && item.title && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--muted)]">{item.caption}</p>}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
          <div className="flex min-w-0 items-center gap-2">
            {item.creator?.avatarUrl ? <img src={item.creator.avatarUrl} alt="" loading="lazy" decoding="async" className="h-9 w-9 rounded-xl object-cover" /> : <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><UserRound size={16} /></div>}
            <div className="min-w-0">
              <p className="truncate text-xs font-black text-[var(--foreground)]">{getCredit(item)}</p>
              <p className="truncate text-[11px] text-[var(--muted)]">{item.round ? `Giornata ${item.round}` : item.creator?.roleLabel || "Creator"}</p>
            </div>
          </div>
          {item.creator && <Link href={`/leagues/${leagueId}/creators/${item.creator.id}`} className="shrink-0 text-xs font-black text-[var(--accent)]">Profilo</Link>}
        </div>
      </div>
    </article>
  );
}

function MediaModal({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  const video = isVideo(item);
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <button type="button" aria-label="Chiudi" onClick={onClose} className="absolute inset-0" />
      <div className="relative max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[8px] border border-white/15 bg-[var(--card)]">
        <button type="button" onClick={onClose} className="absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-[3px] bg-black/65 text-xl font-black text-white">×</button>
        <div className="grid max-h-[90vh] lg:grid-cols-[minmax(0,1.4fr)_360px]">
          <div className="grid min-h-[320px] place-items-center bg-black">
            {video && canPlayVideo(item) ? <video src={item.fileUrl} controls playsInline className="max-h-[86vh] w-full" /> : video ? <a href={item.fileUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-black"><ExternalLink size={16} /> Apri video</a> : <img src={item.fileUrl} alt="" loading="eager" decoding="async" className="max-h-[86vh] w-full object-contain" />}
          </div>
          <div className="overflow-y-auto p-5">
            <Badge variant="default">{typeLabels[item.type]}</Badge>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.05em] text-[var(--foreground)]">{item.title || "Contenuto dal campo"}</h2>
            {item.caption && <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{item.caption}</p>}
            <div className="mt-5 rounded-[5px] border border-[var(--border)] bg-transparent p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Credits</p>
              <p className="mt-1 text-base font-black text-[var(--foreground)]">{getCredit(item)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.creator?.showInstagram && item.creator.instagramUrl && <a href={item.creator.instagramUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--foreground)]"><Instagram size={14} /> Instagram</a>}
                {item.showCreditEmail && item.creditEmail && <a href={`mailto:${item.creditEmail}`} className="inline-flex items-center gap-1 rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--foreground)]"><Mail size={14} /> Email</a>}
                {item.creator?.showEmail && item.creator.email && <a href={`mailto:${item.creator.email}`} className="inline-flex items-center gap-1 rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--foreground)]"><Mail size={14} /> Email creator</a>}
              </div>
            </div>
            {item.socialUrl && <a href={item.socialUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 text-sm font-black text-black"><ExternalLink size={16} /> Apri contenuto social</a>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return <div className="rounded-[6px] border border-[var(--border)] bg-[var(--card)] p-4"><div className="aspect-[4/5] animate-pulse rounded-3xl bg-white/10" /><div className="mt-4 h-6 w-3/4 animate-pulse rounded bg-white/10" /></div>;
}
