// Preload: exposes the typed AudioDeckApi to the renderer via contextBridge.
// Every method is a thin ipcRenderer.invoke; no logic lives here.

import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "../shared/ipc.js";
import type { AudioDeckApi } from "../shared/ipc.js";
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
  renameDevice: (id: string, name: string) => ipcRenderer.invoke(IPC.renameDevice, id, name),
  setPaused: (paused: boolean) => ipcRenderer.invoke(IPC.setPaused, paused),
  setAutostart: (enabled: boolean) => ipcRenderer.invoke(IPC.setAutostart, enabled),
  setPollInterval: (ms: number) => ipcRenderer.invoke(IPC.setPollInterval, ms),
};

contextBridge.exposeInMainWorld("audiodeck", api);
