export type YouTubeVideoConfig = {
  title: string;
  subtitle: string;
  url: string;
  channelUrl: string;
};

export type YouTubePlaylistConfig = {
  title: string;
  subtitle: string;
  url: string;
  id: string;
  channelUrl: string;
};

export type YouTubePlaylistVideo = {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  publishedAt: string | null;
};

const OFFICIAL_PRESENTATION_VIDEO_URL = "https://www.youtube.com/watch?v=pYVsgPBBwEM";
const OFFICIAL_PLAYLIST_URL =
  "https://www.youtube.com/playlist?list=PLYTJHd2_3eRk";

const channelUrl =
  process.env.NEXT_PUBLIC_YOUTUBE_CHANNEL_URL || "https://www.youtube.com/@camminoimperiale";

export const youtubePresentationConfig: YouTubeVideoConfig = {
  title:
    process.env.NEXT_PUBLIC_PRESENTATION_VIDEO_TITLE ||
    "Presentazione Cammino Imperiale",
  subtitle:
    process.env.NEXT_PUBLIC_PRESENTATION_VIDEO_SUBTITLE ||
    "Il video ufficiale di presentazione del torneo.",
  url:
    process.env.NEXT_PUBLIC_PRESENTATION_VIDEO_URL ||
    process.env.NEXT_PUBLIC_FEATURED_VIDEO_URL ||
    OFFICIAL_PRESENTATION_VIDEO_URL,
  channelUrl,
};

export const youtubeFeaturedConfig: YouTubeVideoConfig = {
  title:
    process.env.NEXT_PUBLIC_FEATURED_VIDEO_TITLE ||
    "Ultima uscita Cammino Imperiale",
  subtitle:
    process.env.NEXT_PUBLIC_FEATURED_VIDEO_SUBTITLE ||
    "Highlights, replay e contenuti ufficiali del torneo.",
  url: process.env.NEXT_PUBLIC_FEATURED_VIDEO_URL || OFFICIAL_PRESENTATION_VIDEO_URL,
  channelUrl,
};

// Alias mantenuto per compatibilità con eventuali componenti già esistenti.
export const youtubeConfig = youtubeFeaturedConfig;

export const youtubePlaylistConfig: YouTubePlaylistConfig = {
  title:
    process.env.NEXT_PUBLIC_YOUTUBE_PLAYLIST_TITLE ||
    "Archivio video ufficiale",
  subtitle:
    process.env.NEXT_PUBLIC_YOUTUBE_PLAYLIST_SUBTITLE ||
    "Tutti gli highlights, i replay e le clip pubblicate nella playlist ufficiale.",
  url:
    process.env.NEXT_PUBLIC_YOUTUBE_PLAYLIST_URL ||
    OFFICIAL_PLAYLIST_URL,
  id:
    getYouTubePlaylistId(
      process.env.NEXT_PUBLIC_YOUTUBE_PLAYLIST_ID ||
        process.env.NEXT_PUBLIC_YOUTUBE_PLAYLIST_URL ||
        OFFICIAL_PLAYLIST_URL
    ) || "",
  channelUrl,
};

export function getYouTubeId(url: string) {
  if (!url) return null;

  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replace("/", "") || null;
    }

    if (parsed.searchParams.get("v")) {
      return parsed.searchParams.get("v");
    }

    const embedMatch = parsed.pathname.match(/\/embed\/([^/?#]+)/);
    if (embedMatch?.[1]) return embedMatch[1];

    const shortsMatch = parsed.pathname.match(/\/shorts\/([^/?#]+)/);
    if (shortsMatch?.[1]) return shortsMatch[1];
  } catch {
    return null;
  }

  return null;
}

export function getYouTubeEmbedUrl(url: string) {
  const id = getYouTubeId(url);
  return id ? getYouTubeVideoEmbedUrl(id) : null;
}

export function getYouTubeVideoEmbedUrl(id: string) {
  return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
}

export function getYouTubeWatchUrl(id: string) {
  return id ? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}` : "";
}

export function getYouTubeThumbnailUrl(url: string) {
  const id = getYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

export function getYouTubeThumbnailFromId(id: string) {
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : "";
}

export function getYouTubePlaylistId(input: string) {
  if (!input) return null;
  const value = input.trim();

  // Accetta anche un ID copiato insieme ai parametri "&si=...".
  if (!/^https?:\/\//i.test(value)) {
    const directId = value.split(/[?&]/, 1)[0]?.trim();
    if (directId && /^[a-zA-Z0-9_-]{8,}$/.test(directId)) {
      return directId;
    }

    const queryList = value.match(/(?:^|[?&])list=([^&]+)/i)?.[1];
    if (queryList) return decodeURIComponent(queryList);
  }

  try {
    const parsed = new URL(value);
    const list = parsed.searchParams.get("list");
    if (list) return list;
  } catch {
    return null;
  }

  return null;
}

export function getYouTubePlaylistEmbedUrl(input: string) {
  const id = getYouTubePlaylistId(input);
  return id
    ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(id)}`
    : null;
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function readTag(entry: string, tag: string) {
  const match = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return match?.[1] ? decodeXml(match[1].trim()) : "";
}

export async function fetchYouTubePlaylistVideos(playlistId: string | null) {
  if (!playlistId) return [] as YouTubePlaylistVideo[];

  try {
    const response = await fetch(
      `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`,
      { next: { revalidate: 900 } },
    );

    if (!response.ok) return [] as YouTubePlaylistVideo[];

    const xml = await response.text();
    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((match) => match[1]);

    return entries
      .map((entry) => {
        const id = readTag(entry, "yt:videoId");
        const title = readTag(entry, "title");
        const publishedAt = readTag(entry, "published") || null;
        const thumbnailMatch = entry.match(/<media:thumbnail[^>]*url="([^"]+)"/);
        const thumbnailUrl = thumbnailMatch?.[1]
          ? decodeXml(thumbnailMatch[1])
          : getYouTubeThumbnailFromId(id);

        if (!id || !title) return null;

        return {
          id,
          title,
          url: getYouTubeWatchUrl(id),
          thumbnailUrl,
          publishedAt,
        } satisfies YouTubePlaylistVideo;
      })
      .filter((video): video is YouTubePlaylistVideo => Boolean(video));
  } catch {
    return [] as YouTubePlaylistVideo[];
  }
}
