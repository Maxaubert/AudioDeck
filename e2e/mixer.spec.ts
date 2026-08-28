// Mixer tab against the mock backend: grouped rows, pinned order, and
// mute/volume round-trips through the AudioControl surface.

import { expect, test } from "@playwright/test";
import { launchApp } from "./helpers.js";

test("lists grouped apps with system sounds pinned first", async () => {
  const { page, close } = await launchApp();
  await page.getByRole("button", { name: "Mixer" }).click();
  const rows = page.locator(".mixer-app");
  await expect(rows).toHaveCount(3); // system + chrome (two sessions grouped) + spotify
  await expect(rows.nth(0)).toContainText("System sounds");
  await expect(rows.nth(1)).toContainText("Google Chrome");
  await expect(rows.nth(2)).toContainText("Spotify");
  // The mock has no icons: every row falls back to an SVG glyph.
  await expect(page.locator(".mixer-app .app-icon-glyph")).toHaveCount(3);
  await close();
});

test("muting an app round-trips through the backend", async () => {
  const { page, close } = await launchApp();
  await page.getByRole("button", { name: "Mixer" }).click();
  const mute = page.getByRole("button", { name: "Mute Spotify" });
  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  await close();
});

test("keyboard volume change lands and reads back", async () => {
  const { page, close } = await launchApp();
  await page.getByRole("button", { name: "Mixer" }).click();
  const slider = page.getByRole("slider", { name: "Spotify volume" });
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".mixer-app", { hasText: "Spotify" })).toContainText("46%");
  await close();
});

test("grouped volume writes hit every session of the app", async () => {
  const { page, close } = await launchApp();
  await page.getByRole("button", { name: "Mixer" }).click();
  const slider = page.getByRole("slider", { name: "Google Chrome volume" });
  await slider.focus();
  await page.keyboard.press("ArrowLeft");
  // Group volume is the max of both mock sessions; if only one had been
  // written, the shown value would snap back to 80 on the next poll.
  await expect(page.locator(".mixer-app", { hasText: "Google Chrome" })).toContainText("79%");
  await close();
});
