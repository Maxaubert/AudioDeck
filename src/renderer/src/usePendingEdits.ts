// Optimistic state for the edits Windows takes a second or two to confirm.
// A rename or type change should show its new value immediately with a Saving
// chip, or it looks ignored. Lives on the row rather than in the expanded
// panel, so closing the panel does not throw away a save in flight.

import { useEffect, useState } from "react";

/** Drop optimistic values after this long; failures surface in the banner. */
const GIVE_UP_MS = 8000;

export interface PendingEdits {
  /** Requested values still waiting for Windows, null when nothing is in flight. */
  name: string | null;
  detail: string | null;
  type: string | null;
  saving: boolean;
  mark(edit: { name?: string; detail?: string; type?: string }): void;
}

/**
 * Each field clears itself once the live value matches what was asked for, so
 * a save that lands early stops looking pending without waiting for the timer.
 */
export function usePendingEdits(live: {
  name: string;
  detail: string | null;
  type: string | null;
}): PendingEdits {
  const [name, setName] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);

  useEffect(() => {
    if (name !== null && live.name === name) setName(null);
  }, [name, live.name]);

  useEffect(() => {
    if (detail !== null && live.detail === detail) setDetail(null);
  }, [detail, live.detail]);

  useEffect(() => {
    if (type !== null && live.type === type) setType(null);
  }, [type, live.type]);

  const saving = name !== null || detail !== null || type !== null;
  useEffect(() => {
    if (!saving) return;
    const timer = setTimeout(() => {
      setName(null);
      setDetail(null);
      setType(null);
    }, GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, [saving, name, detail, type]);

  return {
    name,
    detail,
    type,
    saving,
    mark: (edit) => {
      if (edit.name !== undefined) setName(edit.name);
      if (edit.detail !== undefined) setDetail(edit.detail);
      if (edit.type !== undefined) setType(edit.type);
    },
  };
}
