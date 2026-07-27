// Merge Windows endpoint states with headset power into per-device availability.

import type { Endpoint } from "./audioctl.js";
import { headsetPowerState, matchesEndpointName } from "./headsetcontrol.js";
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
): DeviceAvailability[] {
  return endpoints.map((endpoint) => {
    if (endpoint.state !== "active") {
      return { endpoint, available: false, reason: "endpoint-inactive" as const };
    }

    const headset = headsets?.devices.find((d) => matchesEndpointName(d, endpoint.name));
    if (headset === undefined) {
      return { endpoint, available: true, reason: "endpoint-active" as const };
    }

    const power = headsetPowerState(headset);
    if (power === true) {
      return { endpoint, available: true, reason: "headset-on" as const };
    }
    if (power === false) {
      return { endpoint, available: false, reason: "headset-off" as const };
    }
    // Power unknown (HID error, no battery capability): fail open, never
    // switch away wrongly.
    return { endpoint, available: true, reason: "headset-unknown-fail-open" as const };
  });
}
