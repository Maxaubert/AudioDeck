// Noticing when AudioDeck is in a fight over the default device.
//
// Reported from use: with a Meta Quest ranked low, Virtual Desktop kept pulling
// the default to the headset while AudioDeck pulled it back, so audio played
// for about two seconds, cut, came back, and repeated at the poll interval.
//
// AudioDeck already backs off when the default moves on its own: rules.decide
// engages a manual-override hold and stops. That defence does not survive this
// case, because it is released by any availability event, and a program like
// Virtual Desktop creates and tears down its endpoint as it takes and releases
// the audio. Every cycle manufactures an event, the hold clears, AudioDeck
// re-applies the ranking, and the fight resumes.
//
// The signal used here is deliberately the plainest one available: AudioDeck
// having to set the same device as default again and again. In a settled system
// that happens when something changes, which is rarely; several times a minute
// means the change is not sticking, and the only thing that can be undoing it
// is another program.
//
// An earlier version tried to be cleverer and watch for "the default I set was
// taken away". It never fired, because the poller sees its own change succeed
// on the following tick and the theft happens after that, so the evidence was
// always cleared before it could be used. Counting the re-assertions needs no
// such bookkeeping and cannot miss.
//
// Pure and time-injected, so the whole thing is testable without a clock.

/** Re-assertions of the same device inside the window before standing down. */
export const ASSERTIONS_TO_CONTEST = 5;
/**
 * How far back an assertion still counts. Wide enough that a fight at any poll
 * interval trips it quickly, and that unplugging a cable a few times while
 * setting things up does not.
 */
export const CONTENTION_WINDOW_MS = 60_000;

export interface ContentionState {
  /** When AudioDeck asserted each device as default, oldest first. */
  assertions: Map<string, number[]>;
  /** What was holding the default when AudioDeck gave up, if it has. */
  contestedBy: string | null;
}

export function emptyContention(): ContentionState {
  return { assertions: new Map(), contestedBy: null };
}

/**
 * Record that AudioDeck has just set `target` as the default, taking it from
 * `heldBy`. Mutates in place: this is called at most once per tick per flow,
 * and the state is private to the poller.
 */
export function noteAssertion(
  state: ContentionState,
  target: string,
  heldBy: string | null,
  now: number,
): ContentionState {
  const times = (state.assertions.get(target) ?? []).filter(
    (t) => now - t < CONTENTION_WINDOW_MS,
  );
  times.push(now);
  state.assertions.set(target, times);
  // Named after whatever kept taking it, so the UI can say who rather than
  // "something". Nothing to name means nothing to blame, so hold off.
  if (times.length >= ASSERTIONS_TO_CONTEST && heldBy !== null && heldBy !== target) {
    state.contestedBy = heldBy;
  }
  return state;
}

/**
 * Forget everything and start asserting again.
 *
 * Called when the user does something that counts as a new instruction:
 * changing the ranking, or picking a device by hand. Their choice deserves a
 * fresh attempt, even against a program that won last time.
 */
export function clearContention(state: ContentionState): ContentionState {
  state.assertions.clear();
  state.contestedBy = null;
  return state;
}

/**
 * Drop a hold whose contender is no longer there.
 *
 * Once AudioDeck stops asserting there is no more fight to observe, so nothing
 * else would ever clear this on its own. The contending device going away is
 * the one signal that still arrives.
 */
export function releaseIfGone(
  state: ContentionState,
  presentIds: ReadonlySet<string>,
): ContentionState {
  if (state.contestedBy !== null && !presentIds.has(state.contestedBy)) {
    return clearContention(state);
  }
  return state;
}
