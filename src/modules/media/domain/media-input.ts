export const MEDIA_TYPES = new Set([
  "PHOTO",
  "VIDEO",
  "REEL",
  "HIGHLIGHT",
  "INTERVIEW",
  "BACKSTAGE",
  "OTHER",
]);

export const MEDIA_STATUSES = new Set([
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
  "HIDDEN",
  "REJECTED",
]);

export type MediaItemTypeValue =
  | "PHOTO"
  | "VIDEO"
  | "REEL"
  | "HIGHLIGHT"
  | "INTERVIEW"
  | "BACKSTAGE"
  | "OTHER";

export type MediaItemStatusValue =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "HIDDEN"
  | "REJECTED";

export type MediaInputError = { error: string };

export type MediaCreateData = {
  type: MediaItemTypeValue;
  status: MediaItemStatusValue;
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
  featured: boolean;
};

export type MediaPatchData = Record<string, unknown>;

export function text(value: unknown, max = 300) {
  const v = String(value ?? "").trim();
  return v ? v.slice(0, max) : null;
}

export function url(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.startsWith("/")) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[\w.-]+\.[a-z]{2,}([/?#].*)?$/i.test(raw)) return `https://${raw}`;
  return undefined;
}

export function instagram(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = raw
    .replace(/^@/, "")
    .replace(/^instagram\.com\//i, "")
    .replace(/^www\.instagram\.com\//i, "")
    .split(/[/?#]/)[0];
  if (/^[a-zA-Z0-9._]{1,30}$/.test(handle)) return `https://instagram.com/${handle}`;
  return undefined;
}

export function parseMediaCreateInput(
  body: Record<string, unknown>,
  canAdmin: boolean
): { data: MediaCreateData } | MediaInputError {
  const fileUrl = url(body.fileUrl);
  if (fileUrl === undefined) return { error: "Link file non valido" } as const;
  if (!fileUrl) return { error: "Carica un file o inserisci un link valido" } as const;

  const socialUrl = url(body.socialUrl);
  if (socialUrl === undefined) return { error: "Link social non valido" } as const;

  const thumbnailUrl = url(body.thumbnailUrl);
  if (thumbnailUrl === undefined) return { error: "Thumbnail non valida" } as const;

  const creditInstagram = instagram(body.creditInstagram);
  if (creditInstagram === undefined) return { error: "Instagram credito non valido" } as const;

  const type = MEDIA_TYPES.has(String(body.type)) ? String(body.type) : "PHOTO";
  const status = canAdmin && MEDIA_STATUSES.has(String(body.status)) ? String(body.status) : "PENDING_REVIEW";
  const roundValue =
    body.round === null || body.round === undefined || body.round === "" ? null : Number(body.round);
  if (roundValue !== null && (!Number.isInteger(roundValue) || roundValue < 0 || roundValue > 999)) {
    return { error: "Giornata non valida" } as const;
  }

  const creditEmail = text(body.creditEmail, 180);
  if (creditEmail && !/^\S+@\S+\.\S+$/.test(creditEmail)) {
    return { error: "Email credito non valida" } as const;
  }

  return {
    data: {
      type: type as MediaItemTypeValue,
      status: status as MediaItemStatusValue,
      title: text(body.title, 140),
      caption: text(body.caption, 900),
      fileUrl,
      thumbnailUrl,
      socialUrl,
      matchId: text(body.matchId, 80),
      teamId: text(body.teamId, 80),
      playerId: text(body.playerId, 80),
      round: roundValue,
      creditName: text(body.creditName, 120),
      creditInstagram,
      creditEmail,
      showCreditEmail: body.showCreditEmail === true,
      featured: canAdmin && body.featured === true,
    },
  } as const;
}

export function parseMediaPatchInput(
  body: Record<string, unknown>,
  canAdmin: boolean,
  currentStatus: string
): { data: MediaPatchData } | MediaInputError {
  const data: MediaPatchData = {};

  if (body.title !== undefined) data.title = text(body.title, 140);
  if (body.caption !== undefined) data.caption = text(body.caption, 900);
  if (body.type !== undefined && MEDIA_TYPES.has(String(body.type))) data.type = String(body.type);

  if (body.socialUrl !== undefined) {
    const socialUrl = url(body.socialUrl);
    if (socialUrl === undefined) return { error: "Link social non valido" } as const;
    data.socialUrl = socialUrl;
  }

  if (body.creditName !== undefined) data.creditName = text(body.creditName, 120);
  if (body.creditInstagram !== undefined) {
    const creditInstagram = instagram(body.creditInstagram);
    if (creditInstagram === undefined) {
      return { error: "Instagram credito non valido" } as const;
    }
    data.creditInstagram = creditInstagram;
  }

  if (body.creditEmail !== undefined) {
    const email = text(body.creditEmail, 180);
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return { error: "Email non valida" } as const;
    data.creditEmail = email;
  }

  if (body.showCreditEmail !== undefined) data.showCreditEmail = body.showCreditEmail === true;

  if (canAdmin) {
    if (body.status !== undefined && MEDIA_STATUSES.has(String(body.status))) data.status = String(body.status);
    if (body.featured !== undefined) data.featured = body.featured === true;
  } else if (currentStatus === "APPROVED") {
    data.status = "PENDING_REVIEW";
    data.featured = false;
  }

  return { data } as const;
}
