import { chromium } from "@playwright/test";
import { readdirSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const dir = "C:/Users/Admin/Documents/Claude/Github/AudioDeck/design/mockups";
const shots = path.join(dir, "..", "shots");
mkdirSync(shots, { recursive: true });

const files = readdirSync(dir).filter((f) => f.endsWith(".html") && f !== "index.html");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });

for (const f of files) {
  const errors = [];
  page.removeAllListeners("pageerror");
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(pathToFileURL(path.join(dir, f)).href);
  await page.waitForTimeout(600);
  const height = await page.evaluate(() => document.body.scrollHeight);
  await page.screenshot({ path: path.join(shots, f.replace(".html", ".png")), fullPage: true });
  console.log(`${f}  h=${height}px  errors=${errors.length ? errors.join("; ") : "none"}`);
}

await browser.close();
