// Decides whether a poll needs to ask HeadsetControl anything.
//
// The query costs about 0.7 s of USB HID transaction (measured 2026-08-01),
// almost none of it CPU, and it runs on the same bus as a mouse or keyboard.
// It is also pointless for anyone whose headset it does not support, which is
// most people: nothing it returns can change any answer.
//
// What it must NOT do is slow down while a supported headset IS present.
// Detecting the headset powering off is the whole point of the app, and the
// device sitting quietly powered on is exactly the state that precedes it, so
// "nothing has changed lately" is the worst possible reason to back off.

/** Re-probe this often when nothing supported was found, to notice a new dongle. */
export const IDLE_PROBE_MS = 60_000;

export interface GateState {
  /** Whether the last probe found a device matching a live endpoint. */
  relevant: boolean;
  /** Timestamp of the last probe. */
  probedAt: number;
  /** Endpoint fingerprint at the last probe. */
  endpointKey: string;
}

/**
 * A dongle appearing or disappearing always changes the endpoint list, so the
 * fingerprint is what makes this responsive without polling: plug a headset in
 * and the very next tick re-probes rather than waiting out the idle interval.
 */
export function endpointFingerprint(
  endpoints: readonly { id: string; state: string }[],
): string {
  return endpoints
    .map((e) => `${e.id}:${e.state}`)
    .sort()
    .join(" ");
}

export function shouldQueryHeadsets(
  state: GateState | null,
  endpointKey: string,
  now: number,
): boolean {
  // Nothing known yet: always ask.
  if (state === null) return true;
  // A supported headset is in play; never slow down.
  if (state.relevant) return true;
  // The hardware changed, so the previous "nothing supported" answer is stale.
  if (state.endpointKey !== endpointKey) return true;
  // Otherwise just often enough to notice a dongle we have not seen.
  return now - state.probedAt >= IDLE_PROBE_MS;
}
