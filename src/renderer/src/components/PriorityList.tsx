// One drag-to-reorder priority list (channel strips with rank numerals).
// Reordering works by drag AND by big up/down buttons (keyboard friendly).

import { useState } from "react";
import { moveItem } from "../reorder.js";
import { displayDetail, displayName } from "../useAppState.js";
import { AvailabilityBadge } from "./StatusBadge.js";
import { DeviceGlyph } from "./DeviceGlyph.js";
import type { DeviceView } from "../../../../shared/ipc.js";

export interface PriorityListProps {
  label: string;
  ids: string[];
  devicesById: Map<string, DeviceView>;
  onReorder: (ids: string[]) => void;
  onRemove: (id: string) => void;
}

export function PriorityList({ label, ids, devicesById, onReorder, onRemove }: PriorityListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const drop = (target: number): void => {
    if (dragIndex !== null && dragIndex !== target) {
      onReorder(moveItem(ids, dragIndex, target));
    }
    setDragIndex(null);
    setOverIndex(null);
  };

  if (ids.length === 0) {
    return <p className="empty-note">No devices yet. They appear here once detected.</p>;
  }

  return (
    <ol className="strip-list" aria-label={label}>
      {ids.map((id, index) => {
        const device = devicesById.get(id);
        const classes = [
          "strip",
          device?.isDefault ? "is-default" : "",
          dragIndex === index ? "is-dragging" : "",
          overIndex === index && dragIndex !== null && dragIndex !== index
            ? "is-drop-target"
            : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <li
            key={id}
            className={classes}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              setDragIndex(index);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setOverIndex(index);
            }}
            onDragLeave={() => setOverIndex((v) => (v === index ? null : v))}
            onDrop={(e) => {
              e.preventDefault();
              drop(index);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setOverIndex(null);
            }}
          >
            <span className="rank" aria-hidden="true">
              {index + 1}
            </span>
            <DeviceGlyph formFactor={device?.formFactor ?? null} />
            <div className="strip-body">
              <div className="device-name">
                {device !== undefined ? displayName(device) : "Not connected"}
              </div>
              {device !== undefined && displayDetail(device) !== null ? (
                <div className="device-sub">{displayDetail(device)}</div>
              ) : null}
            </div>
            <div className="strip-tags">
              {device !== undefined ? (
                <AvailabilityBadge device={device} />
              ) : (
                <span className="badge badge-offline">Offline</span>
              )}
            </div>
            <div className="move-controls">
              <button
                type="button"
                className="btn btn-icon"
                aria-label={`Move ${device !== undefined ? device.name : "device"} up`}
                disabled={index === 0}
                onClick={() => onReorder(moveItem(ids, index, index - 1))}
              >
                &#9650;
              </button>
              <button
                type="button"
                className="btn btn-icon"
                aria-label={`Move ${device !== undefined ? device.name : "device"} down`}
                disabled={index === ids.length - 1}
                onClick={() => onReorder(moveItem(ids, index, index + 1))}
              >
                &#9660;
              </button>
              <button
                type="button"
                className="btn btn-icon btn-remove"
                aria-label={`Remove ${device !== undefined ? device.name : "device"} from list`}
                title="Remove from list"
                onClick={() => onRemove(id)}
              >
                &#10005;
              </button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

