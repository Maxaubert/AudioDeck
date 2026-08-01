// e2e: the Studio tab. Runs against the mock effects service, so it needs no
// Equalizer APO installed and never writes outside the test's own temp dirs.

import { expect, test } from "@playwright/test";
import { launchApp, readConfigFile } from "./helpers.js";
import type { LaunchedApp } from "./helpers.js";

let ctx: LaunchedApp;

test.afterEach(async () => {
  await ctx.close();
});

test("offers setup when the processing component is missing", async () => {
  ctx = await launchApp(undefined, { AUDIODECK_EFFECTS_ABSENT: "1" });
  const { page } = ctx;
  await page.getByRole("button", { name: "Studio", exact: true }).click();

  // Nothing to tune until it is installed, and the panel says what it is and
  // who wrote it before the user commits to anything.
  await expect(page.locator(".setup-panel")).toBeVisible();
  await expect(page.locator(".setup-panel")).toContainText("Equalizer APO");
  await expect(page.locator(".setup-panel")).toContainText("GPL-3");
  await expect(page.getByRole("button", { name: "Set up audio effects" })).toBeVisible();
  await expect(page.locator(".eq-curve")).toHaveCount(0);
});

test("draws a ten point curve and three effect sliders", async () => {
  ctx = await launchApp();
  const { page } = ctx;
  await page.getByRole("button", { name: "Studio", exact: true }).click();

  await expect(page.locator(".eq-point")).toHaveCount(10);
  await expect(page.getByRole("slider", { name: "32 hertz" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "16k hertz" })).toBeVisible();
  await expect(page.locator(".fx")).toHaveCount(3);
  await expect(page.locator(".fx-list")).toContainText("Bass boost");
  await expect(page.locator(".fx-list")).toContainText("Clarity");
  await expect(page.locator(".fx-list")).toContainText("Surround");
});

test("a band change reaches the config, keyed to that device", async () => {
  ctx = await launchApp();
  const { page, configFile } = ctx;
  await page.getByRole("button", { name: "Studio", exact: true }).click();

  // Keyboard rather than a drag: it is the same code path into the profile,
  // and it is the route that has to work without a mouse anyway.
  const band = page.getByRole("slider", { name: "125 hertz" });
  await band.focus();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect(band).toHaveAttribute("aria-valuenow", "1");

  await expect
    .poll(async () => {
      const eq = (await readConfigFile(configFile)).eq;
      return Object.values(eq)[0]?.bands[2] ?? null;
    })
    .toBe(1);
});

test("each device keeps its own curve", async () => {
  ctx = await launchApp();
  const { page, configFile } = ctx;
  await page.getByRole("button", { name: "Studio", exact: true }).click();

  const picker = page.getByRole("combobox", { name: "Device to tune" });
  const first = await picker.inputValue();

  await page.getByRole("slider", { name: "32 hertz" }).focus();
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("slider", { name: "32 hertz" })).toHaveAttribute(
    "aria-valuenow",
    "0.5",
  );

  // Switching device loads that device's profile, which is still flat.
  await picker.selectOption({ index: 1 });
  const second = await picker.inputValue();
  expect(second).not.toBe(first);
  await expect(page.getByRole("slider", { name: "32 hertz" })).toHaveAttribute(
    "aria-valuenow",
    "0",
  );

  // And switching back brings the first one's curve with it.
  await picker.selectOption(first);
  await expect(page.getByRole("slider", { name: "32 hertz" })).toHaveAttribute(
    "aria-valuenow",
    "0.5",
  );

  await expect
    .poll(async () => Object.keys((await readConfigFile(configFile)).eq).length)
    .toBeGreaterThan(0);
});

test("the bypass turns the whole profile off without losing it", async () => {
  ctx = await launchApp();
  const { page, configFile } = ctx;
  await page.getByRole("button", { name: "Studio", exact: true }).click();

  await page.getByRole("slider", { name: "250 hertz" }).focus();
  await page.keyboard.press("ArrowUp");

  const toggle = page.getByRole("button", { name: /Effects (on|off)/ });
  await expect(toggle).toHaveText("Effects on");
  await toggle.click();
  await expect(toggle).toHaveText("Effects off");
  await expect(page.locator(".eq-curve")).toHaveClass(/is-off/);

  // Bypassed, but the curve is still there: an A/B has to be reversible.
  await expect
    .poll(async () => {
      const profile = Object.values((await readConfigFile(configFile)).eq)[0];
      return profile === undefined ? null : `${profile.enabled}:${profile.bands[3]}`;
    })
    .toBe("false:0.5");
});

test("reset to flat clears the curve and the effects", async () => {
  ctx = await launchApp();
  const { page } = ctx;
  await page.getByRole("button", { name: "Studio", exact: true }).click();

  await page.getByRole("slider", { name: "1k hertz" }).focus();
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("slider", { name: "1k hertz" })).toHaveAttribute(
    "aria-valuenow",
    "0.5",
  );

  await page.getByRole("button", { name: "Reset to flat" }).click();
  await expect(page.getByRole("slider", { name: "1k hertz" })).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
});
