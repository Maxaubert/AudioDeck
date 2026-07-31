// e2e: the app launches in test mode and both device views render the mocked
// data (priority lists, the merged Devices view with its faders and panels).

import { expect, test } from "@playwright/test";
import { launchApp } from "./helpers.js";
import type { LaunchedApp } from "./helpers.js";

let ctx: LaunchedApp;

test.beforeEach(async () => {
  ctx = await launchApp();
});

test.afterEach(async () => {
  await ctx.close();
});

test("launches into the Priority view with both mocked lists", async () => {
  const { page } = ctx;
  await expect(page.getByRole("heading", { name: "Priority", exact: true })).toBeVisible();

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
  // Non-active endpoints stay out of the ranking. The picker offers only real
  // devices (disconnected AirPods), never disabled endpoints or ghosts.
  await expect(outputs.getByText("Realtek(R) Audio")).toHaveCount(0);
  await page.getByRole("button", { name: /Add a device \(1 more\)/ }).click();
  await expect(page.getByRole("button", { name: /AirPods Pro/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Realtek\(R\) Audio/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Digital Output/ })).toHaveCount(0);

  const mics = page.getByRole("list", { name: "Microphone priority" });
  await expect(
    mics.getByRole("listitem").filter({ hasText: "Arctis Nova Pro Wireless" }),
  ).toBeVisible();
  await expect(
    mics.getByRole("listitem").filter({ hasText: "Logitech BRIO" }),
  ).toBeVisible();
});

test("clicking a priority row switches audio to it", async () => {
  const { page } = ctx;
  const outputs = page.getByRole("list", { name: "Output priority" });
  const tvRow = outputs.getByRole("listitem").filter({ hasText: "NVIDIA High Definition Audio" });
  await expect(outputs.getByRole("listitem").first()).toHaveClass(/is-default/);
  await tvRow.click();
  // The clicked device becomes the one in use, marked as a manual override.
  await expect(tvRow).toHaveClass(/is-default/, { timeout: 5000 });
  await expect(tvRow).toHaveClass(/is-manual/, { timeout: 5000 });
});

test("Devices view gives every active device a fader and a mute", async () => {
  const { page } = ctx;
  await page.getByRole("button", { name: "Devices", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Devices", exact: true })).toBeVisible();

  await expect(
    page.getByRole("slider", { name: "Speakers (Arctis Nova Pro Wireless) volume" }),
  ).toHaveValue("40");
  await expect(
    page.getByRole("slider", { name: "LG TV (NVIDIA High Definition Audio) volume" }),
  ).toHaveValue("25");
  await expect(
    page.getByRole("slider", { name: "Microphone (Logitech BRIO) volume" }),
  ).toHaveValue("65");
  // Non-active endpoints get no fader, and say so where the meter would be.
  await expect(
    page.getByRole("slider", { name: "Speakers (Realtek(R) Audio) volume" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mute", exact: true })).toHaveCount(4);
});

test("Devices view ranks first, then the rest, with ghosts behind the toggle", async () => {
  const { page } = ctx;
  await page.getByRole("button", { name: "Devices", exact: true }).click();

  // Ranked devices lead, numbered, in priority order.
  const rows = page.locator(".device-strip");
  await expect(rows.nth(0)).toContainText("Arctis Nova Pro Wireless");
  await expect(rows.nth(0).locator(".rank")).toHaveText("1");
  await expect(rows.nth(1)).toContainText("NVIDIA High Definition Audio");
  await expect(rows.nth(1).locator(".rank")).toHaveText("2");

  // Then the break, then the endpoints that are not in the ranking at all.
  await expect(page.locator(".section-break").first()).toHaveText("Not in priority");
  const airpods = page.locator(".device-strip", { hasText: "AirPods Pro" });
  const realtek = page.locator(".device-strip", { hasText: "Realtek(R) Audio" });
  await expect(airpods.locator(".rank")).toBeEmpty();
  await expect(realtek.locator(".rank")).toBeEmpty();
  await expect(airpods.locator(".na")).toHaveText("Unavailable");

  // A disabled endpoint carries Enable in the collapsed row: it is the only
  // thing that row can do. Disable is the one that hides in the panel.
  await expect(realtek.getByRole("button", { name: "Enable", exact: true })).toBeVisible();
  await expect(airpods.getByRole("button", { name: "Enable", exact: true })).toHaveCount(0);

  // The notpresent ghost hides until the toggle reveals it. Scope to the
  // device-name element: "Digital output" also appears as a dropdown option.
  await expect(page.locator(".device-name", { hasText: "Digital Output" })).toHaveCount(0);
  await page.getByRole("button", { name: /Show remembered devices \(1\)/ }).click();
  await expect(page.locator(".device-name", { hasText: "Digital Output" })).toBeVisible();
});

test("the expander holds the management controls, one panel at a time", async () => {
  const { page } = ctx;
  await page.getByRole("button", { name: "Devices", exact: true }).click();

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
  await page.getByRole("button", { name: "Devices", exact: true }).click();

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
  // Dropping a device from the priority list leaves it active but unranked.
  // The old Mixer listed only ranked devices, so this row lost its fader
  // entirely; the merged view is the reason to keep it.
  await page
    .getByRole("list", { name: "Output priority" })
    .getByRole("button", { name: "Remove LG TV (NVIDIA High Definition Audio) from list" })
    .click();

  await page.getByRole("button", { name: "Devices", exact: true }).click();
  const tv = page.locator(".device-strip", { hasText: "NVIDIA High Definition Audio" });

  // Below the break, no rank slab, and its volume is still controllable.
  await expect(tv.locator(".rank")).toBeEmpty();
  const fader = tv.getByRole("slider");
  await expect(fader).toBeVisible();
  await fader.fill("70");
  await expect(fader).toHaveValue("70", { timeout: 5000 });
});

test("a volume change survives leaving the Devices tab immediately", async () => {
  const { page } = ctx;
  await page.getByRole("button", { name: "Devices", exact: true }).click();

  const fader = page.getByRole("slider", { name: "LG TV (NVIDIA High Definition Audio) volume" });
  await fader.fill("70");
  // Leave well inside the 200ms debounce window.
  await page.getByRole("button", { name: "Priority", exact: true }).click();
  await page.waitForTimeout(900);

  // Coming back, the daemon holds the new level rather than the old one.
  await page.getByRole("button", { name: "Devices", exact: true }).click();
  await expect(
    page.getByRole("slider", { name: "LG TV (NVIDIA High Definition Audio) volume" }),
  ).toHaveValue("70", { timeout: 5000 });
});

test("a device that ignores volume writes gets the on-device stamp", async () => {
  const { page } = ctx;
  await page.getByRole("button", { name: "Devices", exact: true }).click();
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
  await page.getByRole("button", { name: "Devices", exact: true }).click();

  const lg = page.locator(".device-strip", { hasText: "NVIDIA High Definition Audio" });
  await expect(lg).not.toHaveClass(/is-default/);

  // The name area switches device, and the UI shows it without waiting for Windows.
  await lg.locator(".strip-body").click();
  await expect(lg).toHaveClass(/is-default/, { timeout: 2000 });

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

  // The device pages are still reachable from here.
  await page.getByRole("button", { name: "Priority", exact: true }).click();
  await expect(page.getByRole("list", { name: "Output priority" })).toBeVisible();
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
