import { chromium } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";

const dir = "C:/Users/Admin/Documents/Claude/Github/AudioDeck/design/mockups";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
await page.goto(pathToFileURL(path.join(dir, "pal-amber.html")).href);
await page.getByRole("tab", { name: "Mixer" }).click();
await page.waitForTimeout(300);

const fader = page.locator(".vol input[type=range]").first();
const box = await fader.boundingBox();

// drag with the mouse, the way a user changes volume
await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(150);

const afterMouse = await page.locator(".vol").first().evaluate((el) => getComputedStyle(el).outlineStyle);
await page.screenshot({ path: path.join(dir, "..", "shots", "slider-mouse.png"), clip: { x: 60, y: 120, width: 1240, height: 320 } });

// keyboard focus should still be visible for accessibility
await page.keyboard.press("Tab");
await page.keyboard.press("Shift+Tab");
await fader.focus();
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(150);
const afterKey = await page.locator(".vol").first().evaluate((el) => getComputedStyle(el).outlineStyle);

console.log(`outline after mouse drag: ${afterMouse}`);
console.log(`outline after keyboard:   ${afterKey}`);
await browser.close();
