// Regressions for the high-severity defects the code audit turned up.

import { expect, test } from "@playwright/test";
import { readdir } from "node:fs/promises";
import { launchApp, readConfigFile } from "./helpers.js";
import type { LaunchedApp } from "./helpers.js";
import type { AudioDeckApi } from "../shared/ipc.js";

/** The preload bridge, as seen from inside the page. */
declare global {
  interface Window {
    audiodeck: AudioDeckApi;
  }
}

let ctx: LaunchedApp | null = null;

test.afterEach(async () => {
  await ctx?.close();
  ctx = null;
});

test("a fader that has been clicked still follows the daemon", async () => {
  // A range input keeps focus after a click, and the sync effect used to skip
  // whenever the input had focus, so the row stopped following the daemon for
  // the rest of its life. Its debounced commit then wrote the stale value back
  // over every media-key and Windows-mixer change, including while AudioDeck
  // was not the focused app.
  ctx = await launchApp();
  const { page } = ctx;

  const fader = page.getByRole("slider", { name: /volume$/ }).first();
  await fader.click();
  await expect(fader).toBeFocused();
  await page.waitForTimeout(600);

  // A change from somewhere else entirely, the way a media key arrives.
  const target = await page.evaluate(async () => {
    const state = await window.audiodeck.getState();
    const device = state.devices.find((d) => d.volume !== null && !d.volumeLocked);
    if (device === undefined) return null;
    const next = (device.volume ?? 0) > 50 ? 20 : 80;
    await window.audiodeck.setVolume(device.id, next);
    return { id: device.id, next };
  });
  expect(target).not.toBeNull();

  // The fader shows the new level rather than putting the old one back.
  await expect
    .poll(async () => Number(await fader.inputValue()), { timeout: 8000 })
    .toBe(target?.next);
});

test("reordering keeps the rank of a device that is not currently present", async () => {
  // The ranked list hides devices Windows reports as notpresent, and a reorder
  // used to send only the visible ids as the whole priority list, so one drag
  // while anything was unplugged deleted its slot for good.
  ctx = await launchApp();
  const { page, configFile } = ctx;

  const stored = (await readConfigFile(configFile)).outputPriority;
  expect(stored.length).toBeGreaterThan(1);

  // A device Windows still reports, but as notpresent: remembered rather than
  // connected. The ranked list hides it; the stored priority must not lose it.
  // An id Windows does not report at all is a different case, and the poller
  // is right to prune those.
  const ghost = "mock-out-ghost";
  const seeded = [stored[0] as string, ghost, ...stored.slice(1)];
  await page.evaluate(async (ids: string[]) => {
    await window.audiodeck.setPriority("render", ids);
  }, seeded);
  await expect.poll(async () => (await readConfigFile(configFile)).outputPriority).toEqual(seeded);

  const outputs = page.getByRole("list", { name: "Output priority" });
  await outputs.getByRole("listitem").first().focus();
  await page.keyboard.press("Alt+ArrowDown");

  // The visible rows swapped, and the invisible one kept its place.
  await expect
    .poll(async () => (await readConfigFile(configFile)).outputPriority)
    .toEqual([stored[1] as string, ghost, stored[0] as string, ...stored.slice(2)]);
});

test("a config.json that will not parse is set aside, not fatal", async () => {
  // loadConfig throws rather than discarding data it cannot read. Unhandled,
  // that left a process holding the single-instance lock with no tray, no
  // window and no poller, and every relaunch then quit silently: the app looked
  // uninstallable rather than broken.
  ctx = await launchApp('{"outputPriority": [1,2');
  const { page, configDir } = ctx;

  // Up and usable, on defaults.
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeVisible();

  // The unreadable file is kept, not overwritten: it is the user's data, and
  // usually one bad character away from everything they set up.
  const kept = (await readdir(configDir)).filter((f) => f.endsWith(".bad"));
  expect(kept).toHaveLength(1);
});

test("pausing from either surface leaves the same thing on disk", async () => {
  // The tray and the Settings page are two doors onto one flag. Only the
  // Settings one used to write it down, so a tray pause was forgotten at
  // restart and a tray unpause could leave paused:true on disk forever.
  ctx = await launchApp({ paused: true });
  const { page, configFile } = ctx;
  await expect(page.locator(".paused-banner")).toBeVisible();

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("switch", { name: /Pause automation/ }).click();
  await expect.poll(async () => (await readConfigFile(configFile)).paused).toBe(false);
  await expect(page.locator(".paused-banner")).toHaveCount(0);
});
