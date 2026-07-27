// Main-process entry: wiring only. Stage 2 boots the app and loads config;
// tray, poller, and the on-demand window are wired in as later stages land.

import { app } from "electron";
import { loadConfig } from "./config.js";

app.whenReady().then(async () => {
  const config = await loadConfig();
  console.log(`AudioDeck daemon up, poll interval ${config.pollIntervalMs} ms`);
  // Later stages wire in here: createTray(...), new Poller(...).start(), autostart sync.
});

// Tray app: closing windows must not quit the daemon (there are none yet anyway).
app.on("window-all-closed", () => {
  // Intentionally empty.
});
