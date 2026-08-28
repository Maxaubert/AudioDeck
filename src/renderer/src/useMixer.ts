// The Mixer tab's own data source: polls getMixer while the tab is mounted.
// Separate from useAppState so sessions are only gathered when someone is
// looking at them; 1 s keeps external changes (the Windows mixer, an app's own
// volume UI) feeling live.

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import type { MixerAppView } from "../../../shared/ipc.js";

const MIXER_POLL_MS = 1000;

export interface MixerHook {
  /** Null before the first poll answers. */
  apps: MixerAppView[] | null;
  error: string | null;
  setAppVolume: (sessionIds: string[], level: number) => Promise<void>;
  setAppMute: (sessionIds: string[], mute: boolean) => Promise<void>;
}

export function useMixer(): MixerHook {
  const [apps, setApps] = useState<MixerAppView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await api.getMixer();
      if (!alive.current) return;
      setApps(next.apps);
      setError(null);
    } catch (err) {
      // Keep the last rows on a failed poll; a stale mixer beats a blank one.
      if (!alive.current) return;
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void refresh();
    const timer = setInterval(() => void refresh(), MIXER_POLL_MS);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, [refresh]);

  const act = useCallback(
    (fn: () => Promise<void>) => async () => {
      try {
        await fn();
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
      await refresh();
    },
    [refresh],
  );

  return {
    apps,
    error,
    setAppVolume: (ids, level) => act(() => api.setAppVolume(ids, level))(),
    setAppMute: (ids, mute) => act(() => api.setAppMute(ids, mute))(),
  };
}
