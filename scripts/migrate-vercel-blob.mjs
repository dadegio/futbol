#!/usr/bin/env node
import "dotenv/config";
import { createHash } from "node:crypto";
import { Pool } from "pg";
import sharp from "sharp";

const BLOB_HOST_FRAGMENT = ".blob.vercel-storage.com";
const execute = process.argv.includes("--execute");
const publicOnly = process.argv.includes("--public-only");
const mediaOnly = process.argv.includes("--media-only");

if (publicOnly && mediaOnly) {
  console.error("Usa al massimo uno tra --public-only e --media-only.");
  process.exit(1);
}

const migratePublic = !mediaOnly;
const migrateMedia = !publicOnly;

function env(name) {
  return String(process.env[name] ?? "").trim();
}

function required(name) {
  const value = env(name);
  if (!value) throw new Error(`${name} non configurato`);
  return value;
}

function isVercelBlobUrl(value) {
  if (typeof value !== "string" || !value.includes(BLOB_HOST_FRAGMENT)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(BLOB_HOST_FRAGMENT);
  } catch {
    return false;
  }
}

function safeIdentifier(value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Identificatore SQL non valido: ${value}`);
  }
  return `"${value}"`;
}

function publicIdFromUrl(url) {
  const parsed = new URL(url);
  const rawPath = decodeURIComponent(parsed.pathname).replace(/^\/+/, "");
  const withoutExtension = rawPath.replace(/\.[^/.]+$/, "");
  const cleaned = withoutExtension
    .split("/")
    .map((part) => part.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, ""))
    .filter(Boolean)
    .join("/");
  const fallback = createHash("sha256").update(url).digest("hex").slice(0, 24);
  return `legacy-vercel-blob/${cleaned || fallback}`;
}

function fileNameFromUrl(url) {
  const parsed = new URL(url);
  const name = decodeURIComponent(parsed.pathname.split("/").pop() || "media");
  return name.replace(/[^A-Za-z0-9._-]+/g, "-").slice(-180) || "media";
}

async function downloadBlob(url) {
  const response = await fetch(url, { redirect: "follow", cache: "no-store" });
  if (!response.ok) {
    throw new Error(`download HTTP ${response.status} ${response.statusText}`);
  }
  const body = Buffer.from(await response.arrayBuffer());
  const contentType = String(response.headers.get("content-type") || "application/octet-stream")
    .split(";")[0]
    .trim()
    .toLowerCase();
  return { body, contentType };
}

async function optimizePublicImage(body, contentType) {
  if (!contentType.startsWith("image/") || contentType === "image/svg+xml" || contentType === "image/gif") {
    return { body, contentType };
  }

  try {
    const optimized = await sharp(body, { failOn: "none" })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
    return { body: optimized, contentType: "image/webp" };
  } catch (error) {
    console.warn(`[storage:migrate] Ottimizzazione saltata: ${error instanceof Error ? error.message : String(error)}`);
    return { body, contentType };
  }
}

function signCloudinary(params, secret) {
  const canonical = Object.entries(params)
    .filter(([, value]) => String(value) !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return createHash("sha1").update(`${canonical}${secret}`).digest("hex");
}

async function uploadToCloudinary({ oldUrl, body, contentType }) {
  const cloudName = required("CLOUDINARY_CLOUD_NAME");
  const apiKey = required("CLOUDINARY_API_KEY");
  const apiSecret = required("CLOUDINARY_API_SECRET");
  const optimized = await optimizePublicImage(body, contentType);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const publicId = publicIdFromUrl(oldUrl);
  const params = { overwrite: "true", public_id: publicId, timestamp };
  const signature = signCloudinary(params, apiSecret);
  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(optimized.body)], { type: optimized.contentType }));
  form.set("api_key", apiKey);
  form.set("timestamp", timestamp);
  form.set("public_id", publicId);
  form.set("overwrite", "true");
  form.set("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
    { method: "POST", body: form }
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.secure_url) {
    throw new Error(`Cloudinary HTTP ${response.status}: ${payload?.error?.message || "upload fallito"}`);
  }
  return String(payload.secure_url);
}

let driveTokenCache = null;
async function getDriveAccessToken() {
  if (driveTokenCache && driveTokenCache.expiresAt > Date.now() + 30_000) {
    return driveTokenCache.value;
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
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    throw new Error(`Google OAuth HTTP ${response.status}: ${payload?.error_description || "token non disponibile"}`);
  }
  driveTokenCache = {
    value: String(payload.access_token),
    expiresAt: Date.now() + Math.max(60, Number(payload.expires_in || 3600)) * 1000,
  };
  return driveTokenCache.value;
}

function driveSourceHash(url) {
  return createHash("sha256").update(url).digest("hex").slice(0, 40);
}

async function findExistingDriveFile(oldUrl) {
  const token = await getDriveAccessToken();
  const folderId = required("GOOGLE_DRIVE_FOLDER_ID");
  const sourceHash = driveSourceHash(oldUrl);
  const q = `'${folderId.replaceAll("'", "\\'")}' in parents and trashed = false and appProperties has { key='vercelBlobSha' and value='${sourceHash}' }`;
  const params = new URLSearchParams({
    q,
    fields: "files(id,name)",
    pageSize: "1",
    spaces: "drive",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Google Drive ricerca HTTP ${response.status}: ${payload?.error?.message || "errore"}`);
  }
  return payload?.files?.[0]?.id ? String(payload.files[0].id) : null;
}

async function uploadToDrive({ oldUrl, body, contentType }) {
  const existing = await findExistingDriveFile(oldUrl);
  if (existing) return `/api/media/drive/${encodeURIComponent(existing)}`;

  const token = await getDriveAccessToken();
  const folderId = required("GOOGLE_DRIVE_FOLDER_ID");
  const boundary = `blob-migrate-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({
    name: fileNameFromUrl(oldUrl),
    parents: [folderId],
    appProperties: {
      source: "vercel_blob",
      vercelBlobSha: driveSourceHash(oldUrl),
    },
  });
  const multipartBody = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: ${contentType || "application/octet-stream"}\r\n\r\n`,
    new Uint8Array(body),
    `\r\n--${boundary}--`,
  ]);
  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.id) {
    throw new Error(`Google Drive HTTP ${response.status}: ${payload?.error?.message || "upload fallito"}`);
  }
  return `/api/media/drive/${encodeURIComponent(String(payload.id))}`;
}

async function rows(pool, table, columns) {
  const selected = ["id", ...columns].map(safeIdentifier).join(", ");
  const result = await pool.query(`SELECT ${selected} FROM ${safeIdentifier(table)}`);
  return result.rows;
}

async function collectReferences(pool) {
  const refs = [];
  const definitions = [
    { destination: "cloudinary", table: "League", columns: ["brandLogoUrl", "brandCoverUrl"] },
    { destination: "cloudinary", table: "Team", columns: ["badgeUrl"] },
    { destination: "cloudinary", table: "Sponsor", columns: ["logoUrl"] },
    { destination: "cloudinary", table: "Player", columns: ["photoUrl"] },
    { destination: "cloudinary", table: "CreatorProfile", columns: ["avatarUrl"] },
    { destination: "drive", table: "MediaItem", columns: ["fileUrl", "thumbnailUrl"] },
  ];

  for (const definition of definitions) {
    if (definition.destination === "cloudinary" && !migratePublic) continue;
    if (definition.destination === "drive" && !migrateMedia) continue;
    const records = await rows(pool, definition.table, definition.columns);
    for (const record of records) {
      for (const column of definition.columns) {
        const value = record[column];
        if (!isVercelBlobUrl(value)) continue;
        refs.push({
          destination: definition.destination,
          table: definition.table,
          id: String(record.id),
          column,
          oldUrl: String(value),
        });
      }
    }
  }
  return refs;
}

function groupReferences(refs) {
  const groups = new Map();
  for (const ref of refs) {
    const key = `${ref.destination}\n${ref.oldUrl}`;
    const current = groups.get(key) || { destination: ref.destination, oldUrl: ref.oldUrl, refs: [] };
    current.refs.push(ref);
    groups.set(key, current);
  }
  return [...groups.values()];
}

async function updateReferences(pool, group, newUrl) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const ref of group.refs) {
      const sql = `UPDATE ${safeIdentifier(ref.table)} SET ${safeIdentifier(ref.column)} = $1 WHERE "id" = $2 AND ${safeIdentifier(ref.column)} = $3`;
      const result = await client.query(sql, [newUrl, ref.id, ref.oldUrl]);
      if (result.rowCount !== 1) {
        throw new Error(`${ref.table}.${ref.column} (${ref.id}) è cambiato durante la migrazione`);
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function replaceJsonUrls(value, mapping) {
  if (typeof value === "string") return mapping.get(value) || value;
  if (Array.isArray(value)) return value.map((item) => replaceJsonUrls(item, mapping));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceJsonUrls(item, mapping)]));
  }
  return value;
}

async function rewriteJsonHistory(pool, mapping) {
  if (!mapping.size) return;
  for (const { table, column } of [
    { table: "TeamChangeRequest", column: "payload" },
    { table: "AuditLog", column: "metadata" },
  ]) {
    const result = await pool.query(`SELECT "id", ${safeIdentifier(column)} FROM ${safeIdentifier(table)} WHERE ${safeIdentifier(column)} IS NOT NULL`);
    for (const row of result.rows) {
      const next = replaceJsonUrls(row[column], mapping);
      const before = JSON.stringify(row[column]);
      const after = JSON.stringify(next);
      if (before === after) continue;
      await pool.query(
        `UPDATE ${safeIdentifier(table)} SET ${safeIdentifier(column)} = $1::jsonb WHERE "id" = $2`,
        [after, String(row.id)]
      );
    }
  }
}

async function scanRemainingTextReferences(pool) {
  const columns = await pool.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND data_type IN ('text', 'character varying')
      AND table_name <> '_prisma_migrations'
    ORDER BY table_name, ordinal_position
  `);
  const remaining = [];
  for (const column of columns.rows) {
    const table = String(column.table_name);
    const field = String(column.column_name);
    try {
      const result = await pool.query(
        `SELECT COUNT(*)::int AS count FROM ${safeIdentifier(table)} WHERE ${safeIdentifier(field)} LIKE $1`,
        [`%${BLOB_HOST_FRAGMENT}%`]
      );
      const count = Number(result.rows[0]?.count || 0);
      if (count > 0) remaining.push({ table, field, count });
    } catch {
      // Tabelle/colonne non aggiornabili non bloccano l'audit.
    }
  }
  return remaining;
}

function ensureDestinationConfig(groups) {
  if (groups.some((group) => group.destination === "cloudinary")) {
    required("CLOUDINARY_CLOUD_NAME");
    required("CLOUDINARY_API_KEY");
    required("CLOUDINARY_API_SECRET");
  }
  if (groups.some((group) => group.destination === "drive")) {
    required("GOOGLE_DRIVE_FOLDER_ID");
    required("GOOGLE_DRIVE_CLIENT_ID");
    required("GOOGLE_DRIVE_CLIENT_SECRET");
    required("GOOGLE_DRIVE_REFRESH_TOKEN");
  }
}

async function main() {
  const connectionString = env("DIRECT_URL") || env("DATABASE_URL");
  if (!connectionString) throw new Error("Imposta DIRECT_URL o DATABASE_URL");
  const pool = new Pool({ connectionString, max: 2 });

  try {
    const refs = await collectReferences(pool);
    const groups = groupReferences(refs);
    const publicGroups = groups.filter((group) => group.destination === "cloudinary");
    const mediaGroups = groups.filter((group) => group.destination === "drive");

    console.log("\n[storage:migrate] Inventario riferimenti Vercel Blob");
    console.log(`- asset pubblici -> Cloudinary: ${publicGroups.length} file / ${refs.filter((ref) => ref.destination === "cloudinary").length} riferimenti DB`);
    console.log(`- media creator -> Google Drive: ${mediaGroups.length} file / ${refs.filter((ref) => ref.destination === "drive").length} riferimenti DB`);

    if (!execute) {
      console.log("\nDRY RUN: nessun file o record è stato modificato.");
      console.log("Dopo aver configurato le destinazioni, esegui: npm run storage:migrate:blob -- --execute");
      const remaining = await scanRemainingTextReferences(pool);
      if (remaining.length) {
        console.log("\nRiferimenti Blob trovati nelle colonne testuali:");
        for (const item of remaining) console.log(`- ${item.table}.${item.field}: ${item.count}`);
      }
      return;
    }

    ensureDestinationConfig(groups);
    const mapping = new Map();
    let completed = 0;
    let failed = 0;

    for (const group of groups) {
      const label = `${group.destination === "drive" ? "Drive" : "Cloudinary"} ${completed + failed + 1}/${groups.length}`;
      try {
        console.log(`\n[${label}] ${group.oldUrl}`);
        const downloaded = await downloadBlob(group.oldUrl);
        const newUrl = group.destination === "drive"
          ? await uploadToDrive({ oldUrl: group.oldUrl, ...downloaded })
          : await uploadToCloudinary({ oldUrl: group.oldUrl, ...downloaded });
        await updateReferences(pool, group, newUrl);
        mapping.set(group.oldUrl, newUrl);
        completed += 1;
        console.log(`  -> ${newUrl}`);
      } catch (error) {
        failed += 1;
        console.error(`  ERRORE: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    await rewriteJsonHistory(pool, mapping);
    const remaining = await scanRemainingTextReferences(pool);

    console.log("\n[storage:migrate] Risultato");
    console.log(`- migrati: ${completed}`);
    console.log(`- falliti: ${failed}`);
    if (remaining.length) {
      console.log("- riferimenti Vercel Blob ancora presenti:");
      for (const item of remaining) console.log(`  ${item.table}.${item.field}: ${item.count}`);
    } else {
      console.log("- nessun riferimento Vercel Blob rimasto nelle colonne testuali del DB ✅");
    }

    if (failed > 0 || remaining.length > 0) {
      process.exitCode = 2;
      console.log("\nNON eliminare ancora il Blob Store: rilancia la migrazione dopo aver risolto gli errori.");
    } else {
      console.log("\nMigrazione DB completata. Verifica l'app prima di eliminare il vecchio Blob Store.");
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`\n[storage:migrate] ${error instanceof Error ? error.stack || error.message : String(error)}`);
  process.exit(1);
});
