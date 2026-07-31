// e2e launch/teardown helper: boots the built app in test mode with the mock
// backend and a throwaway APPDATA, so config writes land in a temp file.

import { _electron } from "@playwright/test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ElectronApplication, Page } from "@playwright/test";
import type { AudioDeckConfig } from "../electron/config.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export interface LaunchedApp {
  app: ElectronApplication;
  page: Page;
  /** The temp config.json this instance reads and writes. */
  configFile: string;
  close: () => Promise<void>;
}

/**
 * Launch the built app (run `electron-vite build` first; `npm run e2e` does).
 * Test mode opens the window immediately, skips tray and registry; the mock
 * backend supplies deterministic device data.
 */
export async function launchApp(
  /** Partial config written before launch; missing fields take their defaults. */
  seedConfig?: Record<string, unknown>,
): Promise<LaunchedApp> {
  const appData = await mkdtemp(path.join(os.tmpdir(), "audiodeck-e2e-"));
  if (seedConfig !== undefined) {
    await mkdir(path.join(appData, "AudioDeck"), { recursive: true });
    await writeFile(
      path.join(appData, "AudioDeck", "config.json"),
      JSON.stringify(seedConfig, null, 2),
      "utf8",
    );
  }
  const app = await _electron.launch({
    args: ["."],
    cwd: repoRoot,
    env: {
      ...process.env,
      AUDIODECK_TEST_MODE: "1",
      AUDIODECK_MOCK_DEVICES: "1",
      APPDATA: appData,
    },
  });
  const page = await app.firstWindow();
  await page.waitForSelector('[data-loaded="true"]', { timeout: 30_000 });
  return {
    app,
    page,
    configFile: path.join(appData, "AudioDeck", "config.json"),
    close: async () => {
      await app.close();
      await rm(appData, { recursive: true, force: true });
    },
  };
}

/** Parse the temp config file this instance persisted. */
export async function readConfigFile(configFile: string): Promise<AudioDeckConfig> {
  return JSON.parse(await readFile(configFile, "utf8")) as AudioDeckConfig;
}
