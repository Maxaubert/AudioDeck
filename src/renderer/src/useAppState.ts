// Polls the daemon for AppState and exposes refresh-after-action wrappers.
// The single data source for all views.

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import type { AppState, AudioDeckApi } from "../../../shared/ipc.js";

const POLL_MS = 1500;

export interface AppStateHook {
  state: AppState | null;
  /** Non-null when the last daemon call failed. */
  error: string | null;
  refresh: () => Promise<void>;
  actions: AudioDeckApi;
}

export function useAppState(): AppStateHook {
  const [state, setState] = useState<AppState | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await api.getState();
      if (!alive.current) return;
      setState(next);
      // Only clears poll errors: an action error must stay visible until the
      // user acts again, or the background poll wipes it before it is read.
      setPollError(null);
    } catch (err) {
      if (!alive.current) return;
      setPollError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, [refresh]);

  const wrap = useCallback(
    <A extends unknown[]>(fn: (...args: A) => Promise<void>) =>
      async (...args: A): Promise<void> => {
        try {
          await fn(...args);
          setActionError(null);
        } catch (err) {
          setActionError(err instanceof Error ? err.message : String(err));
        }
        await refresh();
      },
    [refresh],
  );

  const actionsRef = useRef<AudioDeckApi | null>(null);
  if (actionsRef.current === null) {
    actionsRef.current = {
      getState: () => api.getState(),
      setPriority: wrap((flow, ids) => api.setPriority(flow, ids)),
      addToPriority: wrap((flow, id) => api.addToPriority(flow, id)),
      removeFromPriority: wrap((flow, id) => api.removeFromPriority(flow, id)),
      setDefault: wrap((id) => api.setDefault(id)),
      setVolume: wrap((id, level) => api.setVolume(id, level)),
      setMute: wrap((id, mute) => api.setMute(id, mute)),
      setEndpointEnabled: wrap((id, enabled) => api.setEndpointEnabled(id, enabled)),
      setAlias: wrap((id, alias) => api.setAlias(id, alias)),
      renameDevice: wrap((id, name, suffix) => api.renameDevice(id, name, suffix)),
      setDeviceType: wrap((id, typeKey) => api.setDeviceType(id, typeKey)),
      setPaused: wrap((paused) => api.setPaused(paused)),
      setAutostart: wrap((enabled) => api.setAutostart(enabled)),
      setPollInterval: wrap((ms) => api.setPollInterval(ms)),
      windowMinimize: () => api.windowMinimize(),
      windowToggleMaximize: () => api.windowToggleMaximize(),
      windowClose: () => api.windowClose(),
      windowIsMaximized: () => api.windowIsMaximized(),
      onWindowStateChanged: (cb) => api.onWindowStateChanged(cb),
    };
  }

  return { state, error: actionError ?? pollError, refresh, actions: actionsRef.current };
}

export { splitDeviceName } from "../../../shared/deviceName.js";
import { splitDeviceName } from "../../../shared/deviceName.js";

/** Display name: user alias wins, then the clean part of the Windows name. */
export function displayName(device: { name: string; alias: string | null }): string {
  return device.alias ?? splitDeviceName(device.name).title;
}

/** Secondary line under a device title: the technical part of the name. */
export function displayDetail(device: { name: string; alias: string | null }): string | null {
  if (device.alias !== null) return device.name;
  return splitDeviceName(device.name).detail;
}
