// Tray icon and menu (Open AudioDeck, Pause automation, Quit).
// Stage 2 stub: interface is final, implementation lands with the daemon core.

import type { Tray } from "electron";

export interface TrayActions {
  openWindow: () => void;
  setPaused: (paused: boolean) => void;
  quit: () => void;
}

export function createTray(actions: TrayActions): Tray {
  void actions;
  throw new Error("tray.createTray: Stage 2 stub, implemented with the daemon core");
}
