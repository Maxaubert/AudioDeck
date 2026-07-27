// Main-process entry: wiring only. Boots config, tray, poller, and autostart.
// The on-demand renderer window is wired in when Stage 3 lands.

import { app } from "electron";
import { Audioctl } from "./audioctl.js";
import { HeadsetControl } from "./headsetcontrol.js";
import { Poller } from "./poller.js";
import { createTray } from "./tray.js";
import { loadConfig, saveConfig } from "./config.js";
import { setAutostart } from "./autostart.js";
import type { AudioDeckConfig } from "./config.js";
import type { Tray } from "electron";

// One tray daemon per machine; a second launch just exits.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  void boot();
}

async function boot(): Promise<void> {
  await app.whenReady();

  let config: AudioDeckConfig = await loadConfig();

  const poller = new Poller({
    audioctl: new Audioctl(),
    headsetControl: new HeadsetControl(),
    getConfig: () => config,
    saveConfig: async (next) => {
      config = next;
      await saveConfig(next);
    },
  });

  // Keep the tray reference alive for the process lifetime.
  let tray: Tray | null = null;
  tray = createTray({
    openWindow: () => {
      // Stage 3 wires the renderer window in here.
      console.log("[main] Open AudioDeck requested; UI lands in Stage 3");
    },
    setPaused: (paused) => poller.setPaused(paused),
    quit: () => app.quit(),
  });
  void tray;

  try {
    await setAutostart(config.autostart);
  } catch (err) {
    console.error("[main] autostart sync failed:", err);
  }

  poller.start();
  console.log(`[main] AudioDeck daemon up, poll interval ${config.pollIntervalMs} ms`);

  app.on("before-quit", () => poller.stop());
}

// Tray app: closing windows must not quit the daemon.
app.on("window-all-closed", () => {
  // Intentionally empty.
});
