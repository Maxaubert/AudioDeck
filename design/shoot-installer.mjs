import { chromium } from "@playwright/test";
import { readdirSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const dir = "C:/Users/Admin/Documents/Claude/Github/AudioDeck/design/mockups";
const shots = "C:/Users/Admin/Documents/Claude/Github/AudioDeck/design/shots";
mkdirSync(shots, { recursive: true });

let failed = false;
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
  // The app sets a floor for a low-vision user in styles.css: body text >= 17px
  // and every interactive target >= 44px. The installer is held to the same
  // rule, and by the harness rather than by memory, because the first cut of
  // these mockups quietly broke it at 15px and 40px.
  const a11y = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll(".win .lede, .win .h")) {
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (px < 17) bad.push(`body ${px}px`);
    }
    // Fine print may be smaller than body, but not illegible. The ranked-list
    // preview is held to this floor rather than the body one: it is a picture
    // of the app at reduced scale, not copy anyone has to read to get through
    // the installer.
    for (const el of document.querySelectorAll(
      ".win .fine, .win .meas, .win .log span, .win .prow .who b",
    )) {
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (px < 13) bad.push(`fine ${px}px`);
    }
    for (const el of document.querySelectorAll(".win .btn, .win .check, .win .field > *")) {
      const h = el.getBoundingClientRect().height;
      if (h < 44) bad.push(`target ${el.className || el.tagName} ${Math.round(h)}px`);
    }
    return [...new Set(bad)];
  });

  await page.screenshot({ path: path.join(shots, f.replace(".html", ".png")), fullPage: true });
  console.log(
    `${f}  anton=${fontOk}  overflow=${over.length ? over.join(",") : "none"}` +
      `  a11y=${a11y.length ? a11y.join(", ") : "ok"}` +
      `  errors=${errors.length ? errors.join("; ") : "none"}`,
  );
  if (over.length || a11y.length || errors.length) failed = true;
}

await browser.close();

// Non-zero on any breach, so this can gate a build rather than just inform.
if (failed) {
  console.error("installer mockups failed their contract");
  process.exit(1);
}
