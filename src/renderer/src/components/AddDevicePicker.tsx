// Picker for ranking a device that is not in the priority list (removed
// earlier, or a known-but-disconnected endpoint like Bluetooth earbuds).
// Collapsed to a single button so ghost endpoints never crowd the ranking.

import { useState } from "react";
import { displayDetail, displayName } from "../useAppState.js";
import type { DeviceView } from "../../../../shared/ipc.js";

export interface AddDevicePickerProps {
  label: string;
  candidates: DeviceView[];
  onAdd: (id: string) => void;
}

export function AddDevicePicker({ label, candidates, onAdd }: AddDevicePickerProps) {
  const [open, setOpen] = useState(false);

  if (candidates.length === 0) return null;

  if (!open) {
    return (
      <button type="button" className="btn btn-add-device" onClick={() => setOpen(true)}>
        + Add a device ({candidates.length} more)
      </button>
    );
  }

  return (
    <div className="add-device" role="group" aria-label={label}>
      <div className="add-device-head">
        <span className="section-label">{label}</span>
        <button type="button" className="btn btn-icon" aria-label="Close" onClick={() => setOpen(false)}>
          &#10005;
        </button>
      </div>
      <ul className="add-device-list">
        {candidates.map((device) => (
          <li key={device.id}>
            <button
              type="button"
              className="btn btn-add-row"
              onClick={() => {
                onAdd(device.id);
                setOpen(false);
              }}
            >
              <span className="device-name">{displayName(device)}</span>
              <span className="device-sub">
                {device.state === "active" ? "connected" : "disconnected"}
                {displayDetail(device) !== null ? ` · ${displayDetail(device)}` : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
