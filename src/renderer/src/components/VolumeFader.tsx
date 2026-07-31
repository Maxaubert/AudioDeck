// The volume control of a device row: a 20-block segmented meter with an
// invisible range input laid over it, so dragging behaves exactly like a
// slider while the visuals stay in the print language. Renders two grid cells,
// the meter and the percentage, because both read the same optimistic value.

import { useEffect, useRef, useState } from "react";
import type { AudioDeckApi, DeviceView } from "../../../../shared/ipc.js";

const SEGMENTS = 20;
/** Wait this long after the last drag step before telling the daemon. */
const COMMIT_DELAY_MS = 200;

function Meter({ value }: { value: number }) {
  const lit = Math.round((value / 100) * SEGMENTS);
  return (
    <div className="segs" aria-hidden="true">
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <span key={i} className={i < lit ? "f" : undefined} />
      ))}
    </div>
  );
}

export function VolumeFader({
  device,
  actions,
}: {
  device: DeviceView;
  actions: AudioDeckApi;
}) {
  const [local, setLocal] = useState(device.volume ?? 0);
  const inputRef = useRef<HTMLInputElement>(null);
  // Volume the user asked for that has not reached the daemon yet.
  const pending = useRef<number | null>(null);
  const commit = useRef<(v: number) => void>(() => {});
  commit.current = (v: number) => void actions.setVolume(device.id, v);

  // Follow daemon updates unless the user is on the fader right now.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setLocal(device.volume ?? 0);
    }
  }, [device.volume]);

  // Debounced commit while dragging.
  useEffect(() => {
    if (local === (device.volume ?? 0)) {
      pending.current = null;
      return;
    }
    pending.current = local;
    const timer = setTimeout(() => {
      pending.current = null;
      commit.current(local);
    }, COMMIT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [local, device.volume]);

  // Leaving the page (or the row disappearing) must not swallow the change the
  // user just made: flush anything still inside the debounce window.
  useEffect(
    () => () => {
      if (pending.current !== null) commit.current(pending.current);
    },
    [],
  );

  const muted = device.mute === true;
  return (
    <>
      <div className="vol">
        <Meter value={local} />
        <input
          ref={inputRef}
          type="range"
          min={0}
          max={100}
          step={1}
          value={local}
          aria-label={`${device.name} volume`}
          onChange={(e) => setLocal(Number(e.target.value))}
        />
      </div>
      <span className={muted ? "volume-value is-muted" : "volume-value"}>{local}%</span>
    </>
  );
}
