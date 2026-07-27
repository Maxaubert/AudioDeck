// Preflight for packaging: verifies the two helper executables that
// electron-builder.yml bundles as extraResources actually exist, and fails
// with a clear fix-it message when one is missing.

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const inputs = [
  {
    file: path.join(
      "audioctl", "bin", "x64", "Release", "net8.0", "win-x64", "publish", "audioctl.exe",
    ),
    fix: "Build it first: dotnet publish audioctl -c Release",
  },
  {
    file: path.join("vendor", "headsetcontrol.exe"),
    fix: "Fetch it first: powershell -File scripts/fetch-headsetcontrol.ps1",
  },
];

let ok = true;
for (const { file, fix } of inputs) {
  if (!existsSync(path.join(repoRoot, file))) {
    console.error(`Missing bundle input: ${file}\n  ${fix}`);
    ok = false;
  }
}

if (!ok) {
  console.error("Cannot package AudioDeck until the inputs above exist.");
  process.exit(1);
}
console.log("Bundle inputs OK: audioctl.exe and headsetcontrol.exe present.");
