// Packages AudioDeck: the NSIS Setup, then the Portable exe.
//
// Two passes because they bundle different resources. The Equalizer APO setup
// (12 MB) only serves the Setup's own wizard page and the in-app "Set up
// effects" button. The Portable build has no wizard, and its button opens the
// Equalizer APO download page instead (electron/eqapo/install.ts), so carrying
// the setup there was dead weight. electron-builder has no per-target
// extraResources, so the Portable pass gets the same config minus that entry,
// written to a file: a config OBJECT passed to build() is merged with
// electron-builder.yml (arrays concatenated), so it cannot remove anything.
//
//   node scripts/dist.mjs   (npm run dist runs the preflight and build first)

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, Platform } from "electron-builder";
import yaml from "js-yaml";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = yaml.load(readFileSync(path.join(repoRoot, "electron-builder.yml"), "utf8"));

const EQAPO = "vendor/equalizerapo-setup.exe";

await build({
  projectDir: repoRoot,
  targets: Platform.WINDOWS.createTarget(["nsis"]),
  publish: "never",
});

const portableResources = config.extraResources.filter((r) => r.from !== EQAPO);
if (portableResources.length !== config.extraResources.length - 1) {
  throw new Error(`dist: expected exactly one extraResources entry for ${EQAPO}`);
}

const outDir = path.join(repoRoot, "dist");
mkdirSync(outDir, { recursive: true });
const portableConfig = path.join(outDir, "electron-builder.portable.json");
writeFileSync(portableConfig, JSON.stringify({ ...config, extraResources: portableResources }, null, 2));

await build({
  projectDir: repoRoot,
  targets: Platform.WINDOWS.createTarget(["portable"]),
  config: portableConfig,
  publish: "never",
});
