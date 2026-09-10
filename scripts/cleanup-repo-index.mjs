#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";

function normalize(value) {
  return value.replaceAll(path.sep, "/");
}

const listed = spawnSync("git", ["ls-files", "-z"], { encoding: "utf8" });
if (listed.status !== 0) {
  console.error("[cleanup] Impossibile leggere l'indice Git. Esegui il comando dentro la repository.");
  process.exit(listed.status || 1);
}

const allowedEnvExamples = new Set([".env.example", ".env.test.example"]);
const legacyRuntimeFiles = new Set([
  "public/uploads/1783524934699-bb95b411-4c87-450f-905c-21e7bee87388-logo.jpeg",
]);
const tracked = listed.stdout.split("\0").filter(Boolean).map(normalize);

const shouldUntrack = (file) => {
  const lower = file.toLowerCase();
  const basename = path.posix.basename(file);

  if (lower.startsWith(".idea/") || lower.startsWith(".vscode/") || lower.startsWith(".vercel/")) return true;
  if (lower.startsWith("src/generated/prisma/")) return true;
  if ((lower.startsWith("public/uploads/") || lower.startsWith("public/media/")) && !legacyRuntimeFiles.has(file)) return true;
  if ((basename === ".env" || basename.startsWith(".env.")) && !allowedEnvExamples.has(basename)) return true;
  if (/\.(pem|key|p12|pfx|db|sqlite|sqlite3)$/i.test(file)) return true;
  return false;
};

const targets = tracked.filter(shouldUntrack);
if (!targets.length) {
  console.log("[cleanup] Nessun file locale/sensibile versionato da rimuovere dall'indice.");
  process.exit(0);
}

console.log("[cleanup] Rimuovo dall'indice Git (i file locali restano sul disco):");
for (const file of targets) console.log(`- ${file}`);

const result = spawnSync("git", ["rm", "--cached", "--ignore-unmatch", "--", ...targets], {
  stdio: "inherit",
});

if (result.status !== 0) process.exit(result.status || 1);
console.log("[cleanup] Fatto. .gitignore impedirà che questi file vengano riaggiunti.");
