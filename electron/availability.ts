// Merge Windows endpoint states with headset power into per-device availability.

import type { Endpoint } from "./audioctl.js";
import { headsetPowerState, matchesEndpoint } from "./headsetcontrol.js";
import type { HeadsetSnapshot } from "./headsetcontrol.js";

/** How a device's availability was decided, for logging and the UI badges. */
export type AvailabilityReason =
  | "endpoint-active"
  | "endpoint-inactive"
  | "headset-on"
  | "headset-off"
  | "headset-unknown-fail-open";

export interface DeviceAvailability {
  endpoint: Endpoint;
  available: boolean;
  reason: AvailabilityReason;
}

/**
 * Availability per design: normal devices are available when their endpoint is
 * ACTIVE; dongle headsets additionally require the headset to be powered on,
 * failing open to plain endpoint state when HeadsetControl cannot answer.
 */
export function evaluateAvailability(
  endpoints: Endpoint[],
  headsets: HeadsetSnapshot | null,
  memory: HeadsetPowerMemory | null = null,
  now: number = Date.now(),
): DeviceAvailability[] {
  return endpoints.map((endpoint) => {
    if (endpoint.state !== "active") {
      return { endpoint, available: false, reason: "endpoint-inactive" as const };
    }

    const headset = headsets?.devices.find((d) => matchesEndpoint(d, endpoint));
    const answered = headset === undefined ? null : headsetPowerState(headset);
    if (answered !== null) memory?.remember(endpoint.id, answered, now);

    // No usable answer this time: a headset that answered a moment ago is
    // still the same headset. Assuming "on" here is what switched the default
    // to a headset that was off while its dongle was being replugged.
    const power = answered ?? memory?.recall(endpoint.id, now) ?? null;
    if (power === true) {
      return { endpoint, available: true, reason: "headset-on" as const };
    }
    if (power === false) {
      return { endpoint, available: false, reason: "headset-off" as const };
    }
    if (headset === undefined) {
      return { endpoint, available: true, reason: "endpoint-active" as const };
    }
    // Power unknown (HID error, no battery capability) and nothing recent to
    // go on: fail open, never switch away wrongly.
    return { endpoint, available: true, reason: "headset-unknown-fail-open" as const };
  });
}

/**
 * How long a headset's last answer stands in for a missing one. Long enough to
 * cover the dongle re-enumerating after a replug (a few seconds), short enough
 * that a HeadsetControl that has stopped working falls back to plain endpoint
 * state soon.
 */
export const HEADSET_MEMORY_MS = 30_000;

/** Last power state each headset endpoint reported, and when. */
export class HeadsetPowerMemory {
  private readonly last = new Map<string, { power: boolean; at: number }>();

  constructor(private readonly ttlMs: number = HEADSET_MEMORY_MS) {}

  remember(endpointId: string, power: boolean, now: number): void {
    this.last.set(endpointId, { power, at: now });
  }

  /** The remembered state while still fresh, else null. */
  recall(endpointId: string, now: number): boolean | null {
    const entry = this.last.get(endpointId);
    if (entry === undefined) return null;
    if (now - entry.at > this.ttlMs) {
      this.last.delete(endpointId);
      return null;
    }
    return entry.power;
  }
}
