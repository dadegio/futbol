#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const major = Number(process.versions.node.split(".")[0]);
if (!Number.isInteger(major) || major < 22) {
  console.error(
    `[tests] Node 22+ richiesto per eseguire i test TypeScript senza dipendenze aggiuntive. Versione corrente: ${process.versions.node}`
  );
  process.exit(1);
}

const testsDir = path.join(process.cwd(), "tests");
const files = fs
  .readdirSync(testsDir)
  .filter((file) => file.endsWith(".test.ts"))
  .sort()
  .map((file) => path.join("tests", file));

if (files.length === 0) {
  console.error("[tests] Nessun file *.test.ts trovato in tests/.");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [
    "--disable-warning=ExperimentalWarning",
    "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
    "--experimental-strip-types",
    "--test",
    ...files,
  ],
  { stdio: "inherit" }
);

process.exit(result.status ?? 1);