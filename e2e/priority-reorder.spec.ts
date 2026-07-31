// e2e: reordering the output priority list updates the UI and persists the
// new order to the temp config file (the atomic-write path under APPDATA).

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

test("moving the top output down persists the new order to config.json", async () => {
  const { page, configFile } = ctx;
  const outputs = page.getByRole("list", { name: "Output priority" });

  // The file may not exist for the first few ms, so the poll tolerates that.
  const outputPriorityOnDisk = async (): Promise<string[] | null> => {
    try {
      return (await readConfigFile(configFile)).outputPriority;
    } catch {
      return null;
    }
  };

  // Seeded order: default (Arctis) first, then enumeration order. The
  // disabled Realtek mock never seeds (active endpoints only).
  await expect(outputs.getByRole("listitem").first()).toContainText("Arctis Nova Pro");
  await expect.poll(outputPriorityOnDisk).toEqual(["mock-out-arctis", "mock-out-tv"]);

  await outputs
    .getByRole("button", { name: "Move Speakers (Arctis Nova Pro Wireless) down" })
    .click();

  // UI reflects the swap.
  await expect(outputs.getByRole("listitem").first()).toContainText("LG TV");
  await expect(outputs.getByRole("listitem").nth(1)).toContainText("Arctis Nova Pro");

  // And the temp config file holds the reordered list.
  await expect.poll(outputPriorityOnDisk).toEqual(["mock-out-tv", "mock-out-arctis"]);

  // The mic list is untouched.
  const config = await readConfigFile(configFile);
  expect(config.micPriority).toEqual(["mock-mic-arctis", "mock-mic-brio"]);
});

test("removing a device excludes it until added back through the picker", async () => {
  const { page, configFile } = ctx;
  const outputs = page.getByRole("list", { name: "Output priority" });
  await expect(outputs.getByRole("listitem")).toHaveCount(2);

  await outputs
    .getByRole("button", { name: "Remove LG TV (NVIDIA High Definition Audio) from list" })
    .click();

  // Gone from the ranking, recorded as excluded, and not re-appended by the
  // next poll even though the endpoint is still active.
  await expect(outputs.getByRole("listitem")).toHaveCount(1);
  await expect
    .poll(async () => (await readConfigFile(configFile)).excluded.output)
    .toEqual(["mock-out-tv"]);
  await expect(outputs.getByRole("listitem")).toHaveCount(1);

  // The picker offers it back; adding restores it to the bottom of the list.
  await page.getByRole("button", { name: /Add a device/ }).first().click();
  await page.getByRole("button", { name: /LG TV/ }).click();
  await expect(outputs.getByRole("listitem")).toHaveCount(2);
  await expect(outputs.getByRole("listitem").nth(1)).toContainText("LG TV");
  await expect
    .poll(async () => (await readConfigFile(configFile)).excluded.output)
    .toEqual([]);
});
