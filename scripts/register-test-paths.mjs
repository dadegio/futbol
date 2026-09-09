#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = process.cwd();

function resolveExistingFile(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js"),
    path.join(basePath, "index.mjs"),
  ];

  return candidates.find((candidate) => {
    try {
      return fs.statSync(candidate).isFile();
    } catch {
      return false;
    }
  });
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return {
        url: pathToFileURL(path.join(root, "scripts", "server-only-test-stub.mjs")).href,
        shortCircuit: true,
      };
    }

    let candidateBase = null;

    if (specifier.startsWith("@/modules/")) {
      candidateBase = path.join(root, "src", specifier.slice(2));
    } else if (specifier.startsWith("@/")) {
      candidateBase = path.join(root, specifier.slice(2));
    } else if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const parentPath = fileURLToPath(context.parentURL);
      candidateBase = path.resolve(path.dirname(parentPath), specifier);
    }

    if (candidateBase) {
      const resolved = resolveExistingFile(candidateBase);
      if (resolved) {
        return {
          url: pathToFileURL(resolved).href,
          shortCircuit: true,
        };
      }
    }

    return nextResolve(specifier, context);
  },
});
