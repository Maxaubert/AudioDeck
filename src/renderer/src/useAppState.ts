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
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await api.getState();
      if (!alive.current) return;
      setState(next);
      setError(null);
    } catch (err) {
      if (!alive.current) return;
      setError(err instanceof Error ? err.message : String(err));
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
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
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
      setDefault: wrap((id) => api.setDefault(id)),
      setVolume: wrap((id, level) => api.setVolume(id, level)),
      setMute: wrap((id, mute) => api.setMute(id, mute)),
      setEndpointEnabled: wrap((id, enabled) => api.setEndpointEnabled(id, enabled)),
      setAlias: wrap((id, alias) => api.setAlias(id, alias)),
      setPaused: wrap((paused) => api.setPaused(paused)),
      setAutostart: wrap((enabled) => api.setAutostart(enabled)),
      setPollInterval: wrap((ms) => api.setPollInterval(ms)),
    };
  }

  return { state, error, refresh, actions: actionsRef.current };
}

/** Display name: user alias wins over the Windows friendly name. */
export function displayName(device: { name: string; alias: string | null }): string {
  return device.alias ?? device.name;
}
