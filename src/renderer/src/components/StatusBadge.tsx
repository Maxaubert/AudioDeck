// Inline state chip, shown next to the device name like the mockup: the
// device that is in use, whether that was automatic or a manual pick, and
// anything that is not available.

import type { DeviceView } from "../../../../shared/ipc.js";

export function StateBadge({
  device,
  manualOverride,
}: {
  device: DeviceView;
  manualOverride: boolean;
}) {
  if (device.isDefault) {
    return (
      <span className="badge">{manualOverride ? "Manual override" : "In use"}</span>
    );
  }
  if (device.available) return null;
  if (device.availabilityReason === "headset-off") {
    return <span className="badge badge-headset-off">Headset off</span>;
  }
  return <span className="badge badge-offline">Offline</span>;
}
