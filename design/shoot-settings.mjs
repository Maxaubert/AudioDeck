import { chromium } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";

const dir = "C:/Users/Admin/Documents/Claude/Github/AudioDeck/design/mockups";
const shots = path.join(dir, "..", "shots");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });

for (const f of ["punk-marker.html", "punk-hardcore.html"]) {
  const errors = [];
  page.removeAllListeners("pageerror");
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(pathToFileURL(path.join(dir, f)).href);
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.waitForTimeout(400);
  const visible = await page.locator("#settings").isVisible();
  const rows = await page.locator("#settings .setrow").count();
  await page.screenshot({ path: path.join(shots, f.replace(".html", "-settings.png")), fullPage: true });
  console.log(`${f}  settings visible=${visible}  rows=${rows}  errors=${errors.length ? errors.join("; ") : "none"}`);
}
await browser.close();
