// Verifies the themed cursors are actually painted. Chromium reports
// type 'custom' through webContents 'cursor-changed' only when it accepted the
// image, so a refused or mis-sized cursor shows up here as a keyword instead.
// The bitmap it hands back is fingerprinted too, so "custom" cannot pass by
// six elements all sharing one cursor.
// `node design/cursor-check.mjs`

import { _electron as electron } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appData = await mkdtemp(path.join(os.tmpdir(), "audiodeck-cursor-"));

// A fresh APPDATA means a first run, and the first-run guide is a modal that
// swallows every pointer event this script is here to probe. Mark it seen.
await mkdir(path.join(appData, "AudioDeck"), { recursive: true });
await writeFile(
  path.join(appData, "AudioDeck", "config.json"),
  JSON.stringify({ schemaVersion: 2, guideSeen: true }, null, 2),
  "utf8",
);

const app = await electron.launch({
  args: ["."],
  cwd: repoRoot,
  env: {
    ...process.env,
    AUDIODECK_TEST_MODE: "1",
    AUDIODECK_MOCK_DEVICES: "1",
    AUDIODECK_HIDDEN_WINDOW: "1",
    APPDATA: appData,
  },
});

const page = await app.firstWindow();
await page.waitForSelector('[data-loaded="true"]', { timeout: 30_000 });
await page.waitForTimeout(1500);

await app.evaluate(({ BrowserWindow }) => {
  const win = BrowserWindow.getAllWindows()[0];
  globalThis.__cursors = [];
  win.webContents.on("cursor-changed", (_e, type, image, scale, size, hotspot) => {
    // Alpha bounding boxes of the accepted bitmap: the whole glyph, plus the
    // topmost slice of it (fingertip / arrow apex), so the geometry checks
    // below compare hotspots against the drawn art, not the declared numbers.
    let art = null;
    let tip = null;
    if (image !== undefined && image !== null && !image.isEmpty()) {
      const { width: w, height: h } = image.getSize();
      const px = image.toBitmap(); // BGRA
      let minX = w;
      let minY = h;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if (px[(y * w + x) * 4 + 3] > 8) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
      if (maxX >= 0) {
        art = { minX, minY, maxX, maxY };
        let tMin = w;
        let tMax = -1;
        const tCut = minY + Math.max(2, Math.round((maxY - minY) * 0.08));
        for (let y = minY; y <= tCut; y++)
          for (let x = 0; x < w; x++)
            if (px[(y * w + x) * 4 + 3] > 8) {
              if (x < tMin) tMin = x;
              if (x > tMax) tMax = x;
            }
        tip = { minX: tMin, maxX: tMax };
      }
    }
    globalThis.__cursors.push({
      type,
      url: image === undefined || image === null || image.isEmpty() ? null : image.toDataURL(),
      size: size === undefined ? null : `${size.width}x${size.height}`,
      scale: scale ?? null,
      hotspot: hotspot === undefined ? null : { x: hotspot.x, y: hotspot.y },
      art,
      tip,
    });
  });
});

const drain = async () =>
  app.evaluate(() => {
    const out = globalThis.__cursors;
    globalThis.__cursors = [];
    return out;
  });

const boxOf = async (locator) => {
  const b = await locator.boundingBox();
  if (b === null) throw new Error("element has no box");
  return b;
};

// cursor-changed only fires on a change, so each probe parks somewhere that
// carries a DIFFERENT cursor first. Parking on a match reports nothing and
// would read as a failure.
const results = [];
async function at(label, locator, dx = 0.5, dy = 0.5, refLocator = null) {
  const b = await boxOf(locator);
  const reference = await boxOf(refLocator ?? page.locator(".view-hint"));
  await page.mouse.move(reference.x + reference.width / 2, reference.y + reference.height / 2);
  await page.waitForTimeout(140);
  await drain();
  await page.mouse.move(b.x + b.width * dx, b.y + b.height * dy);
  await page.waitForTimeout(260);
  const seen = (await drain()).at(-1) ?? null;
  const custom = seen !== null && seen.type === "custom" && seen.url !== null;
  const print = custom ? createHash("sha1").update(seen.url).digest("hex").slice(0, 8) : "-";
  console.log(
    `${custom ? "OK  " : "FAIL"} ${label.padEnd(22)} type=${seen?.type ?? "none"} ` +
      `size=${seen?.size ?? "-"} scale=${seen?.scale ?? "-"} print=${print}`,
  );
  results.push({ label, custom, print, seen });
  return print;
}

const mute = page.getByRole("button", { name: "Mute", exact: true }).first();

await at("button (hand)", mute);
await at("tab (hand)", page.getByRole("button", { name: "Settings", exact: true }));
// Left of the rank slab, clear of the fader: the row's own grab cursor.
await at("row (grab)", page.locator(".device-strip").first(), 0.35);
// Parks on a button, since the hint text carries the arrow being probed.
await at("page background", page.locator(".view-hint"), 0.98, 0.5, mute);

const tv = page.locator(".device-strip").nth(1);
await tv.getByRole("button", { name: /^Settings for/ }).click();
await tv.getByRole("button", { name: "Rename", exact: true }).click();
await at("rename field (beam)", tv.getByLabel(/New name for/));
await tv.getByRole("button", { name: "Cancel", exact: true }).click();
await tv.getByRole("button", { name: /^Settings for/ }).click();

// The lock stamp carries the help cursor; provoke the lock first.
const arctis = page.locator(".device-strip", { hasText: "Arctis Nova Pro Wireless" }).first();
await arctis.getByRole("slider").fill("70");
await page.waitForTimeout(2500);
await at("lock stamp (help)", arctis.locator(".vol-lock"));

// grabbing only exists while a row is held, so it needs its own pass.
{
  const hint = await boxOf(page.locator(".view-hint"));
  const row = await boxOf(page.locator(".device-strip").first());
  await page.mouse.move(hint.x + hint.width / 2, hint.y + hint.height / 2);
  await page.waitForTimeout(140);
  await drain();
  await page.mouse.move(row.x + row.width * 0.35, row.y + row.height / 2);
  await page.waitForTimeout(150);
  await drain();
  await page.mouse.down();
  await page.waitForTimeout(260);
  const seen = (await drain()).at(-1) ?? null;
  const custom = seen !== null && seen.type === "custom" && seen.url !== null;
  const print = custom ? createHash("sha1").update(seen.url).digest("hex").slice(0, 8) : "-";
  console.log(
    `${custom ? "OK  " : "FAIL"} ${"row held (grabbing)".padEnd(22)} ` +
      `type=${seen?.type ?? "none"} size=${seen?.size ?? "-"} print=${print}`,
  );
  results.push({ label: "row held (grabbing)", custom, print, seen });
  await page.mouse.up();
}

// Geometry: hotspots against the drawn art, in CSS px (device px / scale).
// Anchor conventions, which screen magnification centered on the pointer makes
// visible: arrow and help at the tip apex, hand at the fingertip, beam at the
// art center, grab and grabbing at one shared center-of-hand. The two hands
// must also read as the same hand, so their drawn sizes have to match.
console.log("");
const geometryFailures = [];
const check = (label, ok, detail) => {
  console.log(`${ok ? "OK  " : "FAIL"} ${label.padEnd(30)} ${detail}`);
  if (!ok) geometryFailures.push(label);
};
const by = (label) => {
  const r = results.find((x) => x.label === label);
  return r?.custom && r.seen?.art && r.seen?.hotspot ? r : null;
};
const css = (r) => {
  const s = r.seen.scale || 1;
  const { hotspot, art, tip } = r.seen;
  return {
    hx: hotspot.x / s,
    hy: hotspot.y / s,
    y0: art.minY / s,
    cx: (art.minX + art.maxX) / 2 / s,
    cy: (art.minY + art.maxY) / 2 / s,
    tipX: (tip.minX + tip.maxX) / 2 / s,
    w: (art.maxX - art.minX) / s,
    h: (art.maxY - art.minY) / s,
  };
};
const near = (a, b) => Math.abs(a - b) <= 2;
const fmt = (c) => `hotspot=(${c.hx.toFixed(1)},${c.hy.toFixed(1)})`;

const gHand = by("button (hand)");
const gGrab = by("row (grab)");
const gGrabbing = by("row held (grabbing)");
const tipChecks = [
  ["hand hotspot at fingertip", gHand],
  ["arrow hotspot at tip apex", by("page background")],
  ["help hotspot at tip apex", by("lock stamp (help)")],
];
for (const [label, r] of tipChecks) {
  if (r === null) check(label, false, "no geometry captured");
  else {
    const c = css(r);
    check(label, near(c.hx, c.tipX) && near(c.hy, c.y0), `${fmt(c)} tip=(${c.tipX.toFixed(1)},${c.y0.toFixed(1)})`);
  }
}
const centerChecks = [
  ["beam hotspot at art center", by("rename field (beam)")],
  ["grab hotspot at hand center", gGrab],
];
for (const [label, r] of centerChecks) {
  if (r === null) check(label, false, "no geometry captured");
  else {
    const c = css(r);
    check(label, near(c.hx, c.cx) && near(c.hy, c.cy), `${fmt(c)} center=(${c.cx.toFixed(1)},${c.cy.toFixed(1)})`);
  }
}
if (gGrabbing === null || gGrab === null) check("grabbing shares grab anchor", false, "no geometry captured");
else {
  const a = gGrab.seen.hotspot;
  const b = gGrabbing.seen.hotspot;
  check("grabbing shares grab anchor", a.x === b.x && a.y === b.y, `grab=(${a.x},${a.y}) grabbing=(${b.x},${b.y})`);
}
// The Windows full-screen Magnifier draws cursors larger than the system
// cursor frame (64 device px on this machine) shifted away from the real
// pointer position; see the comment block in styles.css. Chromium reports the
// device size it rasterised, so oversized cursors fail here before a
// magnifier user has to find them.
for (const r of results) {
  if (!r.custom || !r.seen?.size) continue;
  const [w, h] = r.seen.size.split("x").map(Number);
  if (w > 64 || h > 64) check(`magnifier-safe size (${r.label})`, false, `device ${r.seen.size} exceeds 64px frame`);
}

if (gGrab === null || gHand === null) check("grab sized like pointer hand", false, "no geometry captured");
else {
  const g = css(gGrab);
  const h = css(gHand);
  const ratioOk = (a, b) => a / b >= 0.9 && a / b <= 1.15;
  check(
    "grab sized like pointer hand",
    ratioOk(g.w, h.w) && ratioOk(g.h, h.h),
    `grab=${g.w.toFixed(1)}x${g.h.toFixed(1)} hand=${h.w.toFixed(1)}x${h.h.toFixed(1)}`,
  );
}

const failed = results.filter((r) => !r.custom);
const prints = new Set(results.filter((r) => r.custom).map((r) => r.print));
console.log(`\n${results.length} probed, ${prints.size} distinct cursor images`);
if (failed.length > 0) console.log("NOT THEMED:", failed.map((r) => r.label).join(", "));
if (geometryFailures.length > 0) console.log("BAD GEOMETRY:", geometryFailures.join(", "));

await app.close();
await rm(appData, { recursive: true, force: true });
process.exit(failed.length === 0 && geometryFailures.length === 0 && prints.size >= 4 ? 0 : 1);
