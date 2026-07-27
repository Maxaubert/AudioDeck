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

  const outputs = page.getByRole("list", { name: "Output priority" });
  await expect(outputs.getByText("Speakers (Arctis Nova Pro Wireless)")).toBeVisible();
  await expect(outputs.getByText("LG TV (NVIDIA High Definition Audio)")).toBeVisible();
  // Windows default seeds first and carries the amber marker.
  await expect(outputs.getByRole("listitem").first()).toContainText("Arctis Nova Pro");
  await expect(outputs.getByRole("listitem").first().getByText("Default")).toBeVisible();
  // Non-active endpoints stay out of the ranking. The picker offers only real
  // devices (disconnected AirPods), never disabled endpoints or ghosts.
  await expect(outputs.getByText("Speakers (Realtek(R) Audio)")).toHaveCount(0);
  await page.getByRole("button", { name: /Add a device \(1 more\)/ }).click();
  await expect(page.getByRole("button", { name: /AirPods Pro/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Realtek\(R\) Audio/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Digital Output/ })).toHaveCount(0);

  const mics = page.getByRole("list", { name: "Microphone priority" });
  await expect(mics.getByText("Microphone (Arctis Nova Pro Wireless)")).toBeVisible();
  await expect(mics.getByText("Microphone (Logitech BRIO)")).toBeVisible();
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

test("Devices view lists every endpoint including the disabled one", async () => {
  const { page } = ctx;
  await page.getByRole("button", { name: "Devices", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Devices", exact: true })).toBeVisible();

  await expect(page.getByText("Speakers (Arctis Nova Pro Wireless)")).toBeVisible();
  await expect(page.getByText("Microphone (Logitech BRIO)")).toBeVisible();

  // The disabled Realtek endpoint renders with its state badge and an Enable button.
  const realtek = page
    .getByRole("listitem")
    .filter({ hasText: "Speakers (Realtek(R) Audio)" });
  await expect(realtek.getByText("Disabled", { exact: true })).toBeVisible();
  await expect(realtek.getByRole("button", { name: "Enable", exact: true })).toBeVisible();

  // Active non-default devices offer Make default.
  const tv = page.getByRole("listitem").filter({ hasText: "LG TV" });
  await expect(tv.getByRole("button", { name: "Make default", exact: true })).toBeVisible();
});
