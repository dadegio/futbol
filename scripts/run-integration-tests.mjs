#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[match[1]] = value;
  }
  return result;
}

const fileEnv = readEnvFile(".env.test.local");
const env = (name) => String(process.env[name] ?? fileEnv[name] ?? "").trim();

const runtimeUrl = env("TEST_DATABASE_URL");
const directUrl = env("TEST_DIRECT_URL") || runtimeUrl;
const useExistingSchema = env("INTEGRATION_USE_EXISTING_SCHEMA") === "1";

if (!runtimeUrl) {
  console.error(
    "[integration] TEST_DATABASE_URL mancante. Impostalo in .env.test.local o nell'ambiente. Il comando non usa DATABASE_URL per evitare di colpire accidentalmente il database reale."
  );
  process.exit(1);
}

if (
  useExistingSchema &&
  process.env.CI !== "true" &&
  env("INTEGRATION_ALLOW_EXISTING_DATABASE") !== "1"
) {
  console.error(
    "[integration] INTEGRATION_USE_EXISTING_SCHEMA è consentito automaticamente solo in CI. In locale usa lo schema temporaneo predefinito oppure imposta esplicitamente INTEGRATION_ALLOW_EXISTING_DATABASE=1 su un database dedicato ai test."
  );
  process.exit(1);
}

const { Pool } = await import("pg");

function parsePostgresUrl(value, label) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} non è una URL valida`);
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error(`${label} deve essere una connessione PostgreSQL`);
  }
  return parsed;
}

function baseDatabaseUrl(value, label) {
  const parsed = parsePostgresUrl(value, label);
  parsed.searchParams.delete("schema");
  return parsed.toString();
}

function withSchema(value, label, schema) {
  const parsed = parsePostgresUrl(value, label);
  parsed.searchParams.set("schema", schema);
  return parsed.toString();
}

function describeDatabase(value, label) {
  const parsed = parsePostgresUrl(value, label);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, "")) || "(database non indicato)";
  const schema = parsed.searchParams.get("schema") || "public";
  return `${parsed.hostname}:${parsed.port || "5432"}/${database} schema=${schema}`;
}

function run(command, args, childEnv) {
  const executable = process.platform === "win32" ? `${command}.cmd` : command;
  const result = spawnSync(executable, args, {
    cwd: root,
    env: childEnv,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error(`${command} ${args.join(" ")} terminato con codice ${result.status}`);
    error.exitCode = result.status ?? 1;
    throw error;
  }
}

function integrationTestFiles() {
  const directory = path.join(root, "tests", "integration");
  if (!fs.existsSync(directory)) return [];

  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".integration.test.ts"))
    .sort()
    .map((file) => path.join("tests", "integration", file));
}

function runIntegrationTests(childEnv) {
  const testFiles = integrationTestFiles();

  if (testFiles.length === 0) {
    throw new Error("Nessun file *.integration.test.ts trovato in tests/integration");
  }

  console.log(`[integration] Eseguo ${testFiles.length} file di integrazione`);
  run(
    process.execPath,
    [
      "--conditions=react-server",
      "--disable-warning=ExperimentalWarning",
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "--experimental-transform-types",
      "--import",
      "./scripts/register-test-paths.mjs",
      "--test",
      "--test-concurrency=1",
      ...testFiles,
    ],
    childEnv
  );
}

function baseChildEnv({ databaseUrl, directDatabaseUrl, schema }) {
  const childEnv = {
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: databaseUrl,
    DIRECT_URL: directDatabaseUrl,
    AUTH_SECRET:
      process.env.AUTH_SECRET ||
      "integration-tests-only-secret-00000000000000000000000000000000",
  };

  if (schema) {
    childEnv.DATABASE_SCHEMA = schema;
  } else {
    delete childEnv.DATABASE_SCHEMA;
  }

  return childEnv;
}

let exitCode = 0;

if (useExistingSchema) {
  try {
    console.log(
      `[integration] CI: uso il database PostgreSQL effimero già predisposto (${describeDatabase(runtimeUrl, "TEST_DATABASE_URL")})`
    );

    const childEnv = baseChildEnv({
      databaseUrl: runtimeUrl,
      directDatabaseUrl: directUrl,
      schema: parsePostgresUrl(runtimeUrl, "TEST_DATABASE_URL").searchParams.get("schema") || undefined,
    });

    // In GitHub Actions il database è un service container nuovo per ogni job.
    // Verificare nuovamente le migration rende il comando autonomo e resta un no-op
    // quando lo step precedente le ha già applicate.
    console.log("[integration] Verifico Prisma Client e migration sul database CI");
    run("npx", ["--no-install", "prisma", "generate"], childEnv);
    run("npx", ["--no-install", "prisma", "migrate", "deploy"], childEnv);

    runIntegrationTests(childEnv);
  } catch (error) {
    exitCode = Number(error?.exitCode) || 1;
    console.error(
      `\n[integration] Fallimento: ${error instanceof Error ? error.message : String(error)}`
    );
  }
} else {
  const schema = `torneo_it_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const adminUrl = baseDatabaseUrl(directUrl, "TEST_DIRECT_URL/TEST_DATABASE_URL");
  const schemaDirectUrl = withSchema(directUrl, "TEST_DIRECT_URL/TEST_DATABASE_URL", schema);
  const schemaRuntimeUrl = withSchema(runtimeUrl, "TEST_DATABASE_URL", schema);
  const pool = new Pool({ connectionString: adminUrl, max: 1 });
  let schemaCreated = false;

  try {
    console.log(`[integration] Creo schema isolato ${schema}`);
    await pool.query(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;

    const childEnv = baseChildEnv({
      databaseUrl: schemaRuntimeUrl,
      directDatabaseUrl: schemaDirectUrl,
      schema,
    });

    console.log("[integration] Genero Prisma Client");
    run("npx", ["--no-install", "prisma", "generate"], childEnv);

    console.log("[integration] Verifico la catena di migration sullo schema temporaneo");
    run("npx", ["--no-install", "prisma", "migrate", "deploy"], childEnv);

    runIntegrationTests(childEnv);
  } catch (error) {
    exitCode = Number(error?.exitCode) || 1;
    console.error(
      `\n[integration] Fallimento: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    if (schemaCreated && env("KEEP_TEST_SCHEMA") !== "1") {
      try {
        console.log(`[integration] Elimino schema ${schema}`);
        await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      } catch (cleanupError) {
        console.error(
          `[integration] Impossibile eliminare lo schema temporaneo: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`
        );
        exitCode ||= 1;
      }
    } else if (schemaCreated) {
      console.warn(`[integration] KEEP_TEST_SCHEMA=1: schema conservato: ${schema}`);
    }
    await pool.end();
  }
}

if (exitCode === 0) {
  console.log("[integration] Tutti i flussi DB sono passati.");
}

process.exit(exitCode);
