#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const soft = args.has("--soft") || args.has("--warn-only");
const root = process.cwd();

function readEnvFile(fileName) {
  const filePath = path.join(root, fileName);
  if (!fs.existsSync(filePath)) return {};
  const result = {};
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2] ?? "";
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[match[1]] = value;
  }
  return result;
}

const fileEnv = {
  ...readEnvFile(".env"),
  ...readEnvFile(".env.local"),
};

function env(name) {
  const value = process.env[name] ?? fileEnv[name];
  return typeof value === "string" ? value.trim() : "";
}

const errors = [];
const warnings = [];

function requireEnv(name, description) {
  if (!env(name)) errors.push(`${name} mancante (${description})`);
}

function warnEnv(name, description) {
  if (!env(name)) warnings.push(`${name} non impostato (${description})`);
}

requireEnv("DATABASE_URL", "necessario per Prisma/Neon");
requireEnv("AUTH_SECRET", "necessario per sessioni e login");

const authSecret = env("AUTH_SECRET");
if (authSecret && authSecret.length < 32) {
  warnings.push("AUTH_SECRET è impostato ma sarebbe meglio usare almeno 32 caratteri casuali");
}

warnEnv("BLOB_READ_WRITE_TOKEN", "necessario solo se usi Vercel Blob per upload media");
warnEnv("NEXT_PUBLIC_APP_URL", "consigliato per link assoluti, SEO e integrazioni esterne");
warnEnv("YOUTUBE_PLAYLIST_ID", "necessario solo per mostrare una playlist YouTube globale");

if (env("NODE_ENV") === "production") {
  requireEnv("BLOB_READ_WRITE_TOKEN", "obbligatorio in produzione per upload persistenti");
  requireEnv("SETUP_SECRET", "protegge l'endpoint di bootstrap /api/setup");
} else {
  warnEnv("SETUP_SECRET", "consigliato per proteggere /api/setup anche in sviluppo");
}

if (warnings.length) {
  console.warn("\n[env] Avvisi:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (errors.length) {
  console.error("\n[env] Errori:");
  for (const error of errors) console.error(`- ${error}`);
  if (soft) {
    console.warn("\n[env] Modalità warn-only: non blocco l'esecuzione.");
  } else {
    process.exit(1);
  }
}

console.log("[env] Controllo completato.");
