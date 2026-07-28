// e2e: the app launches in test mode and all three views render the mocked
// device data (priority lists, mixer faders, device manager rows).

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

test("Mixer view shows a fader and mute per active mocked device", async () => {
  const { page } = ctx;
  await page.getByRole("button", { name: "Mixer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mixer", exact: true })).toBeVisible();

  const arctisFader = page.getByRole("slider", {
    name: "Speakers (Arctis Nova Pro Wireless) volume",
  });
  await expect(arctisFader).toBeVisible();
  await expect(arctisFader).toHaveValue("40");
  await expect(
    page.getByRole("slider", { name: "LG TV (NVIDIA High Definition Audio) volume" }),
  ).toHaveValue("25");
  await expect(
    page.getByRole("slider", { name: "Microphone (Logitech BRIO) volume" }),
  ).toHaveValue("65");
  // Disabled endpoints get no fader.
  await expect(
    page.getByRole("slider", { name: "Speakers (Realtek(R) Audio) volume" }),
  ).toHaveCount(0);
  // One mute button per active device.
  await expect(page.getByRole("button", { name: "Mute", exact: true })).toHaveCount(4);
});

test("Devices view shows real endpoints, ghosts behind the toggle", async () => {
  const { page } = ctx;
  await page.getByRole("button", { name: "Devices", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Devices", exact: true })).toBeVisible();

  await expect(
    page.getByRole("listitem").filter({ hasText: "Speakers" }).filter({ hasText: "Arctis" }),
  ).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Logitech BRIO" }),
  ).toBeVisible();

  // Disabled endpoints show with an Enable button as their state cue; no badges.
  const realtek = page.getByRole("listitem").filter({ hasText: "Realtek(R) Audio" });
  await expect(realtek.getByRole("button", { name: "Enable", exact: true })).toBeVisible();
  await expect(realtek.getByText("Disabled", { exact: true })).toHaveCount(0);

  const tv = page.getByRole("listitem").filter({ hasText: "LG TV" });

  // The notpresent ghost hides until the toggle reveals it. Scope to the
  // device-name element: "Digital output" also appears as a dropdown option.
  await expect(page.locator(".device-name", { hasText: "Digital Output" })).toHaveCount(0);
  await page.getByRole("button", { name: /Show remembered devices \(1\)/ }).click();
  await expect(
    page.locator(".device-name", { hasText: "Digital Output" }),
  ).toBeVisible();

  // The type dropdown reflects the form factor and changes it globally.
  const tvType = tv.getByRole("combobox", { name: /Device type/ });
  await expect(tvType).toHaveValue("tv");
  await tvType.selectOption("speakers");
  await expect(tvType).toHaveValue("speakers");
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

test("renaming changes the device name globally", async () => {
  const { page } = ctx;
  await page.getByRole("button", { name: "Devices", exact: true }).click();

  const tv = page.getByRole("listitem").filter({ hasText: "LG TV" });
  await tv.getByRole("button", { name: "Rename", exact: true }).click();
  await tv.getByLabel(/New name for/).fill("Stue TV");
  await tv.getByLabel(/New parenthesized text for/).fill("Stua");
  await tv.getByRole("button", { name: "Save name", exact: true }).click();

  // Both parts land: clean title and the custom suffix as the sub line.
  const renamed = page.getByRole("listitem").filter({ hasText: "Stue TV" });
  await expect(renamed).toBeVisible();
  await expect(renamed.getByText("Stua", { exact: true })).toBeVisible();
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
