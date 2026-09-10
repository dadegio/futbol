#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const errors = [];
const warnings = [];

function normalize(value) {
  return value.replaceAll(path.sep, "/").replace(/^\.\//, "");
}

function walk(dir = root) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", ".next", "out", "build"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(normalize(path.relative(root, full)));
  }
  return files;
}

function trackedFiles() {
  const result = spawnSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" });
  if (result.status === 0 && result.stdout) {
    return result.stdout.split("\0").filter(Boolean).map(normalize);
  }
  return walk();
}

const files = trackedFiles();
const allowedEnvExamples = new Set([".env.example", ".env.test.example"]);
const knownLegacyRuntimeUploads = new Set([
  "public/uploads/1783524934699-bb95b411-4c87-450f-905c-21e7bee87388-logo.jpeg",
]);

for (const file of files) {
  const basename = path.posix.basename(file);
  const lower = file.toLowerCase();

  if ((basename === ".env" || basename.startsWith(".env.")) && !allowedEnvExamples.has(basename)) {
    errors.push(`${file}: file ambiente/segreti non deve essere versionato.`);
  }
  if (/\.(pem|key|p12|pfx|db|sqlite|sqlite3)$/i.test(file)) {
    errors.push(`${file}: chiave o database locale non deve essere versionato.`);
  }
  if (lower.startsWith(".idea/") || lower.startsWith(".vscode/") || lower.startsWith(".vercel/")) {
    errors.push(`${file}: configurazione locale non deve essere versionata.`);
  }
  if (lower.startsWith("src/generated/prisma/")) {
    errors.push(`${file}: Prisma Client è generato e non deve essere versionato.`);
  }
  if (lower.startsWith("public/uploads/")) {
    if (knownLegacyRuntimeUploads.has(file)) {
      warnings.push(`${file}: upload legacy ancora versionato. Verifica il DB prima di rimuoverlo.`);
    } else {
      errors.push(`${file}: upload runtime non deve essere versionato; usa Vercel Blob o storage persistente.`);
    }
  }

  const absolute = path.join(root, file);
  try {
    const stat = fs.statSync(absolute);
    if (stat.size > 1_000_000) continue;
    const content = fs.readFileSync(absolute, "utf8");
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content)) {
      errors.push(`${file}: contiene una chiave privata.`);
    }
    if (/vercel_blob_rw_[A-Za-z0-9_-]{20,}/.test(content)) {
      errors.push(`${file}: sembra contenere un token Vercel Blob reale.`);
    }
  } catch {
    // File binari o non leggibili: i controlli per nome restano comunque applicati.
  }
}

if (warnings.length) {
  console.warn("\n[hygiene] Avvisi:");
  for (const warning of [...new Set(warnings)]) console.warn(`- ${warning}`);
}

if (errors.length) {
  console.error("\n[hygiene] Errori:");
  for (const error of [...new Set(errors)]) console.error(`- ${error}`);
  process.exit(1);
}

console.log("[hygiene] Repository pulito da file sensibili/locali noti.");
