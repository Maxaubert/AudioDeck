// The volume-lock stamp. Some hardware owns its own level and silently ignores
// what Windows writes: wireless headsets with a base station, TVs over HDMI.
// The mixer prints this stamp where the Mute button would be, with the reason
// on hover and on keyboard focus. Dashed, like every other inert plate in the
// system, so it never reads as a button.

import { useId, useState } from "react";

const MARK = 24;

export function VolumeLock({ hardware }: { hardware: string }) {
  const tipId = useId();
  // Pointer/focus state rather than CSS :hover: the mixer re-renders on every
  // poll, and a browser does not re-evaluate :hover under a cursor that has
  // not moved, so the reason could vanish while it is being read.
  const [open, setOpen] = useState(false);
  const reason = `${hardware} sets its own volume. Change it on the device or its base station; AudioDeck cannot read or set the level.`;
  return (
    <span
      className="vol-lock-slot"
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span
        className="vol-lock"
        tabIndex={0}
        role="img"
        aria-label="Volume set on the device"
        aria-describedby={tipId}
      >
        <svg
          className="vol-lock-mark"
          width={MARK}
          height={MARK}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M5.6 18.4 18.4 5.6" />
        </svg>
      </span>
      {/* Left of the stamp, inside the row's own height: above or below it
          would be clipped by the scrolling view on the first and last rows. */}
      <span
        className={open ? "vol-lock-tip is-open" : "vol-lock-tip"}
        id={tipId}
        role="tooltip"
      >
        {reason}
      </span>
    </span>
  );
}
