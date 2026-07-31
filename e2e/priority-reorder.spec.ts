// e2e: ranking on the one device page. Reordering, adding and removing all
// persist to the temp config file (the atomic-write path under APPDATA).

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

/** The file may not exist for the first few ms, so this tolerates that. */
async function outputPriorityOnDisk(configFile: string): Promise<string[] | null> {
  try {
    return (await readConfigFile(configFile)).outputPriority;
  } catch {
    return null;
  }
}

test("dragging a row reorders it and persists to config.json", async () => {
  const { page, configFile } = ctx;
  const outputs = page.getByRole("list", { name: "Output priority" });
  const rows = outputs.getByRole("listitem");

  // Seeded order: default (Arctis) first, then enumeration order. The
  // disabled Realtek mock never seeds (active endpoints only).
  await expect(rows.first()).toContainText("Arctis Nova Pro");
  await expect.poll(() => outputPriorityOnDisk(configFile)).toEqual([
    "mock-out-arctis",
    "mock-out-tv",
  ]);

  await rows.nth(0).dragTo(rows.nth(1));

  await expect(rows.first()).toContainText("LG TV");
  await expect(rows.nth(1)).toContainText("Arctis Nova Pro");
  await expect.poll(() => outputPriorityOnDisk(configFile)).toEqual([
    "mock-out-tv",
    "mock-out-arctis",
  ]);
});

test("Alt with the arrow keys reorders and persists to config.json", async () => {
  const { page, configFile } = ctx;
  const outputs = page.getByRole("list", { name: "Output priority" });

  await expect(outputs.getByRole("listitem").first()).toContainText("Arctis Nova Pro");
  await expect.poll(() => outputPriorityOnDisk(configFile)).toEqual([
    "mock-out-arctis",
    "mock-out-tv",
  ]);

  // The keyboard route onto the same reorder, for anyone who cannot drag.
  await outputs.getByRole("listitem").first().focus();
  await page.keyboard.press("Alt+ArrowDown");

  await expect(outputs.getByRole("listitem").first()).toContainText("LG TV");
  await expect(outputs.getByRole("listitem").nth(1)).toContainText("Arctis Nova Pro");
  await expect.poll(() => outputPriorityOnDisk(configFile)).toEqual([
    "mock-out-tv",
    "mock-out-arctis",
  ]);

  // The mic list is untouched.
  const config = await readConfigFile(configFile);
  expect(config.micPriority).toEqual(["mock-mic-arctis", "mock-mic-brio"]);
});

test("Alt+ArrowUp at the top of the list does nothing", async () => {
  const { page, configFile } = ctx;
  const outputs = page.getByRole("list", { name: "Output priority" });

  await outputs.getByRole("listitem").first().focus();
  await page.keyboard.press("Alt+ArrowUp");
  await page.waitForTimeout(400);

  await expect(outputs.getByRole("listitem").first()).toContainText("Arctis Nova Pro");
  expect((await readConfigFile(configFile)).outputPriority).toEqual([
    "mock-out-arctis",
    "mock-out-tv",
  ]);
});

test("removing from priority excludes a device until the + adds it back", async () => {
  const { page, configFile } = ctx;
  const outputs = page.getByRole("list", { name: "Output priority" });
  // Revealed rows share the list, so "ranked" means "has a rank number".
  const ranked = outputs.locator(".device-strip:not(:has(.rank.is-unranked))");
  await expect(ranked).toHaveCount(2);

  // Remove lives in the row's own panel.
  const tv = page.locator(".device-strip", { hasText: "LG TV" });
  await tv.getByRole("button", { name: /^Settings for/ }).click();
  await tv.getByRole("button", { name: "Remove from priority", exact: true }).click();

  // Gone from the ranking, recorded as excluded, and not re-appended by the
  // next poll even though the endpoint is still active.
  await expect(ranked).toHaveCount(1);
  await expect
    .poll(async () => (await readConfigFile(configFile)).excluded.output)
    .toEqual(["mock-out-tv"]);
  await expect(ranked).toHaveCount(1);

  // It is still real hardware, so it waits under the reveal with a + to
  // restore it to the bottom of the list.
  await page.getByRole("button", { name: /More outputs/ }).click();
  await page.getByRole("button", { name: "Add LG TV to priority" }).click();

  await expect(ranked).toHaveCount(2);
  await expect(ranked.nth(1)).toContainText("LG TV");
  await expect
    .poll(async () => (await readConfigFile(configFile)).excluded.output)
    .toEqual([]);
});
