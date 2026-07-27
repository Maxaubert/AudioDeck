// Lamp-style status chips: availability, default marker, endpoint state.

import type { DeviceView } from "../../../../shared/ipc.js";

export function AvailabilityBadge({ device }: { device: DeviceView }) {
  if (device.available) {
    return <span className="badge badge-available">Available</span>;
  }
  if (device.availabilityReason === "headset-off") {
    return <span className="badge badge-headset-off">Headset off</span>;
  }
  return <span className="badge badge-offline">Offline</span>;
}

export function DefaultBadge({ device }: { device: DeviceView }) {
  if (!device.isDefault) return null;
  return <span className="badge badge-default">Default</span>;
}

export function StateBadge({ state }: { state: DeviceView["state"] }) {
  const label =
    state === "active"
      ? "Active"
      : state === "disabled"
        ? "Disabled"
        : state === "unplugged"
          ? "Unplugged"
          : "Not present";
  const className = state === "disabled" ? "badge badge-disabled" : "badge badge-state";
  return <span className={className}>{label}</span>;
}
