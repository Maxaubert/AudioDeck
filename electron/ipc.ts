// ipcMain handlers backing the AudioDeckApi contract. Maps renderer requests
// onto the daemon's services; owns no state of its own.

import { ipcMain } from "electron";
import { evaluateAvailability } from "./availability.js";
import { IPC } from "../shared/ipc.js";
import type { Audioctl, EndpointFlow } from "./audioctl.js";
import type { AudioDeckConfig } from "./config.js";
import type { Poller, PollSnapshot } from "./poller.js";
import type { AppState, DeviceView } from "../shared/ipc.js";

export interface IpcDeps {
  audioctl: Audioctl;
  poller: Poller;
  getConfig: () => AudioDeckConfig;
  saveConfig: (config: AudioDeckConfig) => Promise<void>;
  /** Toggle automation pause; main keeps poller and tray checkbox in sync. */
  setPaused: (paused: boolean) => void;
  /** Apply the autostart flag to the HKCU Run key. */
  applyAutostart: (enabled: boolean) => Promise<void>;
}

export function registerIpc(deps: IpcDeps): void {
  const { audioctl, poller } = deps;

  ipcMain.handle(IPC.getState, async (): Promise<AppState> => {
    const snapshot = poller.snapshot() ?? (await freshSnapshot(audioctl));
    const config = deps.getConfig();
    const devices: DeviceView[] = snapshot.availability.map((a) => ({
      id: a.endpoint.id,
      name: a.endpoint.name,
      alias: config.aliases[a.endpoint.id] ?? null,
      flow: a.endpoint.flow,
      state: a.endpoint.state,
      isDefault: a.endpoint.isDefault,
      isDefaultComms: a.endpoint.isDefaultComms,
      volume: a.endpoint.volume,
      mute: a.endpoint.mute,
      available: a.available,
      availabilityReason: a.reason,
    }));
    return {
      devices,
      outputPriority: config.outputPriority,
      micPriority: config.micPriority,
      paused: poller.isPaused(),
      autostart: config.autostart,
      pollIntervalMs: config.pollIntervalMs,
    };
  });

  ipcMain.handle(IPC.setPriority, async (_e, flow: EndpointFlow, ids: string[]) => {
    const key = flow === "render" ? "outputPriority" : "micPriority";
    await deps.saveConfig({ ...deps.getConfig(), [key]: ids });
    await poller.refreshNow();
  });

  ipcMain.handle(IPC.setDefault, async (_e, id: string) => {
    // A user-chosen default is a manual override; the rules engine sees the
    // deviation on the next tick and engages the hold (design: behavior rules).
    await audioctl.setDefault(id);
    await poller.refreshNow();
  });

  ipcMain.handle(IPC.setVolume, async (_e, id: string, level: number) => {
    await audioctl.setVolume(id, Math.round(level));
    await poller.refreshNow();
  });

  ipcMain.handle(IPC.setMute, async (_e, id: string, mute: boolean) => {
    if (mute) await audioctl.mute(id);
    else await audioctl.unmute(id);
    await poller.refreshNow();
  });

  ipcMain.handle(IPC.setEndpointEnabled, async (_e, id: string, enabled: boolean) => {
    if (enabled) await audioctl.enable(id);
    else await audioctl.disable(id);
    await poller.refreshNow();
  });

  ipcMain.handle(IPC.setAlias, async (_e, id: string, alias: string | null) => {
    const config = deps.getConfig();
    const aliases = { ...config.aliases };
    const trimmed = alias?.trim() ?? "";
    if (trimmed === "") delete aliases[id];
    else aliases[id] = trimmed;
    await deps.saveConfig({ ...config, aliases });
  });

  ipcMain.handle(IPC.setPaused, (_e, paused: boolean) => {
    deps.setPaused(paused);
  });

  ipcMain.handle(IPC.setAutostart, async (_e, enabled: boolean) => {
    await deps.saveConfig({ ...deps.getConfig(), autostart: enabled });
    await deps.applyAutostart(enabled);
  });

  ipcMain.handle(IPC.setPollInterval, async (_e, ms: number) => {
    const clamped = Math.min(60_000, Math.max(500, Math.round(ms)));
    await deps.saveConfig({ ...deps.getConfig(), pollIntervalMs: clamped });
  });
}

/** Direct gather for the rare window-open before the poller's first tick. */
async function freshSnapshot(audioctl: Audioctl): Promise<PollSnapshot> {
  const endpoints = await audioctl.list();
  return { endpoints, availability: evaluateAvailability(endpoints, null) };
}
