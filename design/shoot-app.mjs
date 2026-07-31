// Launch the built app with mock devices and screenshot every page.
import { _electron as electron } from "@playwright/test";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const repo = "C:/Users/Admin/Documents/Claude/Github/AudioDeck";
const shots = path.join(repo, "design", "shots");
mkdirSync(shots, { recursive: true });
const appData = mkdtempSync(path.join(tmpdir(), "audiodeck-ui-"));

const app = await electron.launch({
  args: [path.join(repo, "out/main/main.js")],
  cwd: repo,
  env: { ...process.env, AUDIODECK_TEST_MODE: "1", AUDIODECK_MOCK_DEVICES: "1", APPDATA: appData },
});
const page = await app.firstWindow();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.setViewportSize({ width: 1240, height: 920 });
await page.waitForSelector(".shell[data-loaded=true]", { timeout: 15000 });

for (const tab of ["Priority", "Devices", "Settings"]) {
  await page.getByRole("button", { name: tab, exact: true }).click();
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(shots, `app-${tab.toLowerCase()}.png`) });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  console.log(`${tab}: shot taken, horizontal overflow=${overflow}`);
}

console.log(`page errors: ${errors.length ? errors.join("; ") : "none"}`);
await app.close();
