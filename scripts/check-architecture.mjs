#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const warnings = [];

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function walk(dir, predicate = () => true) {
  const absolute = path.join(root, dir);
  if (!fs.existsSync(absolute)) return [];
  const result = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const full = path.join(absolute, entry.name);
    const relative = path.relative(root, full).replaceAll(path.sep, "/");
    if (entry.isDirectory()) {
      if (["node_modules", ".next", ".git", "out", "build"].includes(entry.name)) continue;
      result.push(...walk(relative, predicate));
    } else if (predicate(relative)) {
      result.push(relative);
    }
  }
  return result;
}


function relativeImportTargetExists(importer, specifier) {
  const importerDir = path.dirname(path.join(root, importer));
  const base = path.resolve(importerDir, specifier);

  if (fs.existsSync(base) && fs.statSync(base).isFile()) return true;

  const extensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"];
  for (const extension of extensions) {
    if (fs.existsSync(`${base}${extension}`)) return true;
  }

  for (const extension of extensions) {
    if (fs.existsSync(path.join(base, `index${extension}`))) return true;
  }

  // Prisma Client viene generato da `prisma generate` e può non esistere
  // durante i checker eseguiti su una checkout appena clonata.
  const normalized = base.replaceAll(path.sep, "/");
  if (normalized.includes("/src/generated/prisma/")) return true;

  return false;
}

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

if (!exists("src/modules")) fail("Manca src/modules: la logica modulare non è presente.");
if (!exists("src/app")) fail("Manca src/app: routing Next.js non trovato.");
if (!exists("lib/prisma.ts")) fail("Manca lib/prisma.ts: entrypoint Prisma non trovato.");

if (exists("tsconfig.json")) {
  const tsconfig = JSON.parse(read("tsconfig.json"));
  const paths = tsconfig?.compilerOptions?.paths ?? {};
  const modulesPath = paths["@/modules/*"];
  if (!Array.isArray(modulesPath) || !modulesPath.some((value) => String(value).includes("src/modules"))) {
    fail('tsconfig.json deve mappare "@/modules/*" verso "./src/modules/*".');
  }
} else {
  fail("Manca tsconfig.json.");
}


const sourceFiles = [
  ...walk("src", (relative) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(relative)),
  ...walk("lib", (relative) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(relative)),
  ...walk("scripts", (relative) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(relative)),
  ...walk("tests", (relative) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(relative)),
];

const relativeImportPattern = /(?:from\s+|import\s*\(|require\s*\()\s*["'](\.[^"']+)["']/g;
for (const file of sourceFiles) {
  const content = read(file);
  for (const match of content.matchAll(relativeImportPattern)) {
    const specifier = match[1];
    if (!relativeImportTargetExists(file, specifier)) {
      fail(`${file} importa ${specifier}, ma il target non esiste.`);
    }
  }
}

const deprecatedCompatibilityWrappers = [
  "lib/player-visibility.ts",
  "lib/playoff-progress.ts",
  "lib/bracket.ts",
  "lib/youtube.ts",
  "lib/league-branding.ts",
  "lib/server-auth.ts",
  "lib/booking-window.ts",
  "lib/field-slots.ts",
  "lib/referee-availability.ts",
  "lib/scheduler.ts",
  "lib/tournament-rules.ts",
  "lib/automatic-referees.ts",
];

for (const wrapper of deprecatedCompatibilityWrappers) {
  if (exists(wrapper)) {
    fail(`${wrapper} è un wrapper legacy ormai deprecato: importa direttamente dal modulo proprietario.`);
  }
}

for (const file of walk("src", (relative) => /\.(js|jsx)$/.test(relative))) {
  const typedSibling = file.replace(/\.(js|jsx)$/, (extension) =>
    extension === ".jsx" ? ".tsx" : ".ts"
  );
  if (exists(typedSibling)) {
    fail(`${file} duplica ${typedSibling}: rimuovi l'artefatto JavaScript generato.`);
  }
}

for (const file of walk("src/modules", (relative) => /\.(ts|tsx)$/.test(relative))) {
  const content = read(file);
  if (/from\s+["']@\/app\//.test(content) || /from\s+["']\.\.\/.*app\//.test(content)) {
    fail(`${file} importa dal routing src/app: i moduli non devono dipendere da Next routes/pages.`);
  }
}

for (const file of walk("src/modules", (relative) => /\/domain\/.*\.(ts|tsx)$/.test(relative))) {
  const content = read(file);
  const forbidden = [
    [/@\/lib\/prisma/, "Prisma"],
    [/from\s+["']next\//, "Next.js"],
    [/from\s+["']react["']/, "React"],
    [/NextResponse/, "NextResponse"],
  ];
  for (const [pattern, label] of forbidden) {
    if (pattern.test(content)) fail(`${file} è un domain module ma importa/dipende da ${label}.`);
  }
}

for (const file of walk("src/modules", (relative) => /\/application\/.*\.(ts|tsx)$/.test(relative))) {
  const content = read(file);
  if (/from\s+["']@\/modules\/.*\/presentation\//.test(content)) {
    fail(`${file} è un application module ma importa presentation layer.`);
  }
  if (/from\s+["']@\/modules\/core\/api["']/.test(content)) {
    fail(`${file} è un application module ma importa core/api, che dipende da Next.js. Usa moduli core puri (es. core/errors).`);
  }
}

for (const file of walk("src/modules", (relative) => /\/presentation\/.*\.(ts|tsx)$/.test(relative))) {
  const content = read(file);
  if (/from\s+["']@\/lib\/prisma["']/.test(content)) {
    fail(`${file} è presentation layer ma importa Prisma direttamente.`);
  }
}

for (const file of walk("src/app/api", (relative) => relative.endsWith("route.ts") || relative.endsWith("route.tsx"))) {
  const content = read(file);
  if (/from\s+["']@\/modules\/.*\/presentation\//.test(content)) {
    fail(`${file} importa presentation layer: le API devono usare application/domain, non componenti React.`);
  }
  if (/from\s+["']@\/lib\/prisma["']/.test(content)) {
    fail(`${file} importa Prisma direttamente: le API devono delegare accesso dati e casi d'uso all'application layer.`);
  }
}

for (const dir of walk("prisma/migrations", () => false)) {
  // kept for future recursive migration checks; directories are handled below
}

const migrationsRoot = path.join(root, "prisma/migrations");
if (fs.existsSync(migrationsRoot)) {
  for (const entry of fs.readdirSync(migrationsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const migrationSql = path.join(migrationsRoot, entry.name, "migration.sql");
    if (!fs.existsSync(migrationSql)) fail(`Migration senza migration.sql: prisma/migrations/${entry.name}`);
  }
}

const routeFiles = walk("src/app", (relative) => /\/(page|layout|loading)\.(ts|tsx)$/.test(relative));
const heavyRouteFiles = routeFiles.filter((file) => {
  if (file.includes("/api/")) return false;
  const lines = read(file).split(/\r?\n/).length;
  return lines > 180;
});
if (heavyRouteFiles.length) {
  warn(`Route UI ancora corpose (${heavyRouteFiles.length}): ${heavyRouteFiles.slice(0, 5).join(", ")}${heavyRouteFiles.length > 5 ? "..." : ""}`);
}

if (warnings.length) {
  console.warn("\n[architecture] Avvisi:");
  for (const item of warnings) console.warn(`- ${item}`);
}

if (errors.length) {
  console.error("\n[architecture] Errori:");
  for (const item of errors) console.error(`- ${item}`);
  process.exit(1);
}

console.log("[architecture] Controllo completato.");
