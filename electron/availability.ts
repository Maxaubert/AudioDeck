// Merge Windows endpoint states with headset power into per-device availability.
// Stage 2 stub: interfaces are final, implementation lands with the daemon core.

import type { Endpoint } from "./audioctl.js";
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
  void endpoints;
  void headsets;
  throw new Error("availability.evaluateAvailability: Stage 2 stub, implemented with the daemon core");
}
