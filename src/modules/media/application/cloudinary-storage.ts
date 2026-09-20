import { createHash } from "node:crypto";
import { AppError } from "@/modules/core/errors";

function env(name: string) {
  return String(process.env[name] ?? "").trim();
}

export function isCloudinaryPublicImageEnabled() {
  return env("PUBLIC_IMAGE_STORAGE_PROVIDER").toLowerCase() === "cloudinary";
}

export function hasCloudinaryPublicImageStorage() {
  return Boolean(
    env("CLOUDINARY_CLOUD_NAME") &&
    env("CLOUDINARY_API_KEY") &&
    env("CLOUDINARY_API_SECRET")
  );
}

function signUploadParams(params: Record<string, string>, secret: string) {
  const canonical = Object.entries(params)
    .filter(([, value]) => value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return createHash("sha1").update(`${canonical}${secret}`).digest("hex");
}

function publicIdFromKey(key: string) {
  return key.replace(/^\/+/, "").replace(/\.[^/.]+$/, "");
}

export async function uploadPublicImageToCloudinary({
  key,
  body,
  contentType,
}: {
  key: string;
  body: Buffer;
  contentType: string;
}) {
  if (!hasCloudinaryPublicImageStorage()) {
    throw new AppError(503, "Cloudinary selezionato ma configurazione incompleta");
  }

  const cloudName = env("CLOUDINARY_CLOUD_NAME");
  const apiKey = env("CLOUDINARY_API_KEY");
  const apiSecret = env("CLOUDINARY_API_SECRET");
  const timestamp = String(Math.floor(Date.now() / 1000));
  const publicId = publicIdFromKey(key);
  const params = {
    overwrite: "false",
    public_id: publicId,
    timestamp,
  };
  const signature = signUploadParams(params, apiSecret);
  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(body)], { type: contentType }));
  form.set("api_key", apiKey);
  form.set("timestamp", timestamp);
  form.set("public_id", publicId);
  form.set("overwrite", "false");
  form.set("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
    method: "POST",
    body: form,
  });

  const payload = await response.json().catch(() => null) as { secure_url?: string; error?: { message?: string } } | null;
  if (!response.ok || !payload?.secure_url) {
    console.error("Cloudinary upload failed", response.status, payload?.error?.message ?? "unknown error");
    throw new AppError(502, "Upload su Cloudinary non riuscito");
  }

  return { url: payload.secure_url };
}
