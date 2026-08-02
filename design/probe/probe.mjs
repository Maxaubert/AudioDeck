// Compile one scratch NSIS script and photograph what it actually renders.
//
// The design questions here (can a drawn button drive the flow, does a private
// font load, does DPI awareness survive) cannot be answered from documentation
// or from a compile log. This gives a loop of roughly a second, using the
// makensis that electron-builder already downloaded, so none of it needs a
// full `npm run dist`.
//
//   node design/probe/probe.mjs p1-buttons.nsi [clickX clickY]

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ""));
const out = path.join(here, "out");
mkdirSync(out, { recursive: true });

/** electron-builder's cached NSIS, so the probes need no separate install. */
function findMakensis() {
  const cache = path.join(process.env.LOCALAPPDATA, "electron-builder", "Cache");
  const nsis = readdirSync(cache).find((d) => d.startsWith("nsis-3"));
  if (!nsis) throw new Error("no NSIS in electron-builder's cache; run `npm run dist` once");
  const root = path.join(cache, nsis);
  for (const dir of readdirSync(root)) {
    const exe = path.join(root, dir, "makensis.exe");
    if (existsSync(exe)) return exe;
  }
  throw new Error(`no makensis.exe under ${root}`);
}

const [script, clickX, clickY] = process.argv.slice(2);
if (!script) throw new Error("usage: probe.mjs <script.nsi> [clickX clickY]");

const src = path.join(here, script);
const name = path.basename(script, ".nsi");
const exe = path.join(out, `${name}.exe`);
const png = path.join(out, `${name}.png`);

let log;
try {
  log = execFileSync(findMakensis(), [`/XOutFile ${exe}`, src], { encoding: "utf8" });
} catch (err) {
  // makensis puts the useful line on stderr; a node stack on top of it helps
  // nobody.
  console.error(`makensis failed:\n${(err.stderr || err.stdout || "").trim()}`);
  process.exit(1);
}
const warn = log.split("\n").filter((l) => /warning/i.test(l));
console.log(`compiled ${name}${warn.length ? `\n  ${warn.join("\n  ")}` : ""}`);

const args = ["-NoProfile", "-File", path.join(here, "capture.ps1"), "-Exe", exe, "-Out", png];
if (clickX !== undefined) args.push("-ClickX", clickX, "-ClickY", clickY);
console.log(execFileSync("pwsh", args, { encoding: "utf8" }).trim());
