// Main-process entry: wiring only. Boots config, tray, poller, autostart,
// IPC, and the on-demand renderer window.
// AUDIODECK_TEST_MODE=1 (e2e and screenshots): no tray, no registry writes,
// window opens immediately. AUDIODECK_MOCK_DEVICES=1 swaps the spawn-based
// backends for the in-memory mock backend.

import { app } from "electron";
import { Audioctl } from "./audioctl.js";
import { audioctlExePath, headsetControlExePath } from "./binaries.js";
import { HeadsetControl } from "./headsetcontrol.js";
import { MockAudioctl, MockHeadsetControl } from "./mock-backend.js";
import { Poller } from "./poller.js";
import { createTray } from "./tray.js";
import { loadConfig, saveConfig } from "./config.js";
import { setAutostart } from "./autostart.js";
import { registerIpc } from "./ipc.js";
import { WindowManager } from "./window.js";
import type { AudioDeckConfig } from "./config.js";
import type { TrayHandle } from "./tray.js";

const testMode = process.env.AUDIODECK_TEST_MODE === "1";
const mockDevices = process.env.AUDIODECK_MOCK_DEVICES === "1";

// One tray daemon per machine; a second launch just exits.
if (!testMode && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  void boot();
}

async function boot(): Promise<void> {
  await app.whenReady();

  let config: AudioDeckConfig = await loadConfig();

  const audioctl = mockDevices ? new MockAudioctl() : new Audioctl({ exePath: audioctlExePath() });
  const poller = new Poller({
    audioctl,
    headsetControl: mockDevices
      ? new MockHeadsetControl()
      : new HeadsetControl({ exePath: headsetControlExePath() }),
    getConfig: () => config,
    saveConfig: async (next) => {
      config = next;
      await saveConfig(next);
    },
  });

  const windows = new WindowManager();

  let tray: TrayHandle | null = null;
  const setPaused = (paused: boolean): void => {
    poller.setPaused(paused);
    tray?.setPausedChecked(paused);
  };

  if (!testMode) {
    tray = createTray({
      openWindow: () => windows.open(),
      setPaused,
      quit: () => app.quit(),
    });
  }

  registerIpc({
    audioctl,
    poller,
    getConfig: () => config,
    saveConfig: async (next) => {
      config = next;
      await saveConfig(next);
    },
    setPaused,
    // Only a packaged build may touch the Run key: in dev process.execPath is
    // the bare electron.exe, which would autostart an empty Electron shell.
    applyAutostart: (enabled) =>
      testMode || !app.isPackaged ? Promise.resolve() : setAutostart(enabled),
  });

  if (!testMode && app.isPackaged) {
    try {
      await setAutostart(config.autostart);
    } catch (err) {
      console.error("[main] autostart sync failed:", err);
    }
  }

  poller.start();
  console.log(`[main] AudioDeck daemon up, poll interval ${config.pollIntervalMs} ms`);

  if (testMode) windows.open();

  app.on("before-quit", () => poller.stop());
}

// Tray app: closing windows must not quit the daemon.
app.on("window-all-closed", () => {
  // Intentionally empty.
});
