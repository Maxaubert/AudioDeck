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
  // Kept apart, as in useAppState: an action error (a set on a session that
  // just died) must stay visible until the user acts again, or the 1 s poll
  // wipes it before it can be read.
  const [pollError, setPollError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await api.getMixer();
      if (!alive.current) return;
      setApps(next.apps);
      setPollError(null);
    } catch (err) {
      // Keep the last rows on a failed poll; a stale mixer beats a blank one.
      if (!alive.current) return;
      setPollError(err instanceof Error ? err.message : String(err));
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
        setActionError(null);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : String(err));
      }
      await refresh();
    },
    [refresh],
  );

  return {
    apps,
    error: actionError ?? pollError,
    setAppVolume: (ids, level) => act(() => api.setAppVolume(ids, level))(),
    setAppMute: (ids, mute) => act(() => api.setAppMute(ids, mute))(),
  };
}
