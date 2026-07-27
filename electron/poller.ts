// The 2 s daemon loop: gather state, evaluate rules, act via audioctl.
// Stage 2 stub: interface is final, implementation lands with the daemon core.

import type { Audioctl } from "./audioctl.js";
import type { AudioDeckConfig } from "./config.js";
import type { HeadsetControl } from "./headsetcontrol.js";

export interface PollerDeps {
  audioctl: Audioctl;
  headsetControl: HeadsetControl;
  getConfig: () => AudioDeckConfig;
  saveConfig: (config: AudioDeckConfig) => Promise<void>;
}

export class Poller {
  constructor(private readonly deps: PollerDeps) {}

  start(): void {
    throw new Error("Poller.start: Stage 2 stub, implemented with the daemon core");
  }

  stop(): void {
    throw new Error("Poller.stop: Stage 2 stub, implemented with the daemon core");
  }

  /** Pause automation (tray toggle) without stopping the process. */
  setPaused(paused: boolean): void {
    void paused;
    throw new Error("Poller.setPaused: Stage 2 stub, implemented with the daemon core");
  }
}
