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

  // Seeded order: default (Arctis) first, then enumeration order.
  await expect(outputs.getByRole("listitem").first()).toContainText("Arctis Nova Pro");
  await expect
    .poll(outputPriorityOnDisk)
    .toEqual(["mock-out-arctis", "mock-out-tv", "mock-out-realtek"]);

  await outputs
    .getByRole("button", { name: "Move Speakers (Arctis Nova Pro Wireless) down" })
    .click();

  // UI reflects the swap.
  await expect(outputs.getByRole("listitem").first()).toContainText("LG TV");
  await expect(outputs.getByRole("listitem").nth(1)).toContainText("Arctis Nova Pro");

  // And the temp config file holds the reordered list.
  await expect
    .poll(outputPriorityOnDisk)
    .toEqual(["mock-out-tv", "mock-out-arctis", "mock-out-realtek"]);

  // The mic list is untouched.
  const config = await readConfigFile(configFile);
  expect(config.micPriority).toEqual(["mock-mic-arctis", "mock-mic-brio"]);
});
