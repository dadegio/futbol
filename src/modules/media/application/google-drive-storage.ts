import { AppError } from "@/modules/core/errors";

type TokenCache = {
  value: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

function required(name: string) {
  const value = String(process.env[name] ?? "").trim();
  if (!value) {
    throw new AppError(503, `${name} non configurato per Google Drive`);
  }
  return value;
}

export function isGoogleDriveMediaEnabled() {
  return String(process.env.MEDIA_STORAGE_PROVIDER ?? "").trim() === "google_drive";
}

export function hasGoogleDriveMediaStorage() {
  return Boolean(
    process.env.GOOGLE_DRIVE_FOLDER_ID &&
      process.env.GOOGLE_DRIVE_CLIENT_ID &&
      process.env.GOOGLE_DRIVE_CLIENT_SECRET &&
      process.env.GOOGLE_DRIVE_REFRESH_TOKEN
  );
}

async function getAccessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) {
    return tokenCache.value;
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: required("GOOGLE_DRIVE_CLIENT_ID"),
      client_secret: required("GOOGLE_DRIVE_CLIENT_SECRET"),
      refresh_token: required("GOOGLE_DRIVE_REFRESH_TOKEN"),
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!response.ok || !payload.access_token) {
    throw new AppError(
      503,
      payload.error_description || "Impossibile autenticarsi su Google Drive"
    );
  }

  tokenCache = {
    value: payload.access_token,
    expiresAt: Date.now() + Math.max(60, payload.expires_in ?? 3600) * 1000,
  };
  return tokenCache.value;
}

export async function uploadMediaToGoogleDrive({
  file,
  fileName,
}: {
  file: File;
  fileName: string;
}) {
  if (!hasGoogleDriveMediaStorage()) {
    throw new AppError(
      503,
      "Google Drive selezionato ma credenziali o cartella non configurate"
    );
  }

  const accessToken = await getAccessToken();
  const boundary = `drive-upload-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({
    name: fileName,
    parents: [required("GOOGLE_DRIVE_FOLDER_ID")],
  });
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`,
    file,
    `\r\n--${boundary}--`,
  ]);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
      cache: "no-store",
    }
  );

  const payload = (await response.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string };
  };
  if (!response.ok || !payload.id) {
    throw new AppError(
      502,
      payload.error?.message || "Upload Google Drive non riuscito"
    );
  }

  return {
    fileId: payload.id,
    url: `/api/media/drive/${encodeURIComponent(payload.id)}`,
  };
}

export async function fetchGoogleDriveMedia(fileId: string, range?: string | null) {
  const accessToken = await getAccessToken();
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(range ? { Range: range } : {}),
      },
      cache: "no-store",
    }
  );

  if (!response.ok && response.status !== 206) {
    throw new AppError(
      response.status === 404 ? 404 : 502,
      response.status === 404
        ? "File Drive non trovato"
        : "Impossibile leggere il file da Google Drive"
    );
  }

  return response;
}

export async function getGoogleDriveMediaAccess({
  fileId,
  session,
}: {
  fileId: string;
  session: import("@/lib/session").SessionUser | null;
}) {
  const { prisma } = await import("@/lib/prisma");
  const { isLeagueAdmin } = await import("@/modules/permissions/permissions");
  const proxyUrl = `/api/media/drive/${fileId}`;
  const media = await prisma.mediaItem.findFirst({
    where: {
      OR: [{ fileUrl: proxyUrl }, { thumbnailUrl: proxyUrl }],
    },
    select: {
      status: true,
      leagueId: true,
      uploadedByUserId: true,
      creator: { select: { userId: true } },
    },
  });

  if (!media) {
    throw new AppError(404, "File non trovato");
  }

  if (media.status !== "APPROVED") {
    const canReadPrivate = Boolean(
      session &&
        (isLeagueAdmin(session, media.leagueId) ||
          session.userId === media.uploadedByUserId ||
          session.userId === media.creator?.userId)
    );
    if (!canReadPrivate) {
      throw new AppError(403, "Non autorizzato");
    }
  }

  return { isPublic: media.status === "APPROVED" };
}
