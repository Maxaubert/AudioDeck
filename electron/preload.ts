// Preload: exposes the typed AudioDeckApi to the renderer via contextBridge.
// Every method is a thin ipcRenderer.invoke; no logic lives here.

import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "../shared/ipc.js";
import type { AudioDeckApi, EqProfileView } from "../shared/ipc.js";
import type { EndpointFlow } from "./audioctl.js";

const api: AudioDeckApi = {
  getState: () => ipcRenderer.invoke(IPC.getState),
  setPriority: (flow: EndpointFlow, ids: string[]) =>
    ipcRenderer.invoke(IPC.setPriority, flow, ids),
  addToPriority: (flow: EndpointFlow, id: string) =>
    ipcRenderer.invoke(IPC.addToPriority, flow, id),
  removeFromPriority: (flow: EndpointFlow, id: string) =>
    ipcRenderer.invoke(IPC.removeFromPriority, flow, id),
  setDefault: (id: string) => ipcRenderer.invoke(IPC.setDefault, id),
  setVolume: (id: string, level: number) => ipcRenderer.invoke(IPC.setVolume, id, level),
  setMute: (id: string, mute: boolean) => ipcRenderer.invoke(IPC.setMute, id, mute),
  setEndpointEnabled: (id: string, enabled: boolean) =>
    ipcRenderer.invoke(IPC.setEndpointEnabled, id, enabled),
  setAlias: (id: string, alias: string | null) => ipcRenderer.invoke(IPC.setAlias, id, alias),
  renameDevice: (id: string, name: string, suffix?: string) =>
    ipcRenderer.invoke(IPC.renameDevice, id, name, suffix),
  setDeviceType: (id: string, typeKey: string) =>
    ipcRenderer.invoke(IPC.setDeviceType, id, typeKey),
  getEffectsStatus: () => ipcRenderer.invoke(IPC.getEffectsStatus),
  getEqProfile: (deviceId: string) => ipcRenderer.invoke(IPC.getEqProfile, deviceId),
  setEqProfile: (deviceId: string, profile: EqProfileView) =>
    ipcRenderer.invoke(IPC.setEqProfile, deviceId, profile),
  installEffects: () => ipcRenderer.invoke(IPC.installEffects),
  removeEffects: () => ipcRenderer.invoke(IPC.removeEffects),
  setPaused: (paused: boolean) => ipcRenderer.invoke(IPC.setPaused, paused),
  setAutostart: (enabled: boolean) => ipcRenderer.invoke(IPC.setAutostart, enabled),
  setPollInterval: (ms: number) => ipcRenderer.invoke(IPC.setPollInterval, ms),
  windowMinimize: () => ipcRenderer.invoke(IPC.windowMinimize),
  windowToggleMaximize: () => ipcRenderer.invoke(IPC.windowToggleMaximize),
  windowClose: () => ipcRenderer.invoke(IPC.windowClose),
  windowIsMaximized: () => ipcRenderer.invoke(IPC.windowIsMaximized),
  onWindowStateChanged: (cb: (maximized: boolean) => void) => {
    const listener = (_e: unknown, maximized: boolean): void => cb(maximized);
    ipcRenderer.on(IPC.windowStateChanged, listener);
    return () => ipcRenderer.removeListener(IPC.windowStateChanged, listener);
  },
};

contextBridge.exposeInMainWorld("audiodeck", api);
