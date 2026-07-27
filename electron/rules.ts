// PURE rules engine: priority selection, override hold, event diffing, seeding.
// No I/O in this file, ever; it is the unit-tested core.

import type { DeviceAvailability } from "./availability.js";
import type { Endpoint, EndpointFlow } from "./audioctl.js";

/** An availability transition between two polls, keyed by endpoint id. */
export interface AvailabilityEvent {
  endpointId: string;
  flow: EndpointFlow;
  becameAvailable: boolean;
}

export interface Decision {
  /** Endpoint to make default, or null to leave things alone. */
  setDefaultTo: string | null;
  /** True when a manual override hold should now engage. */
  engageOverride: boolean;
  /** True when an availability event releases an existing override hold. */
  releaseOverride: boolean;
}

/**
 * First-run seeding: current Windows default first, remaining devices in
 * enumeration order. For an existing list, keeps the user's order untouched
 * (absent devices keep their slot) and appends unseen devices at the bottom
 * in enumeration order.
 */
export function seedPriorityList(
  existing: string[],
  endpoints: Endpoint[],
  flow: EndpointFlow,
  excluded: string[] = [],
): string[] {
  // Only ACTIVE endpoints enter the list automatically: Windows remembers
  // every endpoint it has ever seen (ghost HDMI ports, stale duplicates), and
  // seeding those buries the real devices. Ranked entries keep their slot even
  // while inactive; excluded ids never come back on their own.
  const skip = new Set(excluded);
  const flowEndpoints = endpoints.filter(
    (e) => e.flow === flow && e.state === "active" && !skip.has(e.id),
  );

  if (existing.length === 0) {
    const defaultId = flowEndpoints.find((e) => e.isDefault)?.id ?? null;
    const rest = flowEndpoints.filter((e) => e.id !== defaultId).map((e) => e.id);
    return defaultId === null ? rest : [defaultId, ...rest];
  }

  const known = new Set(existing);
  const appended = flowEndpoints.filter((e) => !known.has(e.id)).map((e) => e.id);
  return appended.length === 0 ? existing : [...existing, ...appended];
}

/** Highest-priority available device, or null when none in the list is available. */
export function pickWinner(priority: string[], availability: DeviceAvailability[]): string | null {
  const availableIds = new Set(
    availability.filter((a) => a.available).map((a) => a.endpoint.id),
  );
  for (const id of priority) {
    if (availableIds.has(id)) return id;
  }
  return null;
}

/**
 * Diff two availability snapshots into the events that release override holds.
 * A device appearing in an available state, or vanishing while available,
 * counts as an availability change; appearing or vanishing while unavailable
 * changes nothing and yields no event.
 */
export function diffEvents(
  previous: DeviceAvailability[],
  current: DeviceAvailability[],
): AvailabilityEvent[] {
  const events: AvailabilityEvent[] = [];
  const prevById = new Map(previous.map((a) => [a.endpoint.id, a]));
  const currentIds = new Set(current.map((a) => a.endpoint.id));

  for (const now of current) {
    const before = prevById.get(now.endpoint.id);
    if (before === undefined) {
      // New device: only its arrival as available is an availability change.
      if (now.available) {
        events.push({ endpointId: now.endpoint.id, flow: now.endpoint.flow, becameAvailable: true });
      }
    } else if (before.available !== now.available) {
      events.push({
        endpointId: now.endpoint.id,
        flow: now.endpoint.flow,
        becameAvailable: now.available,
      });
    }
  }

  for (const before of previous) {
    if (!currentIds.has(before.endpoint.id) && before.available) {
      // Vanished entirely while available: it just became unavailable.
      events.push({
        endpointId: before.endpoint.id,
        flow: before.endpoint.flow,
        becameAvailable: false,
      });
    }
  }

  return events;
}

/**
 * One poll tick's verdict for a single flow:
 * - Any availability event releases an override hold and re-applies the list.
 * - An active override with no event holds: do nothing.
 * - With no override and no event, a default that deviates from the winner is
 *   an external manual change when that default is itself available AND it
 *   moved since the last observed tick (engage the hold); a deviation that did
 *   not move (for example our own set-default failed last tick) is re-applied,
 *   never mistaken for a user choice. A default sitting on an unavailable
 *   device is repaired by applying the winner (never leave audio stranded).
 *
 * `defaultMoved` is whether the current default differs from the one observed
 * on the previous tick; pass true when there is no previous observation.
 */
export function decide(
  priority: string[],
  availability: DeviceAvailability[],
  events: AvailabilityEvent[],
  currentDefaultId: string | null,
  overrideActive: boolean,
  defaultMoved: boolean = true,
): Decision {
  const winner = pickWinner(priority, availability);

  if (events.length > 0) {
    return {
      setDefaultTo: winner !== null && winner !== currentDefaultId ? winner : null,
      engageOverride: false,
      releaseOverride: overrideActive,
    };
  }

  if (overrideActive) {
    // A hold only means something while the default deviates from the list.
    // Landing back on the winner (the user switched back by hand, or ranked
    // the current device to the top) dissolves the override immediately.
    const releaseOverride = winner !== null && winner === currentDefaultId;
    return { setDefaultTo: null, engageOverride: false, releaseOverride };
  }

  if (winner === null || winner === currentDefaultId) {
    return { setDefaultTo: null, engageOverride: false, releaseOverride: false };
  }

  const currentIsAvailable = availability.some(
    (a) => a.endpoint.id === currentDefaultId && a.available,
  );
  if (currentIsAvailable && defaultMoved) {
    return { setDefaultTo: null, engageOverride: true, releaseOverride: false };
  }

  return { setDefaultTo: winner, engageOverride: false, releaseOverride: false };
}
