#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const isVercelProduction =
  process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production";

function run(command, args) {
  const executable = process.platform === "win32" ? `${command}.cmd` : command;
  const result = spawnSync(executable, args, {
    stdio: "inherit",
    env: process.env,
    shell: false,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (isVercelProduction) {
  console.log("[build] Deploy produzione Vercel: applico le migration Prisma prima della build.");
  run("npm", ["run", "db:deploy"]);
} else if (process.env.VERCEL === "1") {
  console.log(`[build] Vercel ${process.env.VERCEL_ENV ?? "preview"}: migration produzione saltate.`);
} else {
  console.log("[build] Build locale/CI: migration automatiche saltate.");
}

run("npm", ["run", "prisma:generate"]);
run("npx", ["--no-install", "next", "build"]);
