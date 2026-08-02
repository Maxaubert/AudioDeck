import { chromium } from "@playwright/test";
import { readdirSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const dir = "C:/Users/Admin/Documents/Claude/Github/AudioDeck/design/mockups";
const shots = "C:/Users/Admin/Documents/Claude/Github/AudioDeck/design/shots";
mkdirSync(shots, { recursive: true });

const files = readdirSync(dir).filter((f) => f.startsWith("inst-") && f.endsWith(".html"));
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 2120, height: 900 },
  deviceScaleFactor: 2,
});

for (const f of files) {
  const errors = [];
  page.removeAllListeners("pageerror");
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(pathToFileURL(path.join(dir, f)).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  // Prove the display face actually loaded, rather than trusting the render.
  const fontOk = await page.evaluate(() => document.fonts.check('27px Anton'));
  // These frames are fixed at the real installer size, so anything taller than
  // the window is content NSIS would simply cut off. Catch it here rather than
  // by squinting at the screenshot.
  const over = await page.evaluate(() =>
    [...document.querySelectorAll(".win")]
      .map((w, i) => ({ i, by: w.scrollHeight - w.clientHeight }))
      .filter((r) => r.by > 0)
      .map((r) => `frame${r.i}+${r.by}px`),
  );
  await page.screenshot({ path: path.join(shots, f.replace(".html", ".png")), fullPage: true });
  console.log(
    `${f}  anton=${fontOk}  overflow=${over.length ? over.join(",") : "none"}` +
      `  errors=${errors.length ? errors.join("; ") : "none"}`,
  );
}

await browser.close();
