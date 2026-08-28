// The volume control of a row: a 20-block segmented meter with an
// invisible range input laid over it, so dragging behaves exactly like a
// slider while the visuals stay in the print language. Renders two grid cells,
// the meter and the percentage, because both read the same optimistic value.

import { useEffect, useRef, useState } from "react";

const SEGMENTS = 20;
/** Wait this long after the last drag step before telling the daemon. Kept
 *  short so the fader feels connected to the sound. */
const COMMIT_DELAY_MS = 60;

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

export function Fader({
  value,
  muted,
  ariaLabel,
  onCommit,
}: {
  value: number;
  muted: boolean;
  ariaLabel: string;
  onCommit: (v: number) => void;
}) {
  const [local, setLocal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  // Whether the user has hold of this fader right now. Focus is not the same
  // question: a range input keeps focus after a click, so testing focus meant
  // the row stopped following the daemon for the rest of its life, and the
  // debounced commit then wrote the stale value back over every media-key and
  // Windows-mixer change, including while AudioDeck was not the focused app.
  const holding = useRef(false);
  // Volume the user asked for that has not reached the daemon yet.
  const pending = useRef<number | null>(null);
  const commit = useRef<(v: number) => void>(() => {});
  commit.current = onCommit;

  // Follow daemon updates unless the user is mid-gesture, or a change of theirs
  // is still inside the debounce window and has not reached the daemon yet.
  useEffect(() => {
    if (!holding.current && pending.current === null) {
      setLocal(value);
    }
  }, [value]);

  // Debounced commit while dragging.
  useEffect(() => {
    if (local === value) {
      pending.current = null;
      return;
    }
    pending.current = local;
    const timer = setTimeout(() => {
      pending.current = null;
      commit.current(local);
    }, COMMIT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [local, value]);

  // Leaving the page (or the row disappearing) must not swallow the change the
  // user just made: flush anything still inside the debounce window.
  useEffect(
    () => () => {
      if (pending.current !== null) commit.current(pending.current);
    },
    [],
  );

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
          aria-label={ariaLabel}
          onChange={(e) => setLocal(Number(e.target.value))}
          onPointerDown={() => (holding.current = true)}
          onPointerUp={() => (holding.current = false)}
          onPointerCancel={() => (holding.current = false)}
          onKeyDown={() => (holding.current = true)}
          onKeyUp={() => (holding.current = false)}
          // A gesture that ended somewhere else must not leave the row deaf.
          onBlur={() => (holding.current = false)}
        />
      </div>
      <span className={muted ? "volume-value is-muted" : "volume-value"}>{local}%</span>
    </>
  );
}
