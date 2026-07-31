// Drive the real built app against the mock backend and prove whether the
// mixer controls reach the daemon.
import { _electron as electron } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const repo = "C:/Users/Admin/Documents/Claude/Github/AudioDeck";
const appData = mkdtempSync(path.join(tmpdir(), "audiodeck-probe-"));

const app = await electron.launch({
  args: [path.join(repo, "out/main/main.js")],
  cwd: repo,
  env: { ...process.env, AUDIODECK_TEST_MODE: "1", AUDIODECK_MOCK_DEVICES: "1", APPDATA: appData },
});
const page = await app.firstWindow();
await page.waitForSelector(".shell[data-loaded=true]");
await page.getByRole("button", { name: "Devices", exact: true }).click();
await page.waitForTimeout(400);

const row = page.locator(".device-strip").first();
const slider = row.locator("input[type=range]");
const before = await slider.inputValue();
const pctBefore = await row.locator(".volume-value").innerText();

// Click near the right end of the meter, the way a user sets a level.
const box = await row.locator(".vol").boundingBox();
await page.mouse.click(box.x + box.width * 0.8, box.y + box.height / 2);
await page.waitForTimeout(1200);

const after = await slider.inputValue();
const pctAfter = await row.locator(".volume-value").innerText();

// Does it survive a poll tick, i.e. did it reach the backend and come back?
await page.waitForTimeout(2500);
const settled = await slider.inputValue();
const pctSettled = await row.locator(".volume-value").innerText();

console.log(`slider: ${before} -> ${after} -> settled ${settled}`);
console.log(`readout: ${pctBefore} -> ${pctAfter} -> settled ${pctSettled}`);
console.log(settled === before ? "REVERTED: value did not persist" : "PERSISTED: backend accepted it");

// Mute round trip
const mute = row.getByRole("button", { name: /Mute|Muted/ });
const muteBefore = await mute.innerText();
await mute.click();
await page.waitForTimeout(1500);
const muteAfter = await mute.innerText();
console.log(`mute: ${muteBefore} -> ${muteAfter} ${muteBefore === muteAfter ? "(NO CHANGE)" : "(toggled)"}`);

await app.close();
