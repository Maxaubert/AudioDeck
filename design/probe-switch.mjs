// Measure how long the UI takes to show a clicked device as in use, on both
// the Priority and Mixer pages.
import { _electron as electron } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const repo = "C:/Users/Admin/Documents/Claude/Github/AudioDeck";
const appData = mkdtempSync(path.join(tmpdir(), "audiodeck-switch-"));

const app = await electron.launch({
  args: [path.join(repo, "out/main/main.js")],
  cwd: repo,
  env: { ...process.env, AUDIODECK_TEST_MODE: "1", AUDIODECK_MOCK_DEVICES: "1", APPDATA: appData },
});
const page = await app.firstWindow();
await page.waitForSelector(".shell[data-loaded=true]");

async function timeSwitch(label, rowLocator, clickTarget) {
  const t0 = Date.now();
  await (clickTarget ?? rowLocator).click();
  await rowLocator.and(page.locator(".is-default")).waitFor({ timeout: 8000 });
  console.log(`${label}: marked in use after ${Date.now() - t0} ms`);
}

// Priority page
const outputs = page.getByRole("list", { name: "Output priority" });
await timeSwitch(
  "priority row",
  outputs.getByRole("listitem").filter({ hasText: "NVIDIA High Definition Audio" }),
);

// Mixer page
await page.getByRole("button", { name: "Devices", exact: true }).click();
await page.waitForTimeout(300);
const mixerRow = page.locator(".device-strip").filter({ hasText: "Arctis Nova Pro Wireless" }).first();
await timeSwitch("mixer row (name area)", mixerRow, mixerRow.locator(".strip-body"));

// Clicking the fader must not switch device.
const lgRow = page.locator(".device-strip").filter({ hasText: "NVIDIA High Definition Audio" });
const before = await lgRow.getAttribute("class");
await lgRow.locator(".vol").click();
await page.waitForTimeout(600);
const after = await lgRow.getAttribute("class");
console.log(
  `fader click changed default: ${/is-default/.test(after ?? "") !== /is-default/.test(before ?? "")}`,
);

await app.close();
