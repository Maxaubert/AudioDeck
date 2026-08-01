// Preflight for packaging: verifies the two helper executables that
// electron-builder.yml bundles as extraResources exist, and that audioctl.exe
// is not older than its C# sources (a stale helper once shipped an
// experimental rename; this check makes that impossible to repeat).

import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const audioctlExe = path.join(
  "audioctl", "bin", "x64", "Release", "net8.0", "win-x64", "publish", "audioctl.exe",
);
const inputs = [
  {
    file: audioctlExe,
    fix: "Build it first: dotnet publish audioctl -c Release (see audioctl.csproj notes)",
  },
  {
    file: path.join("vendor", "headsetcontrol.exe"),
    fix: "Fetch it first: powershell -File scripts/fetch-headsetcontrol.ps1",
  },
  {
    // Ships inside AudioDeck so the Studio tab can set up audio effects
    // without sending the user off to find a second tool.
    file: path.join("vendor", "equalizerapo-setup.exe"),
    fix: "Fetch it first: powershell -File scripts/fetch-equalizerapo.ps1",
  },
  {
    // Generated rather than committed: deterministic, so a rebuild reproduces
    // the same bytes.
    file: path.join("assets", "ir", "audiodeck-cathedral-48000.wav"),
    fix: "Generate them first: node scripts/make-reverb-ir.mjs",
  },
];

let ok = true;
for (const { file, fix } of inputs) {
  if (!existsSync(path.join(repoRoot, file))) {
    console.error(`Missing bundle input: ${file}\n  ${fix}`);
    ok = false;
  }
}

if (ok) {
  const exeTime = statSync(path.join(repoRoot, audioctlExe)).mtimeMs;
  const newestSource = newestCsTime(path.join(repoRoot, "audioctl"));
  if (newestSource.time > exeTime) {
    console.error(
      `Stale bundle input: ${audioctlExe} is older than ${newestSource.file}.\n` +
        "  Rebuild it: dotnet publish audioctl -c Release (see audioctl.csproj notes)",
    );
    ok = false;
  }
}

if (!ok) {
  console.error("Cannot package AudioDeck until the inputs above are fixed.");
  process.exit(1);
}
console.log(
  "Bundle inputs OK: audioctl.exe fresh, headsetcontrol.exe and equalizerapo-setup.exe present.",
);

function newestCsTime(dir) {
  let newest = { file: "", time: 0 };
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "bin" || entry.name === "obj") continue;
      const sub = newestCsTime(full);
      if (sub.time > newest.time) newest = sub;
    } else if (entry.name.endsWith(".cs") || entry.name.endsWith(".csproj")) {
      const t = statSync(full).mtimeMs;
      if (t > newest.time) newest = { file: path.relative(path.resolve(dir, ".."), full), time: t };
    }
  }
  return newest;
}
