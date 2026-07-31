// On-demand renderer window: created from the tray, destroyed on close so the
// idle daemon carries no renderer cost. Nothing else creates BrowserWindows.

import { BrowserWindow } from "electron";
import { IPC } from "../shared/ipc.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const thisDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Never put the window on screen. The e2e suite launches the app once per
 * test, and a window flashing up and away that many times is unusable on a
 * machine someone is working at. Playwright drives an unshown window exactly
 * the same: it lays out, paints and answers input off screen.
 */
const HIDDEN = process.env.AUDIODECK_HIDDEN_WINDOW === "1";

export class WindowManager {
  private win: BrowserWindow | null = null;

  /** Open the AudioDeck window, or focus it if it is already open. */
  open(): void {
    if (this.win !== null) {
      if (this.win.isMinimized()) this.win.restore();
      this.win.focus();
      return;
    }

    const win = new BrowserWindow({
      width: 1180,
      height: 900,
      // Matches the stylesheet's `body { min-width }`: any narrower and the
      // window only gains a horizontal scrollbar, it does not show more.
      minWidth: 940,
      minHeight: 640,
      backgroundColor: "#000000",
      autoHideMenuBar: true,
      show: false,
      title: "AudioDeck",
      // Frameless: the renderer draws the caption strip. Windows still gives
      // us edge resizing and snap because the window stays resizable.
      frame: false,
      webPreferences: {
        preload: path.join(thisDir, "../preload/preload.mjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        // An unshown window would otherwise have its timers throttled, which
        // would stall the renderer's own poll under test.
        backgroundThrottling: !HIDDEN,
      },
    });

    if (!HIDDEN) win.once("ready-to-show", () => win.show());
    win.on("closed", () => {
      this.win = null;
    });
    // The caption's maximize glyph mirrors the real window state.
    const sendState = (): void => {
      if (!win.isDestroyed()) win.webContents.send(IPC.windowStateChanged, win.isMaximized());
    };
    win.on("maximize", sendState);
    win.on("unmaximize", sendState);

    const devUrl = process.env.ELECTRON_RENDERER_URL;
    if (devUrl !== undefined && devUrl !== "") {
      void win.loadURL(devUrl);
    } else {
      void win.loadFile(path.join(thisDir, "../renderer/index.html"));
    }
    this.win = win;
  }

  closeAll(): void {
    this.win?.destroy();
    this.win = null;
  }
}
