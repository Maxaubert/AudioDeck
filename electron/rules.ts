// PURE rules engine: priority selection, override hold, event diffing, seeding.
// No I/O in this file, ever; it is the unit-tested core.
// Stage 2 stub: interfaces are final, implementations land with the daemon core.

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
 * enumeration order. Also appends devices unseen by an existing list.
 */
export function seedPriorityList(existing: string[], endpoints: Endpoint[], flow: EndpointFlow): string[] {
  void existing;
  void endpoints;
  void flow;
  throw new Error("rules.seedPriorityList: Stage 2 stub, implemented with the daemon core");
}

/** Highest-priority available device, or null when none in the list is available. */
export function pickWinner(priority: string[], availability: DeviceAvailability[]): string | null {
  void priority;
  void availability;
  throw new Error("rules.pickWinner: Stage 2 stub, implemented with the daemon core");
}

/** Diff two availability snapshots into the events that release override holds. */
export function diffEvents(
  previous: DeviceAvailability[],
  current: DeviceAvailability[],
): AvailabilityEvent[] {
  void previous;
  void current;
  throw new Error("rules.diffEvents: Stage 2 stub, implemented with the daemon core");
}

/**
 * One poll tick's verdict: honors an override hold until an availability event,
 * detects external manual default changes, otherwise applies the priority list.
 */
export function decide(
  priority: string[],
  availability: DeviceAvailability[],
  events: AvailabilityEvent[],
  currentDefaultId: string | null,
  overrideActive: boolean,
): Decision {
  void priority;
  void availability;
  void events;
  void currentDefaultId;
  void overrideActive;
  throw new Error("rules.decide: Stage 2 stub, implemented with the daemon core");
}
