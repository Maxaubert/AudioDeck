// The first-run guide: it has to appear exactly once, and it has to be
// possible to get out of it.

import { expect, test } from "@playwright/test";
import { launchApp, readConfigFile } from "./helpers.js";
import type { LaunchedApp } from "./helpers.js";

let ctx: LaunchedApp | null = null;

test.afterEach(async () => {
  await ctx?.close();
  ctx = null;
});

test("opens on a first launch and walks through every card", async () => {
  ctx = await launchApp({ guideSeen: false });
  const { page } = ctx;
  const guide = page.locator("dialog.guide");
  await expect(guide).toBeVisible();

  // The dialog is modal, so the app behind it must not be reachable.
  await expect(guide.getByRole("heading")).toHaveText("Rank your devices once");
  await expect(page.getByRole("button", { name: "Back" })).toBeDisabled();

  await page.getByRole("button", { name: "Next" }).click();
  await expect(guide.getByRole("heading")).toHaveText("Every control on one row");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(guide.getByRole("heading")).toHaveText("Tune any device you own");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(guide.getByRole("heading")).toHaveText("Then it gets out of the way");

  // The last card offers the way out rather than a fifth Next.
  await expect(page.getByRole("button", { name: "Next" })).toHaveCount(0);
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(guide).toBeHidden();
});

test("does not come back on the next launch", async () => {
  ctx = await launchApp({ guideSeen: false });
  await ctx.page.getByRole("button", { name: /^Card 4 of 4/ }).click();
  await ctx.page.getByRole("button", { name: "Get started" }).click();
  await expect.poll(async () => (await readConfigFile(ctx!.configFile)).guideSeen).toBe(true);

  await ctx.close();
  ctx = await launchApp({ guideSeen: true });
  await expect(ctx.page.locator("dialog.guide")).toHaveCount(0);
});

test("skipping counts as seen, so it is not a trap", async () => {
  // Requiring all four cards before it stops appearing would be a worse deal
  // than reading them.
  ctx = await launchApp({ guideSeen: false });
  await ctx.page.getByRole("button", { name: "Skip" }).click();
  await expect(ctx.page.locator("dialog.guide")).toBeHidden();
  await expect.poll(async () => (await readConfigFile(ctx!.configFile)).guideSeen).toBe(true);
});

test("Escape closes it, and that also counts as seen", async () => {
  ctx = await launchApp({ guideSeen: false });
  await ctx.page.keyboard.press("Escape");
  await expect(ctx.page.locator("dialog.guide")).toBeHidden();
  await expect.poll(async () => (await readConfigFile(ctx!.configFile)).guideSeen).toBe(true);
});

test("the dots jump straight to a card", async () => {
  ctx = await launchApp({ guideSeen: false });
  await ctx.page.getByRole("button", { name: /^Card 3 of 4/ }).click();
  await expect(ctx.page.locator("dialog.guide").getByRole("heading")).toHaveText(
    "Tune any device you own",
  );
});

test("Settings can bring it back", async () => {
  ctx = await launchApp({ guideSeen: true });
  const { page } = ctx;
  await expect(page.locator("dialog.guide")).toHaveCount(0);

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Show", exact: true }).click();
  await expect(page.locator("dialog.guide")).toBeVisible();
  await expect(page.locator("dialog.guide").getByRole("heading")).toHaveText(
    "Rank your devices once",
  );
});
