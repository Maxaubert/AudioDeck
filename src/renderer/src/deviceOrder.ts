// How the Devices view orders one flow's devices. Ranked devices come first in
// priority order so the page reads the same way as the Priority tab, then
// everything else Windows reports, then the endpoints it merely remembers.
// Pure, no React, no I/O.

import type { DeviceView } from "../../../shared/ipc.js";
import type { EndpointFlow } from "../../../electron/audioctl.js";

export interface DevicePartition {
  /** In priority order. Ids Windows no longer reports are skipped. */
  ranked: DeviceView[];
  /** Everything else that is a real endpoint, in enumeration order. */
  unranked: DeviceView[];
  /** state === "notpresent": remembered, not connected. Hidden by default. */
  ghosts: DeviceView[];
}

export function partitionDevices(
  devices: readonly DeviceView[],
  priority: readonly string[],
  flow: EndpointFlow,
): DevicePartition {
  const mine = devices.filter((d) => d.flow === flow);
  const byId = new Map(mine.map((d) => [d.id, d]));

  // A ghost that is still in the priority list stays a ghost: the point of the
  // toggle is that endpoints Windows only remembers do not clutter the list.
  const ranked = priority
    .map((id) => byId.get(id))
    .filter((d): d is DeviceView => d !== undefined && d.state !== "notpresent");

  const rankedIds = new Set(ranked.map((d) => d.id));
  const rest = mine.filter((d) => !rankedIds.has(d.id));

  return {
    ranked,
    unranked: rest.filter((d) => d.state !== "notpresent"),
    ghosts: rest.filter((d) => d.state === "notpresent"),
  };
}
