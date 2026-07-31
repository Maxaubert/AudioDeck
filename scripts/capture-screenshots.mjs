// Captures docs/screenshots/{devices,settings}.png from the real app
// window (built output, AUDIODECK_TEST_MODE=1: no tray, no registry writes).
// Run `npm run build` first; `npm run screenshots` does both.

import { _electron as electron } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(repoRoot, "docs", "screenshots");
await mkdir(outDir, { recursive: true });

const app = await electron.launch({
  args: ["."],
  cwd: repoRoot,
  env: { ...process.env, AUDIODECK_TEST_MODE: "1" },
});

const page = await app.firstWindow();
await page.setViewportSize({ width: 1180, height: 900 });
await page.waitForSelector('[data-loaded="true"]', { timeout: 30_000 });
// Let the first real poll land so badges and volumes are populated.
await page.waitForTimeout(2500);

const views = [
  { tab: "Devices", file: "devices.png" },
  { tab: "Settings", file: "settings.png" },
];

for (const { tab, file } of views) {
  await page.getByRole("button", { name: tab, exact: true }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, file) });
  console.log(`captured ${file}`);
}

await app.close();
