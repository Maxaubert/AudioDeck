// e2e: the app launches in test mode and both device views render the mocked
// data (priority lists, the merged Devices view with its faders and panels).

import { expect, test } from "@playwright/test";
import { launchApp, readConfigFile } from "./helpers.js";
import type { LaunchedApp } from "./helpers.js";

let ctx: LaunchedApp;

test.beforeEach(async () => {
  ctx = await launchApp();
});

test.afterEach(async () => {
  await ctx.close();
});

test("launches into the one device page, ranked devices only", async () => {
  const { page } = ctx;
  await expect(page.getByRole("heading", { name: "Devices", exact: true })).toBeVisible();
  // The Priority tab is gone; its job is this page's ordering.
  await expect(page.getByRole("button", { name: "Priority", exact: true })).toHaveCount(0);

  // Names render split: clean title, technical part as the sub line.
  const outputs = page.getByRole("list", { name: "Output priority" });
  await expect(
    outputs.getByRole("listitem").filter({ hasText: "Arctis Nova Pro Wireless" }),
  ).toBeVisible();
  await expect(
    outputs.getByRole("listitem").filter({ hasText: "NVIDIA High Definition Audio" }),
  ).toBeVisible();
  // Windows default seeds first and carries the amber outline (no badge).
  await expect(outputs.getByRole("listitem").first()).toContainText("Arctis Nova Pro");
  await expect(outputs.getByRole("listitem").first()).toHaveClass(/is-default/);

  // Everything outside the ranking stays hidden until asked for.
  await expect(outputs.getByRole("listitem")).toHaveCount(2);
  await expect(page.locator(".device-name", { hasText: "Realtek(R) Audio" })).toHaveCount(0);
  await expect(page.locator(".device-name", { hasText: "AirPods Pro" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Show remembered devices/ })).toHaveCount(0);

  const mics = page.getByRole("list", { name: "Microphone priority" });
  await expect(
    mics.getByRole("listitem").filter({ hasText: "Arctis Nova Pro Wireless" }),
  ).toBeVisible();
  await expect(
    mics.getByRole("listitem").filter({ hasText: "Logitech BRIO" }),
  ).toBeVisible();
  // Every mic is ranked, so that section offers no reveal at all.
  await expect(page.getByRole("button", { name: /More microphones/ })).toHaveCount(0);
});

test("More devices reveals the rest below the same button", async () => {
  const { page } = ctx;
  const outputs = page.getByRole("list", { name: "Output priority" });
  const others = page.getByRole("list", { name: "Other outputs" });

  const reveal = page.getByRole("button", { name: "+ More outputs (2)" });
  await expect(reveal).toHaveAttribute("aria-expanded", "false");
  await expect(others).toHaveCount(0);
  const buttonBefore = await reveal.boundingBox();
  await reveal.click();

  // The revealed rows open below the button, which stays where it was, so the
  // control you just pressed is still under the cursor to close again.
  const collapse = page.getByRole("button", { name: "Fewer devices" });
  const buttonAfter = await collapse.boundingBox();
  expect(buttonAfter?.y).toBeCloseTo(buttonBefore?.y ?? -1, 0);
  const listTop = (await others.boundingBox())?.y ?? 0;
  expect(listTop).toBeGreaterThan(buttonAfter?.y ?? 0);

  // They are ordinary rows with no rank number and a + to rank them.
  const airpods = others.locator(".device-strip", { hasText: "AirPods Pro" });
  await expect(airpods.locator(".rank.is-unranked")).toBeVisible();
  await expect(airpods.getByRole("button", { name: "Add Headphones to priority" })).toBeVisible();
  // Ranked rows offer no +; they already have a place.
  await expect(outputs.getByRole("button", { name: /Add LG TV to priority/ })).toHaveCount(0);

  // Endpoints Windows merely remembers are not hardware you have, so they
  // never appear and there is no toggle for them.
  await expect(page.locator(".device-name", { hasText: "Digital Output" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /remembered devices/i })).toHaveCount(0);

  await collapse.click();
  await expect(others).toHaveCount(0);
});

test("every row is the same height, however long the name", async () => {
  const { page } = ctx;

  // A name far too long for its column, plus a badge next to it: the case that
  // used to wrap the title above the badge and push the row to three lines.
  const tv = page.locator(".device-strip", { hasText: "LG TV" });
  await tv.getByRole("button", { name: /^Settings for/ }).click();
  await tv.getByRole("button", { name: "Rename", exact: true }).click();
  await tv.getByLabel(/New name for/).fill("Living room television over HDMI, second input");
  await tv.getByRole("button", { name: "Save name", exact: true }).click();
  await expect(page.locator(".device-strip", { hasText: "Living room television" })).toBeVisible();

  // Show everything, including the offline rows that carry the most badges.
  await page.getByRole("button", { name: /More outputs/ }).click();

  const heights = await page
    .locator(".device-strip:not(.is-expanded)")
    .evaluateAll((rows) => rows.map((r) => Math.round(r.getBoundingClientRect().height)));
  expect(heights.length).toBeGreaterThan(4);
  expect([...new Set(heights)]).toHaveLength(1);

  // The long name is truncated rather than wrapped, and kept in full on hover.
  const renamed = page.locator(".device-strip", { hasText: "Living room television" });
  await expect(renamed.locator(".device-title")).toHaveCSS("text-overflow", "ellipsis");
  await expect(renamed.locator(".device-title")).toHaveAttribute(
    "title",
    "Living room television over HDMI, second input",
  );
});

test("a ranked device Windows no longer reports gets no row", async () => {
  // Per-session virtual endpoints (VR streaming, Sonar) mint a fresh id every
  // session and delete the old one, leaving ranked ids that resolve to nothing.
  // The daemon prunes them only after a long absence, so the list must not
  // print a nameless "Not connected" row in the meantime.
  await ctx.close();
  ctx = await launchApp({ outputPriority: ["{0.0.0.00000000}.{dead-endpoint}", "mock-out-tv"] });
  const { page } = ctx;

  const outputs = page.getByRole("list", { name: "Output priority" });
  await expect(outputs.getByText("Not connected")).toHaveCount(0);

  // The real devices still render, numbered from 1 with no gap where the
  // orphan sat, and the orphan stays in the config for the daemon to prune.
  const rows = outputs.getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("LG TV");
  await expect(rows.nth(0).locator(".rank")).toHaveText("1");
  await expect(rows.nth(1).locator(".rank")).toHaveText("2");
  await expect
    .poll(async () => (await readConfigFile(ctx.configFile)).outputPriority[0])
    .toBe("{0.0.0.00000000}.{dead-endpoint}");
});

test("every ranked active device has a fader and a mute", async () => {
  const { page } = ctx;
  await expect(
    page.getByRole("slider", { name: "Speakers (Arctis Nova Pro Wireless) volume" }),
  ).toHaveValue("40");
  await expect(
    page.getByRole("slider", { name: "LG TV (NVIDIA High Definition Audio) volume" }),
  ).toHaveValue("25");
  await expect(
    page.getByRole("slider", { name: "Microphone (Logitech BRIO) volume" }),
  ).toHaveValue("65");
  await expect(page.getByRole("button", { name: "Mute", exact: true })).toHaveCount(4);

  // A revealed disabled endpoint gets no fader, and carries Enable in the
  // collapsed row: it is the only thing that row can do. Disable is the one
  // that hides in the panel.
  await page.getByRole("button", { name: /More outputs/ }).click();
  const realtek = page.locator(".device-strip", { hasText: "Realtek(R) Audio" });
  await expect(
    page.getByRole("slider", { name: "Speakers (Realtek(R) Audio) volume" }),
  ).toHaveCount(0);
  await expect(realtek.locator(".na")).toHaveText("Unavailable");
  await expect(realtek.getByRole("button", { name: "Enable", exact: true })).toBeVisible();
  const airpods = page.locator(".device-strip", { hasText: "AirPods Pro" });
  await expect(airpods.getByRole("button", { name: "Enable", exact: true })).toHaveCount(0);
});

test("the expander holds the management controls, one panel at a time", async () => {
  const { page } = ctx;
  const tv = page.locator(".device-strip", { hasText: "NVIDIA High Definition Audio" });
  const arctis = page.locator(".device-strip", { hasText: "Arctis Nova Pro Wireless" }).first();

  // Nothing is open at rest, and the type dropdown is not on the row.
  await expect(page.locator(".device-panel")).toHaveCount(0);
  const tvExpander = tv.getByRole("button", { name: /^Settings for/ });
  await expect(tvExpander).toHaveAttribute("aria-expanded", "false");

  await tvExpander.click();
  await expect(tv.locator(".device-panel")).toBeVisible();
  await expect(tvExpander).toHaveAttribute("aria-expanded", "true");

  // The type dropdown reflects the form factor and changes it globally.
  const tvType = tv.getByRole("combobox", { name: /Device type/ });
  await expect(tvType).toHaveValue("tv");
  await tvType.selectOption("speakers");
  await expect(tvType).toHaveValue("speakers");

  // Opening another row's panel closes this one, so the list never becomes a
  // wall of open drawers.
  await arctis.getByRole("button", { name: /^Settings for/ }).click();
  await expect(arctis.locator(".device-panel")).toBeVisible();
  await expect(tv.locator(".device-panel")).toHaveCount(0);

  // And the expander toggles its own panel shut.
  await arctis.getByRole("button", { name: /^Settings for/ }).click();
  await expect(page.locator(".device-panel")).toHaveCount(0);
});

test("renaming from the panel changes the device name globally", async () => {
  const { page } = ctx;
  const tv = page.locator(".device-strip", { hasText: "LG TV" });
  await tv.getByRole("button", { name: /^Settings for/ }).click();
  await tv.getByRole("button", { name: "Rename", exact: true }).click();
  await tv.getByLabel(/New name for/).fill("Stue TV");
  await tv.getByLabel(/New parenthesized text for/).fill("Stua");
  await tv.getByRole("button", { name: "Save name", exact: true }).click();

  // Both parts land: clean title and the custom suffix as the sub line.
  const renamed = page.locator(".device-strip", { hasText: "Stue TV" });
  await expect(renamed).toBeVisible();
  await expect(renamed.getByText("Stua", { exact: true })).toBeVisible();
});

test("an active device outside the ranking still has a working fader", async () => {
  const { page } = ctx;
  // Dropping a device from the ranking leaves it active but unranked. The old
  // Mixer listed only ranked devices, so this row lost its fader entirely.
  const tv = page.locator(".device-strip", { hasText: "NVIDIA High Definition Audio" });
  await tv.getByRole("button", { name: /^Settings for/ }).click();
  await tv.getByRole("button", { name: "Remove from priority", exact: true }).click();

  await page.getByRole("button", { name: /More outputs/ }).click();

  // Below the break, no rank number, and its volume is still controllable.
  await expect(tv.locator(".rank.is-unranked")).toBeVisible();
  const fader = tv.getByRole("slider");
  await expect(fader).toBeVisible();
  await fader.fill("70");
  await expect(fader).toHaveValue("70", { timeout: 5000 });
});

test("a volume change survives leaving the page immediately", async () => {
  const { page } = ctx;
  const fader = page.getByRole("slider", { name: "LG TV (NVIDIA High Definition Audio) volume" });
  await fader.fill("70");
  // Leave well inside the 200ms debounce window.
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.waitForTimeout(900);

  // Coming back, the daemon holds the new level rather than the old one.
  await page.getByRole("button", { name: "Devices", exact: true }).click();
  await expect(
    page.getByRole("slider", { name: "LG TV (NVIDIA High Definition Audio) volume" }),
  ).toHaveValue("70", { timeout: 5000 });
});

test("a device that ignores volume writes gets the on-device stamp", async () => {
  const { page } = ctx;
  const arctis = page
    .locator(".device-strip")
    .filter({ hasText: "Arctis Nova Pro Wireless" })
    .first();
  await expect(arctis.locator(".vol-lock")).toHaveCount(0);

  // The mocked headset accepts the write and reverts, like its real hardware.
  await arctis.getByRole("slider").fill("70");

  const stamp = arctis.locator(".vol-lock");
  await expect(stamp).toBeVisible({ timeout: 5000 });
  // No fader, no meter, and no percentage: the level lives on the hardware and
  // the number Windows reports for these endpoints is not it.
  await expect(arctis.getByRole("slider")).toHaveCount(0);
  await expect(arctis.locator(".segs")).toHaveCount(0);
  await expect(arctis.locator(".volume-value")).toHaveText("--");
  await expect(arctis.locator(".na")).toHaveText("Volume set on the device");

  // The reason names the hardware, is wired to the stamp for screen readers,
  // and stays hidden until the stamp is hovered or focused. Focus is the route
  // asserted here: a synthetic cursor loses its hover target whenever the poll
  // re-renders the row, so hover cannot be measured reliably from a test.
  const tip = arctis.locator(".vol-lock-tip");
  await expect(tip).toContainText("Arctis Nova Pro Wireless sets its own volume");
  await expect(stamp).toHaveAttribute("aria-describedby", (await tip.getAttribute("id")) ?? "");
  await expect(tip).toHaveCSS("opacity", "0");

  await stamp.focus();
  await expect(tip).toHaveCSS("opacity", "1");
  await stamp.blur();
  await expect(tip).toHaveCSS("opacity", "0");
});

test("clicking a device row switches to it, but the fader does not", async () => {
  const { page } = ctx;
  const lg = page.locator(".device-strip", { hasText: "NVIDIA High Definition Audio" });
  await expect(lg).not.toHaveClass(/is-default/);

  // The name area switches device, and the UI shows it without waiting for
  // Windows. Choosing by hand is a manual override until the next event.
  await lg.locator(".strip-body").click();
  await expect(lg).toHaveClass(/is-default/, { timeout: 2000 });
  await expect(lg).toHaveClass(/is-manual/, { timeout: 5000 });

  // The fader is a control, not a device switch.
  const arctis = page.locator(".device-strip", { hasText: "Arctis Nova Pro Wireless" }).first();
  await arctis.locator(".vol").click();
  await page.waitForTimeout(500);
  await expect(arctis).not.toHaveClass(/is-default/);
});

test("Settings tab exposes the working controls and hides the old footer", async () => {
  const { page } = ctx;

  // The settings strip that used to sit under every page is gone.
  await expect(page.locator(".settings-strip")).toHaveCount(0);

  await page.getByRole("button", { name: "Settings", exact: true }).click();

  // Only controls that actually change behaviour are offered.
  const pause = page.getByRole("switch", { name: "Pause automation" });
  const autostart = page.getByRole("switch", { name: "Start with Windows" });
  await expect(pause).toBeVisible();
  await expect(autostart).toBeVisible();
  await expect(page.getByLabel("Check devices every")).toBeVisible();

  // Toggling pause reaches the daemon and comes back in state.
  await expect(pause).toHaveAttribute("aria-checked", "false");
  await pause.click();
  await expect(pause).toHaveAttribute("aria-checked", "true", { timeout: 5000 });
  await expect(page.locator(".paused-banner")).toBeVisible();
  await pause.click();
  await expect(pause).toHaveAttribute("aria-checked", "false", { timeout: 5000 });

  // The device page is still reachable from here.
  await page.getByRole("button", { name: "Devices", exact: true }).click();
  await expect(page.getByRole("list", { name: "Output priority" })).toBeVisible();
});

test("the themed cursors are wired up", async () => {
  const { page } = ctx;

  // A guard on the asset paths and the build, not on how the cursor looks:
  // if an SVG is renamed or fails to bundle, these fall back to keywords.
  // `design/cursor-check.mjs` is the deeper check, confirming through
  // Electron that Chromium actually accepted each image.
  const cursorOf = (selector: string) =>
    page.locator(selector).first().evaluate((el) => getComputedStyle(el).cursor);

  expect(await page.evaluate(() => getComputedStyle(document.documentElement).cursor)).toContain(
    "url(",
  );
  expect(await cursorOf(".btn")).toContain("url(");
  expect(await cursorOf(".device-strip.is-draggable")).toContain("url(");
  expect(await cursorOf(".tab")).toContain("url(");

  // Each keeps its keyword, so a refused image degrades to the system cursor.
  expect(await cursorOf(".btn")).toContain("pointer");
});

test("frameless caption carries working window controls", async () => {
  const { page } = ctx;

  // The strip exists and is the drag handle; buttons opt out of dragging.
  const caption = page.locator(".caption");
  await expect(caption).toBeVisible();
  await expect(caption).toHaveCSS("-webkit-app-region", "drag");
  await expect(page.locator(".wc")).toHaveCSS("-webkit-app-region", "no-drag");

  await expect(page.getByRole("button", { name: "Minimize" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close" })).toBeVisible();

  // Maximize relabels itself to Restore once the window is maximized.
  const maximize = page.getByRole("button", { name: "Maximize" });
  await expect(maximize).toBeVisible();
  await maximize.click();
  await expect(page.getByRole("button", { name: "Restore" })).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByRole("button", { name: "Maximize" })).toBeVisible({ timeout: 5000 });

  // AUDIO carries the stencil bridges, DECK does not.
  await expect(page.locator(".brand-word .stencil")).toHaveText("Audio");
  await expect(page.locator(".brand-word .brand-deck")).toHaveText("Deck");
});
