// Verifies the themed cursors are actually painted. Chromium reports
// type 'custom' through webContents 'cursor-changed' only when it accepted the
// image, so a refused or mis-sized cursor shows up here as a keyword instead.
// The bitmap it hands back is fingerprinted too, so "custom" cannot pass by
// six elements all sharing one cursor.
// `node design/cursor-check.mjs`

import { _electron as electron } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appData = await mkdtemp(path.join(os.tmpdir(), "audiodeck-cursor-"));

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
  win.webContents.on("cursor-changed", (_e, type, image, scale, size) => {
    globalThis.__cursors.push({
      type,
      url: image === undefined || image === null || image.isEmpty() ? null : image.toDataURL(),
      size: size === undefined ? null : `${size.width}x${size.height}`,
      scale: scale ?? null,
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
  results.push({ label, custom, print });
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
  results.push({ label: "row held (grabbing)", custom, print });
  await page.mouse.up();
}

const failed = results.filter((r) => !r.custom);
const prints = new Set(results.filter((r) => r.custom).map((r) => r.print));
console.log(`\n${results.length} probed, ${prints.size} distinct cursor images`);
if (failed.length > 0) console.log("NOT THEMED:", failed.map((r) => r.label).join(", "));

await app.close();
await rm(appData, { recursive: true, force: true });
process.exit(failed.length === 0 && prints.size >= 4 ? 0 : 1);
