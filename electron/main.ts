// Main-process entry: wiring only. Boots config, tray, poller, autostart,
// IPC, and the on-demand renderer window.
// AUDIODECK_TEST_MODE=1 (e2e and screenshots): no tray, no registry writes,
// window opens immediately. AUDIODECK_MOCK_DEVICES=1 swaps the spawn-based
// backends for the in-memory mock backend.

import { app, dialog } from "electron";
import { installFileLog } from "./filelog.js";
import { Audioctl } from "./audioctl.js";
import { audioctlExePath, headsetControlExePath } from "./binaries.js";
import { HeadsetControl } from "./headsetcontrol.js";
import { MockAudioctl, MockHeadsetControl } from "./mock-backend.js";
import { Poller } from "./poller.js";
import { createTray } from "./tray.js";
import { defaultConfig, loadConfig, quarantineConfig, saveConfig } from "./config.js";
import { setAutostart, startedByWindows } from "./autostart.js";
import { registerIpc } from "./ipc.js";
import { EffectsService } from "./eqapo/service.js";
import { mockEffectsService } from "./mock-backend.js";
import { WindowManager } from "./window.js";
import type { AudioDeckConfig } from "./config.js";
import type { TrayHandle } from "./tray.js";

const testMode = process.env.AUDIODECK_TEST_MODE === "1";
const mockDevices = process.env.AUDIODECK_MOCK_DEVICES === "1";

// One tray daemon per machine; a second launch just exits.
if (!testMode && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // Anything that escapes boot has to end the process. Left unhandled, a
  // failure part way through leaves a daemon holding the single-instance lock
  // with no tray, no window and no poller, and every relaunch then quits at
  // the check above and vanishes: the app looks uninstallable rather than
  // broken, and there is nothing to click to find out why.
  void boot().catch((err: unknown) => {
    console.error("[main] startup failed:", err);
    if (!testMode) {
      dialog.showErrorBox(
        "AudioDeck could not start",
        `${err instanceof Error ? err.message : String(err)}

Nothing has been changed. ` +
          "Please report this with the details above.",
      );
    }
    app.exit(1);
  });
}

/**
 * Read the config, and survive one that will not parse.
 *
 * loadConfig deliberately throws rather than discarding data it cannot read,
 * and this is the caller it says decides what to do: set the bad file aside so
 * it can be recovered by hand, start from defaults, and say so out loud. The
 * alternative is the daemon dying before it has a tray, which is invisible.
 */
async function loadStartupConfig(): Promise<AudioDeckConfig> {
  try {
    return await loadConfig();
  } catch (err) {
    console.error("[config] unreadable, starting from defaults:", err);
    const kept = await quarantineConfig();
    if (!testMode) {
      dialog.showErrorBox(
        "AudioDeck could not read its settings",
        `${err instanceof Error ? err.message : String(err)}

` +
          (kept === null
            ? "Starting with default settings."
            : `Your old settings file has been kept at:
${kept}

` +
              "AudioDeck has started with default settings."),
      );
    }
    return defaultConfig();
  }
}

async function boot(): Promise<void> {
  // Packaged builds have no console; mirror daemon logs to a file so field
  // issues (a switch that never happened) are diagnosable after the fact.
  if (app.isPackaged) installFileLog();
  await app.whenReady();

  let config: AudioDeckConfig = await loadStartupConfig();

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

  // Under the mock backend the effects service gets an in-memory install, so
  // the Studio tab can be driven on any machine without Equalizer APO, and
  // without a test writing into Program Files.
  const effects = mockDevices ? mockEffectsService() : new EffectsService();

  const windows = new WindowManager();

  let tray: TrayHandle | null = null;

  /** Hold or release automation without writing it down. Boot uses this. */
  const applyPaused = (paused: boolean): void => {
    poller.setPaused(paused);
    tray?.setPausedChecked(paused);
  };

  /**
   * The single writer of config.paused, so the tray and the Settings page
   * cannot disagree. They did: only the IPC handler saved, so a pause from the
   * tray was forgotten at restart, and an unpause from the tray after a pause
   * from Settings left paused:true on disk, bringing every later launch up with
   * automation dead and no obvious reason why.
   */
  const setPaused = async (paused: boolean): Promise<void> => {
    applyPaused(paused);
    if (config.paused === paused) return;
    config = { ...config, paused };
    await saveConfig(config);
  };

  if (!testMode) {
    tray = createTray({
      openWindow: () => windows.open(),
      setPaused,
      quit: () => app.quit(),
    });
    // Launching the exe while the daemon is already running opens the window,
    // so users are never stranded hunting for the tray icon.
    app.on("second-instance", () => windows.open());
  }

  registerIpc({
    audioctl,
    poller,
    effects,
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

  // Re-assert the saved profiles on start. Equalizer APO may have been
  // reinstalled, or its config cleared, since AudioDeck last ran; the profiles
  // in AudioDeck's own config are the source of truth, not the file it writes.
  if (!mockDevices) {
    void effects.apply(config).catch((err) => console.error("[effects] initial apply:", err));
  }

  // Restore the held state before the first tick, so a paused AudioDeck does
  // not switch a device on the way up. Applied rather than set: this is reading
  // the saved value back, not a new decision to write down.
  if (config.paused) applyPaused(true);

  poller.start();
  console.log(`[main] AudioDeck daemon up, poll interval ${config.pollIntervalMs} ms`);

  // Starting AudioDeck by hand means someone wants to look at it, so the window
  // opens. Going straight to the tray is only right when Windows started it,
  // which is why the Run key passes STARTUP_FLAG and nothing else does.
  //
  // A Run key written by an older build has no flag on it, so the first login
  // after upgrading opens the window once. The key is rewritten just above, so
  // it corrects itself and is not worth special-casing.
  if (!startedByWindows()) windows.open();

  app.on("before-quit", () => poller.stop());
}

// Tray app: closing windows must not quit the daemon.
app.on("window-all-closed", () => {
  // Intentionally empty.
});
