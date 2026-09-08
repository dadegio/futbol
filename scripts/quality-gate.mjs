#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const withBuild = args.has("--with-build");

const steps = [
  ["Architettura", "npm", ["run", "check:architecture"]],
  ["Service checks", "npm", ["run", "check:services"]],
  ["Domain tests", "npm", ["test"]],
  ["TypeScript", "npm", ["run", "typecheck"]],
];

if (withBuild) {
  steps.push(["Build Next.js", "npm", ["run", "build"]]);
}

for (const [label, command, commandArgs] of steps) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    console.error(`\n[quality] Step fallito: ${label}`);
    process.exit(result.status ?? 1);
  }
}

console.log("\n[quality] Tutti i controlli sono passati.");
