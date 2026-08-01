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
  // Switching the Windows default takes a moment. Show the click immediately
  // and let the daemon catch up, so the UI never feels stuck.
  const [pendingDefault, setPendingDefault] = useState<string | null>(null);
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
      setDefault: wrap(async (id) => {
        setPendingDefault(id);
        await api.setDefault(id);
      }),
      setVolume: wrap((id, level) => api.setVolume(id, level)),
      setMute: wrap((id, mute) => api.setMute(id, mute)),
      setEndpointEnabled: wrap((id, enabled) => api.setEndpointEnabled(id, enabled)),
      setAlias: wrap((id, alias) => api.setAlias(id, alias)),
      renameDevice: wrap((id, name, suffix) => api.renameDevice(id, name, suffix)),
      setDeviceType: wrap((id, typeKey) => api.setDeviceType(id, typeKey)),
      // Effects reads are not wrapped: they are queries, so they must not
      // trigger a state refresh or clear the action error on every poll.
      getEffectsStatus: () => api.getEffectsStatus(),
      getEqProfile: (deviceId) => api.getEqProfile(deviceId),
      setEqProfile: wrap((deviceId, profile) => api.setEqProfile(deviceId, profile)),
      installEffects: () => api.installEffects(),
      removeEffects: wrap(() => api.removeEffects()),
      setPaused: wrap((paused) => api.setPaused(paused)),
      setGuideSeen: wrap((seen) => api.setGuideSeen(seen)),
      setAutostart: wrap((enabled) => api.setAutostart(enabled)),
      setPollInterval: wrap((ms) => api.setPollInterval(ms)),
      windowMinimize: () => api.windowMinimize(),
      windowToggleMaximize: () => api.windowToggleMaximize(),
      windowClose: () => api.windowClose(),
      windowIsMaximized: () => api.windowIsMaximized(),
      onWindowStateChanged: (cb) => api.onWindowStateChanged(cb),
    };
  }

  // Clear the optimistic pick once the daemon agrees, or give up after a few
  // seconds so a failed switch cannot leave the UI lying.
  const pendingLanded =
    pendingDefault !== null &&
    state !== null &&
    state.devices.some((d) => d.id === pendingDefault && d.isDefault);

  useEffect(() => {
    if (pendingDefault === null) return;
    if (pendingLanded) {
      setPendingDefault(null);
      return;
    }
    const timer = setTimeout(() => setPendingDefault(null), 6000);
    return () => clearTimeout(timer);
  }, [pendingDefault, pendingLanded]);

  const view = applyPendingDefault(state, pendingDefault);

  return { state: view, error: actionError ?? pollError, refresh, actions: actionsRef.current };
}

/**
 * Move the "in use" marker onto the clicked device straight away. Only the
 * clicked device's own flow is touched, so choosing an output never disturbs
 * which microphone is shown as live.
 */
function applyPendingDefault(state: AppState | null, pendingId: string | null): AppState | null {
  if (state === null || pendingId === null) return state;
  const target = state.devices.find((d) => d.id === pendingId);
  if (target === undefined || target.isDefault) return state;
  return {
    ...state,
    devices: state.devices.map((d) =>
      d.flow === target.flow ? { ...d, isDefault: d.id === pendingId } : d,
    ),
  };
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
