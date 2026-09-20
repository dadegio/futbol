import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { AppError } from "@/modules/core/errors";
import {
  hasGoogleDriveMediaStorage,
  isGoogleDriveMediaEnabled,
  uploadMediaToGoogleDrive,
} from "@/modules/media/application/google-drive-storage";
import {
  hasCloudinaryPublicImageStorage,
  isCloudinaryPublicImageEnabled,
  uploadPublicImageToCloudinary,
} from "@/modules/media/application/cloudinary-storage";
import {
  validateUploadFile,
  type UploadKind,
  type UploadValidationOptions,
} from "@/modules/core/security/upload-validation";

type UploadTarget = {
  scope: "generic" | "media";
  leagueId?: string;
  folder?: string;
};

type StoredUpload = {
  url: string;
  mediaKind: UploadKind;
  storageProvider: "google_drive" | "cloudinary" | "vercel_blob" | "local_public";
  size: number;
  contentType: string;
};

const DURABLE_STORAGE_REQUIRED =
  "Storage persistente non configurato: imposta Cloudinary per le immagini pubbliche o Vercel Blob come fallback.";

async function optimizeGenericImage(file: File) {
  const original = Buffer.from(await file.arrayBuffer());
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml" || file.type === "image/gif") {
    return { body: original, contentType: file.type || "application/octet-stream", extension: null as string | null };
  }

  try {
    const body = await sharp(original, { failOn: "none" })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
    return { body, contentType: "image/webp", extension: "webp" };
  } catch (error) {
    console.warn("[upload] Compressione immagine saltata:", error);
    return { body: original, contentType: file.type || "application/octet-stream", extension: null as string | null };
  }
}

function makeFileName(file: File, extension: string, safeBaseName: string) {
  const timestamp = Date.now();
  const id = randomUUID();
  const finalBase = safeBaseName || "upload";
  return `${timestamp}-${id}-${finalBase}.${extension}`;
}

function publicPathForTarget(target: UploadTarget, kind: UploadKind, fileName: string) {
  if (target.scope === "media") {
    const leagueId = target.leagueId ?? "unknown";
    const folder = target.folder ?? (kind === "video" ? "videos" : "photos");
    return {
      blobPath: `media/${leagueId}/${folder}/${fileName}`,
      localDir: path.join(process.cwd(), "public", "media", leagueId, folder),
      publicUrl: `/media/${leagueId}/${folder}/${fileName}`,
    };
  }

  const folder = target.folder ?? "uploads";
  return {
    blobPath: `${folder}/${fileName}`,
    localDir: path.join(process.cwd(), "public", folder),
    publicUrl: `/${folder}/${fileName}`,
  };
}

export function hasDurableMediaStorage() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN) ||
    (isGoogleDriveMediaEnabled() && hasGoogleDriveMediaStorage());
}

export async function storeUploadFile({
  file,
  target,
  validation,
}: {
  file: File;
  target: UploadTarget;
  validation: UploadValidationOptions;
}): Promise<StoredUpload> {
  const validated = validateUploadFile(file, validation);
  if (!validated.ok) {
    throw new AppError(validated.status, validated.error);
  }

  let uploadBody: File | Buffer = file;
  let contentType = file.type || "application/octet-stream";
  let extension = validated.extension;
  if (target.scope === "generic" && validated.kind === "image") {
    const optimized = await optimizeGenericImage(file);
    uploadBody = optimized.body;
    contentType = optimized.contentType;
    if (optimized.extension) extension = optimized.extension;
  }

  const fileName = makeFileName(file, extension, validated.safeBaseName);
  const paths = publicPathForTarget(target, validated.kind, fileName);

  if (target.scope === "media" && isGoogleDriveMediaEnabled()) {
    if (!hasGoogleDriveMediaStorage()) {
      throw new AppError(503, "Google Drive selezionato ma configurazione incompleta");
    }
    const stored = await uploadMediaToGoogleDrive({ file, fileName });
    return {
      url: stored.url,
      mediaKind: validated.kind,
      storageProvider: "google_drive",
      size: file.size,
      contentType: file.type,
    };
  }

  if (target.scope === "generic" && isCloudinaryPublicImageEnabled()) {
    if (!hasCloudinaryPublicImageStorage()) {
      throw new AppError(503, "Cloudinary selezionato ma configurazione incompleta");
    }
    const body = Buffer.isBuffer(uploadBody) ? uploadBody : Buffer.from(await uploadBody.arrayBuffer());
    const stored = await uploadPublicImageToCloudinary({ key: paths.blobPath, body, contentType });
    return {
      url: stored.url,
      mediaKind: validated.kind,
      storageProvider: "cloudinary",
      size: body.length,
      contentType,
    };
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(paths.blobPath, uploadBody, {
      access: "public",
      addRandomSuffix: false,
      contentType,
    });

    return {
      url: blob.url,
      mediaKind: validated.kind,
      storageProvider: "vercel_blob",
      size: Buffer.isBuffer(uploadBody) ? uploadBody.length : file.size,
      contentType,
    };
  }

  if (process.env.NODE_ENV === "production") {
    throw new AppError(503, DURABLE_STORAGE_REQUIRED);
  }

  const bytes = Buffer.isBuffer(uploadBody) ? uploadBody : Buffer.from(await uploadBody.arrayBuffer());
  await mkdir(paths.localDir, { recursive: true });
  await writeFile(path.join(paths.localDir, fileName), bytes);

  return {
    url: paths.publicUrl,
    mediaKind: validated.kind,
    storageProvider: "local_public",
    size: bytes.length,
    contentType,
  };
}
