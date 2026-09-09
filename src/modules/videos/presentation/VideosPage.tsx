import Link from "next/link";
import { ArrowLeft, ExternalLink, ListVideo, Play, Youtube } from "lucide-react";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card from "src/app/_components/ui/card";
import {
  fetchYouTubePlaylistVideos,
  getYouTubePlaylistEmbedUrl,
  getYouTubePlaylistId,
  getYouTubeVideoEmbedUrl,
  youtubePlaylistConfig,
} from "@/modules/videos/application/youtube";

type VideosPageProps = {
  params: Promise<{ leagueId: string }>;
  searchParams?: Promise<{ v?: string }>;
};

function formatDate(value: string | null) {
  if (!value) return "Video playlist";

  try {
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "Video playlist";
  }
}

export default async function VideosPage({ params, searchParams }: VideosPageProps) {
  const { leagueId } = await params;
  const sp = searchParams ? await searchParams : {};
  const playlistInput = youtubePlaylistConfig.id || youtubePlaylistConfig.url;
  const playlistId = getYouTubePlaylistId(playlistInput);
  const videos = await fetchYouTubePlaylistVideos(playlistId);
  const selectedVideo = videos.find((video) => video.id === sp.v) || videos[0] || null;
  const selectedEmbedUrl = selectedVideo ? getYouTubeVideoEmbedUrl(selectedVideo.id) : null;
  const playlistEmbedUrl = getYouTubePlaylistEmbedUrl(playlistInput);
  const playerUrl = selectedEmbedUrl || playlistEmbedUrl;

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="w-full space-y-6 pb-8">
        <header className="pt-2">
          <Link href={`/leagues/${leagueId}`} className="mb-8 flex items-center gap-3 text-sm text-[var(--muted)]">
            <ArrowLeft size={16} />
            <span>Overview torneo</span>
          </Link>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--accent)]">Cammino TV</p>
              <h1 className="imperial-title mt-2 break-words text-4xl font-black text-[var(--foreground)] sm:text-6xl">
                Archivio video
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
                Player a sinistra e lista completa dei video della playlist ufficiale a destra.
              </p>
            </div>

            <a
              href={youtubePlaylistConfig.url || youtubePlaylistConfig.channelUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[rgba(210,174,114,0.38)] bg-[linear-gradient(135deg,var(--imperial-green-2),var(--imperial-green))] px-4 py-2 text-sm font-black text-[var(--imperial-text)]"
            >
              <Youtube size={17} />
              Apri playlist
              <ExternalLink size={15} />
            </a>
          </div>
        </header>

        <Card className="turf-card overflow-hidden !p-0">
          <div className="grid min-w-0 gap-0 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
            <section className="min-w-0 border-b border-[rgba(210,174,114,0.18)] xl:border-b-0 xl:border-r">
              <div className="border-b border-[rgba(210,174,114,0.18)] p-5 sm:p-6">
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-[var(--accent)]">
                  <Play size={15} fill="currentColor" />
                  In riproduzione
                </p>
                <h2 className="mt-2 text-2xl font-black leading-tight text-[var(--foreground)] sm:text-3xl">
                  {selectedVideo?.title || youtubePlaylistConfig.title}
                </h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {selectedVideo ? formatDate(selectedVideo.publishedAt) : youtubePlaylistConfig.subtitle}
                </p>
              </div>

              {playerUrl ? (
                <iframe
                  className="aspect-video w-full bg-black"
                  src={playerUrl}
                  title={selectedVideo?.title || youtubePlaylistConfig.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <div className="grid aspect-video place-items-center bg-[radial-gradient(circle_at_30%_20%,rgba(47,107,74,0.42),transparent_35%),linear-gradient(135deg,rgba(20,26,22,0.96),rgba(5,8,6,0.98))] p-6 text-center">
                  <div>
                    <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-[rgba(210,174,114,0.36)] bg-black/30 text-[var(--accent)]">
                      <Play size={30} fill="currentColor" />
                    </div>
                    <h3 className="mt-4 text-xl font-black text-[var(--foreground)]">Configura la playlist</h3>
                    <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-[var(--muted)]">
                      Aggiungi <code className="text-[var(--foreground)]">NEXT_PUBLIC_YOUTUBE_PLAYLIST_ID</code> oppure <code className="text-[var(--foreground)]">NEXT_PUBLIC_YOUTUBE_PLAYLIST_URL</code> nel file <code className="text-[var(--foreground)]">.env</code>.
                    </p>
                  </div>
                </div>
              )}
            </section>

            <aside className="flex min-h-0 flex-col bg-black/10">
              <div className="border-b border-[rgba(210,174,114,0.18)] p-5">
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-[var(--accent)]">
                  <ListVideo size={15} />
                  Playlist ufficiale
                </p>
                <h3 className="mt-2 text-xl font-black text-[var(--foreground)]">
                  {youtubePlaylistConfig.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
                  {videos.length ? `${videos.length} video disponibili` : youtubePlaylistConfig.subtitle}
                </p>
              </div>

              {videos.length ? (
                <div className="max-h-[620px] overflow-y-auto p-3">
                  <div className="space-y-2">
                    {videos.map((video, index) => {
                      const isActive = selectedVideo?.id === video.id;

                      return (
                        <Link
                          key={video.id}
                          href={`/leagues/${leagueId}/videos?v=${video.id}`}
                          className={`group grid min-w-0 grid-cols-[96px_minmax(0,1fr)] gap-3 rounded-[20px] border p-2 transition sm:grid-cols-[112px_minmax(0,1fr)] ${
                            isActive
                              ? "border-[rgba(210,174,114,0.48)] bg-[rgba(210,174,114,0.10)]"
                              : "border-transparent hover:border-[rgba(210,174,114,0.22)] hover:bg-white/[0.03]"
                          }`}
                        >
                          <div className="relative overflow-hidden rounded-2xl bg-black/35">
                            <img
                              src={video.thumbnailUrl}
                              alt={video.title}
                              className="aspect-video w-full object-cover opacity-90 transition group-hover:scale-[1.03] group-hover:opacity-100"
                            />
                            <div className="absolute inset-0 grid place-items-center bg-black/15">
                              <div className="grid h-8 w-8 place-items-center rounded-full border border-[rgba(210,174,114,0.38)] bg-black/45 text-[var(--accent)] backdrop-blur-sm">
                                <Play size={13} fill="currentColor" />
                              </div>
                            </div>
                          </div>

                          <div className="min-w-0 py-1">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">
                              #{String(index + 1).padStart(2, "0")} · {formatDate(video.publishedAt)}
                            </p>
                            <h4 className="mt-1 line-clamp-2 text-sm font-black leading-snug text-[var(--foreground)]">
                              {video.title}
                            </h4>
                            {isActive && (
                              <p className="mt-1 text-[11px] font-bold text-[var(--accent)]">In riproduzione</p>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 p-5 text-sm leading-relaxed text-[var(--muted)]">
                  <p>
                    Il player usa direttamente la playlist. L&apos;elenco laterale
                    non è disponibile finché YouTube non restituisce il feed
                    pubblico.
                  </p>
                  <a
                    href={youtubePlaylistConfig.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 font-black text-[var(--accent)]"
                  >
                    Apri tutti i video su YouTube
                    <ExternalLink size={14} />
                  </a>
                </div>
              )}
            </aside>
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
