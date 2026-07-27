// ipcMain handlers backing the AudioDeckApi contract. Maps renderer requests
// onto the daemon's services; owns no state of its own.

import { execFile } from "node:child_process";
import { ipcMain } from "electron";
import { evaluateAvailability } from "./availability.js";
import { IPC } from "../shared/ipc.js";
import type { AudioControl, EndpointFlow } from "./audioctl.js";
import type { AudioDeckConfig } from "./config.js";
import type { Poller, PollSnapshot } from "./poller.js";
import type { AppState, DeviceView } from "../shared/ipc.js";

export interface IpcDeps {
  audioctl: AudioControl;
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
    const key = flow === "capture" ? "micPriority" : "outputPriority";
    const cleaned = Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [];
    await deps.saveConfig({ ...deps.getConfig(), [key]: cleaned });
    await poller.refreshNow();
  });

  ipcMain.handle(IPC.addToPriority, async (_e, flow: EndpointFlow, id: string) => {
    if (typeof id !== "string" || id === "") return;
    const config = deps.getConfig();
    const priorityKey = flow === "capture" ? ("micPriority" as const) : ("outputPriority" as const);
    const excludedKey = flow === "capture" ? ("mic" as const) : ("output" as const);
    if (config[priorityKey].includes(id)) return;
    await deps.saveConfig({
      ...config,
      [priorityKey]: [...config[priorityKey], id],
      excluded: {
        ...config.excluded,
        [excludedKey]: config.excluded[excludedKey].filter((x) => x !== id),
      },
    });
    await poller.refreshNow();
  });

  ipcMain.handle(IPC.removeFromPriority, async (_e, flow: EndpointFlow, id: string) => {
    if (typeof id !== "string" || id === "") return;
    const config = deps.getConfig();
    const priorityKey = flow === "capture" ? ("micPriority" as const) : ("outputPriority" as const);
    const excludedKey = flow === "capture" ? ("mic" as const) : ("output" as const);
    const excludedIds = config.excluded[excludedKey];
    await deps.saveConfig({
      ...config,
      [priorityKey]: config[priorityKey].filter((x) => x !== id),
      excluded: {
        ...config.excluded,
        [excludedKey]: excludedIds.includes(id) ? excludedIds : [...excludedIds, id],
      },
    });
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

  ipcMain.handle(IPC.renameDevice, async (_e, id: string, name: string, suffix?: unknown) => {
    if (typeof id !== "string" || typeof name !== "string" || name.trim() === "") return;
    const cleanSuffix =
      typeof suffix === "string" && suffix.trim() !== "" ? suffix.trim() : undefined;
    try {
      await audioctl.rename(id, name.trim(), cleanSuffix);
      console.log(`[ipc] renamed ${id} to "${name.trim()}"${cleanSuffix === undefined ? "" : ` (${cleanSuffix})`}`);
    } catch (err) {
      console.error(`[ipc] rename ${id} failed:`, err);
      throw err;
    }
    // A rename replaces any local alias; the device now IS the new name.
    const config = deps.getConfig();
    if (config.aliases[id] !== undefined) {
      const aliases = { ...config.aliases };
      delete aliases[id];
      await deps.saveConfig({ ...config, aliases });
    }
    // Windows recomposes the display name asynchronously (~350 ms measured);
    // wait it out so the refresh below already carries the new name.
    await new Promise((resolve) => setTimeout(resolve, 700));
    await poller.refreshNow();
    // The quick-settings flyout (ShellHost) only re-reads device names when
    // its process restarts; bounce it so the rename shows up there too. It
    // respawns on demand and holds no user state.
    restartShellHost();
  });

  ipcMain.handle(IPC.setPaused, (_e, paused: boolean) => {
    deps.setPaused(paused);
  });

  ipcMain.handle(IPC.setAutostart, async (_e, enabled: boolean) => {
    await deps.saveConfig({ ...deps.getConfig(), autostart: enabled });
    await deps.applyAutostart(enabled);
  });

  ipcMain.handle(IPC.setPollInterval, async (_e, ms: number) => {
    // Reject non-finite input: NaN would survive min/max clamping, persist to
    // config, and turn the poller's setTimeout into a busy loop.
    if (typeof ms !== "number" || !Number.isFinite(ms)) return;
    const clamped = Math.min(60_000, Math.max(500, Math.round(ms)));
    await deps.saveConfig({ ...deps.getConfig(), pollIntervalMs: clamped });
  });
}

/** Kill ShellHost (quick-settings host); Windows respawns it on demand. */
function restartShellHost(): void {
  // Never touch the real shell from e2e/screenshot runs.
  if (process.env.AUDIODECK_TEST_MODE === "1") return;
  execFile("taskkill", ["/F", "/IM", "ShellHost.exe"], { windowsHide: true }, (err) => {
    if (err !== null) console.log("[ipc] ShellHost restart skipped:", err.message);
  });
}

/** Direct gather for the rare window-open before the poller's first tick. */
async function freshSnapshot(audioctl: AudioControl): Promise<PollSnapshot> {
  const endpoints = await audioctl.list();
  return { endpoints, availability: evaluateAvailability(endpoints, null) };
}
