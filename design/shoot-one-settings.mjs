import { chromium } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";

const dir = "C:/Users/Admin/Documents/Claude/Github/AudioDeck/design/mockups";
const file = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(pathToFileURL(path.join(dir, file)).href);
await page.getByRole("tab", { name: "Settings" }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(dir, "..", "shots", file.replace(".html", "-settings.png")), fullPage: true });
console.log(`${file} settings shot, errors=${errors.length ? errors.join("; ") : "none"}`);
await browser.close();
