// Tray icon and menu (Open AudioDeck, Pause automation, Quit).

import { Menu, Tray, nativeImage } from "electron";

export interface TrayActions {
  openWindow: () => void;
  setPaused: (paused: boolean) => void;
  quit: () => void;
}

// 16x16 speaker glyph, embedded so the daemon needs no asset files on disk.
const TRAY_ICON_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAANUlEQVR4nGNgGAVEgQ8fvv7HxsaqEIbRxXAZiNcAbAYSbQA6pr8BFHsBXYwoA3ABoqNxhAIAbbywGbuf4qAAAAAASUVORK5CYII=";

export function createTray(actions: TrayActions): Tray {
  const icon = nativeImage.createFromDataURL(`data:image/png;base64,${TRAY_ICON_PNG_BASE64}`);
  const tray = new Tray(icon);
  tray.setToolTip("AudioDeck");

  const menu = Menu.buildFromTemplate([
    {
      label: "Open AudioDeck",
      click: () => actions.openWindow(),
    },
    {
      label: "Pause automation",
      type: "checkbox",
      checked: false,
      click: (item) => actions.setPaused(item.checked),
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => actions.quit(),
    },
  ]);
  tray.setContextMenu(menu);
  tray.on("click", () => actions.openWindow());
  return tray;
}
