import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError } from "@/modules/core/api";
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
  storageProvider: "vercel_blob" | "local_public";
  size: number;
  contentType: string;
};

const DURABLE_STORAGE_REQUIRED =
  "BLOB_READ_WRITE_TOKEN non configurato: in produzione gli upload richiedono uno storage persistente.";

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
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
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

  const fileName = makeFileName(file, validated.extension, validated.safeBaseName);
  const paths = publicPathForTarget(target, validated.kind, fileName);

  if (hasDurableMediaStorage()) {
    const blob = await put(paths.blobPath, file, {
      access: "public",
      addRandomSuffix: false,
    });

    return {
      url: blob.url,
      mediaKind: validated.kind,
      storageProvider: "vercel_blob",
      size: file.size,
      contentType: file.type,
    };
  }

  if (process.env.NODE_ENV === "production") {
    throw new AppError(503, DURABLE_STORAGE_REQUIRED);
  }

  const bytes = await file.arrayBuffer();
  await mkdir(paths.localDir, { recursive: true });
  await writeFile(path.join(paths.localDir, fileName), Buffer.from(bytes));

  return {
    url: paths.publicUrl,
    mediaKind: validated.kind,
    storageProvider: "local_public",
    size: file.size,
    contentType: file.type,
  };
}
