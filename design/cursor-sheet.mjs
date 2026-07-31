// Renders the cursor SVGs large, on both the paper and the ink background, so
// their shapes can be judged before they are shrunk to 32px and wired up.
// `node design/cursor-sheet.mjs <outDir>`

import { chromium } from "@playwright/test";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = process.argv[2] ?? repoRoot;
const dir = process.argv[3] ?? path.join(repoRoot, "src", "renderer", "src", "assets", "cursors");
const sheetName = process.argv[4] ?? "cursor-sheet.png";

const files = (await readdir(dir)).filter((f) => f.endsWith(".svg")).sort();
const cards = await Promise.all(
  files.map(async (f) => {
    const svg = await readFile(path.join(dir, f), "utf8");
    return `<figure>
      <div class="row"><div class="paper">${svg}</div><div class="ink">${svg}</div>
      <div class="paper small">${svg}</div><div class="ink small">${svg}</div></div>
      <figcaption>${f}</figcaption>
    </figure>`;
  }),
);

const html = `<!doctype html><meta charset="utf-8"><style>
  body { margin: 0; padding: 28px; background: #f2f0ea; font-family: Arial, sans-serif; }
  figure { margin: 0 0 22px; }
  .row { display: flex; gap: 16px; align-items: center; }
  .paper, .ink { display: grid; place-items: center; width: 168px; height: 168px; border: 3px solid #000; }
  .paper { background: #fff; }
  .ink { background: #000; }
  .paper svg, .ink svg { width: 150px; height: 150px; }
  .small { width: 64px; height: 64px; }
  .small svg { width: 32px; height: 32px; }
  figcaption { font-size: 15px; font-weight: 700; letter-spacing: .08em;
    text-transform: uppercase; margin-top: 8px; }
</style><body>${cards.join("")}</body>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 1400 } });
await page.setContent(html);
await page.screenshot({ path: path.join(outDir, sheetName), fullPage: true });
await browser.close();
console.log(`wrote ${sheetName}`);
