// Build AudioDeck's icon.
//
// The app has never had one: without build/icon.ico, electron-builder falls
// back to the stock Electron icon for the setup executable, the taskbar, the
// Start menu and the Add/Remove Programs row.
//
// The artwork is not invented here. `.brand-mark` in src/renderer/src/styles.css
// is already a drawn logo (a square rotated -3 degrees, a paper border, three
// skewed bars), so the geometry below is that CSS transcribed. Keeping it in
// one script rather than in hand-authored SVG means the two can be compared
// line by line when the brand moves.
//
// Two cuts, because one does not survive the range:
//   - full: frame and three skewed bars, for 32px and up
//   - small: bars only, upright and fattened, for 16 and 24, where the frame
//     and the 3 degree tilt turn to mush
//
// Rasterised with the Chromium that Playwright already installs, so there is no
// new image dependency, and packed into an .ico here rather than by a tool the
// next contributor would have to go and find.
//
//   node design/make-icon.mjs

import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const INK = "#000000";
const PAPER = "#f2f0ea";
const MARKER = "#ffb454";

/**
 * One bar of the mark, skewed about its own centre the way CSS `skew(-11deg)`
 * does. SVG's skewX pivots on the origin instead, so the parallelogram is
 * written out directly and the geometry stays honest.
 */
function bar(x, y, w, h, fill) {
  const lean = Math.tan((11 * Math.PI) / 180) * (h / 2);
  const [l, r, t, b] = [x, x + w, y, y + h];
  return (
    `<polygon points="${l + lean},${t} ${r + lean},${t} ${r - lean},${b} ${l - lean},${b}" ` +
    `fill="${fill}"/>`
  );
}

/**
 * The full mark, transcribed from `.brand-mark`: a 44x44 border box with a 4px
 * paper border, tilted -3 degrees. Child offsets in CSS are measured from the
 * padding edge, so each is shifted by the 4px border here.
 *
 * Paint order matches the DOM: ::before, then the <i>, then ::after on top.
 */
function fullMark() {
  return `
    <rect width="64" height="64" fill="${INK}"/>
    <g transform="translate(10 10) rotate(-3 22 22)">
      <rect x="2" y="2" width="40" height="40" fill="none" stroke="${PAPER}" stroke-width="3.5"/>
      ${bar(11, 10, 6, 24, MARKER)}
      ${bar(22, 14, 6, 24, PAPER)}
      ${bar(27, 23, 6, 17, MARKER)}
    </g>`;
}

/**
 * The small cut. At 16px the tilt, the 4px frame and the lean all collapse into
 * grey, so the frame goes, the bars stand upright and widen, and the gap
 * between them is what carries the shape.
 */
function smallMark() {
  return `
    <rect width="64" height="64" fill="${INK}"/>
    <rect x="10" y="10" width="12" height="44" fill="${MARKER}"/>
    <rect x="26" y="16" width="12" height="38" fill="${PAPER}"/>
    <rect x="42" y="30" width="12" height="24" fill="${MARKER}"/>`;
}

// No crispEdges: it turns the tilted frame into a scribble. The small cut is
// upright and pixel-aligned, so it stays sharp without it.
const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">` +
  `${body}</svg>`;

/** Sizes Windows actually asks for, and which cut serves each. */
const SIZES = [
  { px: 16, cut: "small" },
  { px: 24, cut: "small" },
  { px: 32, cut: "full" },
  { px: 48, cut: "full" },
  { px: 64, cut: "full" },
  { px: 128, cut: "full" },
  { px: 256, cut: "full" },
];

/**
 * Pack PNGs into an .ico. Vista and later accept PNG-compressed entries, so the
 * whole format here is a 6 byte header and a 16 byte directory entry each.
 * A 256px image is recorded as 0, the field being one byte wide.
 */
function packIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = [];
  for (const { px, png } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(px >= 256 ? 0 : px, 0);
    e.writeUInt8(px >= 256 ? 0 : px, 1);
    e.writeUInt8(0, 2); // palette size, 0 for true colour
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

const browser = await chromium.launch();
const page = await browser.newPage();
const images = [];

for (const { px, cut } of SIZES) {
  const body = cut === "small" ? smallMark() : fullMark();
  await page.setViewportSize({ width: px, height: px });
  await page.setContent(
    `<style>html,body{margin:0;padding:0;overflow:hidden}svg{display:block}</style>` +
      svg(body).replace(/width="64" height="64"/, `width="${px}" height="${px}"`),
  );
  images.push({ px, png: await page.screenshot({ omitBackground: false }) });
  console.log(`  ${px}px  ${cut}`);
}

// A contact sheet at true size on both a light and a dark taskbar, because the
// only thing that matters about an icon is whether it reads at 16px, and that
// cannot be judged from a 256px render.
const strip = (bg, ink) => `
  <div style="background:${bg};color:${ink};padding:14px 16px;display:flex;
              gap:22px;align-items:flex-end;font:600 11px Segoe UI,sans-serif">
    ${SIZES.filter((s) => s.px <= 64)
      .map(
        ({ px, cut }) => `<div style="text-align:center">
          <img src="data:image/png;base64,${images.find((i) => i.px === px).png.toString("base64")}"
               width="${px}" height="${px}" style="image-rendering:pixelated;display:block">
          <div style="margin-top:6px;opacity:.7">${px} ${cut}</div>
        </div>`,
      )
      .join("")}
  </div>`;

await page.setViewportSize({ width: 460, height: 220 });
await page.setContent(
  `<style>html,body{margin:0;font-family:Segoe UI,sans-serif}</style>` +
    strip("#f2f0ea", "#000") +
    strip("#1f1f1f", "#fff") +
    strip("#202b3c", "#fff"),
);
mkdirSync(path.join(root, "design", "shots"), { recursive: true });
const preview = path.join(root, "design", "shots", "icon-sizes.png");
await page.screenshot({ path: preview, fullPage: true });
console.log(`wrote ${path.relative(root, preview)}`);

await browser.close();

mkdirSync(path.join(root, "build"), { recursive: true });
const ico = path.join(root, "build", "icon.ico");
writeFileSync(ico, packIco(images));
console.log(`wrote ${path.relative(root, ico)} with ${images.length} sizes`);

// The tray reads its icon from a base64 string so the daemon needs no asset
// files on disk. Generated rather than pasted, so it cannot fall out of step
// with the .ico.
const trayPng = (px) => images.find((i) => i.px === px).png.toString("base64");
const trayTs = `// Generated by design/make-icon.mjs. Do not edit by hand.
//
// The tray icon is embedded rather than loaded from disk so the daemon needs no
// asset files beside it. Two sizes, because Windows picks by DPI.

export const TRAY_ICON_16 = "${trayPng(16)}";

export const TRAY_ICON_32 = "${trayPng(32)}";
`;
const trayFile = path.join(root, "electron", "trayIcon.ts");
writeFileSync(trayFile, trayTs, "utf8");
console.log(`wrote ${path.relative(root, trayFile)}`);
