import Link from "next/link";
import { ArrowRight, Play, Youtube } from "lucide-react";
import Card from "src/app/_components/ui/card";
import {
  getYouTubeThumbnailUrl,
  youtubeFeaturedConfig,
  youtubePresentationConfig,
} from "@/modules/videos/application/youtube";

type YouTubeVideoCardProps = {
  leagueId?: string;
  compact?: boolean;
  mode?: "presentation" | "latest";
};

export default function YouTubeVideoCard({
  leagueId,
  compact = false,
  mode = "latest",
}: YouTubeVideoCardProps) {
  const config = mode === "presentation" ? youtubePresentationConfig : youtubeFeaturedConfig;
  const thumbnail = getYouTubeThumbnailUrl(config.url);
  const archiveHref = leagueId ? `/leagues/${leagueId}/videos` : config.channelUrl;
  const label = mode === "presentation" ? "Video presentazione" : "Ultima uscita";

  if (compact) {
    return (
      <Card className="turf-card overflow-hidden !p-0">
        <div className="grid min-w-0 gap-0 sm:grid-cols-[190px_minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)]">
          <a
            href={config.url || config.channelUrl}
            target="_blank"
            rel="noreferrer"
            className="group relative block min-w-0 overflow-hidden bg-black/35"
          >
            {thumbnail ? (
              <img
                src={thumbnail}
                alt={config.title}
                loading="lazy"
                decoding="async"
                className="aspect-video h-full w-full object-cover opacity-90 transition duration-300 group-hover:scale-[1.03] group-hover:opacity-100"
              />
            ) : (
              <div className="grid aspect-video h-full min-h-[116px] place-items-center bg-[radial-gradient(circle_at_30%_20%,rgba(47,107,74,0.42),transparent_35%),linear-gradient(135deg,rgba(20,26,22,0.96),rgba(5,8,6,0.98))]">
                <div className="grid h-12 w-12 place-items-center rounded-full border border-[rgba(210,174,114,0.36)] bg-black/30 text-[var(--accent)]">
                  <Play size={18} fill="currentColor" />
                </div>
              </div>
            )}
            {thumbnail && (
              <>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <div className="absolute inset-0 grid place-items-center">
                  <div className="grid h-11 w-11 place-items-center rounded-full border border-[rgba(210,174,114,0.45)] bg-black/55 text-[var(--accent)] backdrop-blur-sm">
                    <Play size={17} fill="currentColor" />
                  </div>
                </div>
              </>
            )}
          </a>

          <div className="flex min-w-0 flex-col justify-between p-4">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent)]">
                <Youtube size={14} />
                <span>{label}</span>
              </div>
              <h3 className="line-clamp-1 text-xl font-black leading-tight text-[var(--foreground)]">
                {config.title}
              </h3>
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[var(--muted)]">
                {config.subtitle}
              </p>
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <a
                href={config.url || config.channelUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[rgba(210,174,114,0.38)] bg-[linear-gradient(135deg,var(--imperial-green-2),var(--imperial-green))] px-3 py-2 text-xs font-black text-[var(--imperial-text)]"
              >
                Guarda ora <ArrowRight size={14} />
              </a>
              {leagueId && (
                <Link
                  href={archiveHref}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-black/20 px-3 py-2 text-xs font-bold text-[var(--foreground)] transition hover:border-[rgba(210,174,114,0.38)]"
                >
                  Archivio
                </Link>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="turf-card overflow-hidden !p-0">
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--accent)]">
              Cammino TV
            </p>
            <h3 className="mt-1 text-xl font-black text-[var(--foreground)]">{label}</h3>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[rgba(210,174,114,0.32)] bg-[var(--accent-soft)] text-[var(--accent)]">
            <Youtube size={21} />
          </div>
        </div>

        <a
          href={config.url || config.channelUrl}
          target="_blank"
          rel="noreferrer"
          className="group relative block overflow-hidden rounded-[22px] border border-[rgba(210,174,114,0.24)] bg-black/35"
        >
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={config.title}
              loading="lazy"
              decoding="async"
              className="aspect-video w-full object-cover opacity-90 transition duration-300 group-hover:scale-[1.03] group-hover:opacity-100"
            />
          ) : (
            <div className="grid aspect-video place-items-center bg-[radial-gradient(circle_at_30%_20%,rgba(47,107,74,0.42),transparent_35%),linear-gradient(135deg,rgba(20,26,22,0.96),rgba(5,8,6,0.98))]">
              <div className="text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-[rgba(210,174,114,0.36)] bg-black/30 text-[var(--accent)]">
                  <Play size={22} fill="currentColor" />
                </div>
                <p className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-[var(--muted)]">
                  Video in arrivo
                </p>
              </div>
            </div>
          )}
          {thumbnail && (
            <>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <div className="absolute inset-0 grid place-items-center">
                <div className="grid h-16 w-16 place-items-center rounded-full border border-[rgba(210,174,114,0.45)] bg-black/55 text-[var(--accent)] shadow-[0_0_26px_rgba(181,43,32,0.22)] backdrop-blur-sm">
                  <Play size={25} fill="currentColor" />
                </div>
              </div>
            </>
          )}
        </a>

        <h4 className="mt-4 line-clamp-2 text-lg font-black leading-tight text-[var(--foreground)]">
          {config.title}
        </h4>
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[var(--muted)]">
          {config.subtitle}
        </p>
      </div>
    </Card>
  );
}
