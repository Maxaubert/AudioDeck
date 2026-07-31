// One drag-to-reorder priority list (channel strips with rank numerals).
// Reordering works by drag AND by big up/down buttons (keyboard friendly).

import { useRef, useState } from "react";
import { moveItem } from "../reorder.js";
import { displayDetail, displayName } from "../useAppState.js";
import { StateBadge } from "./StatusBadge.js";
import { DeviceGlyph } from "./DeviceGlyph.js";
import type { DeviceView } from "../../../../shared/ipc.js";

export interface PriorityListProps {
  label: string;
  ids: string[];
  devicesById: Map<string, DeviceView>;
  /** True while a manual override holds this flow's default. */
  manualOverride: boolean;
  onReorder: (ids: string[]) => void;
  onRemove: (id: string) => void;
  /** Switch audio to this device now (manual override until the next event). */
  onUseNow: (id: string) => void;
}

export function PriorityList({
  label,
  ids,
  devicesById,
  manualOverride,
  onReorder,
  onRemove,
  onUseNow,
}: PriorityListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  // A completed drag suppresses the click that some browsers fire after drop,
  // so dragging to reorder never doubles as "use this device".
  const dragHappened = useRef(false);

  const drop = (target: number): void => {
    if (dragIndex !== null && dragIndex !== target) {
      onReorder(moveItem(ids, dragIndex, target));
    }
    setDragIndex(null);
    setOverIndex(null);
  };

  // A ranked id Windows no longer reports at all gets no row: it has no name
  // to print and nothing to act on. The entry stays in the config, because the
  // daemon only prunes after a long absence and a brief enumeration hiccup
  // must not cost a real rank; it is simply not drawn while it cannot resolve.
  // Virtual devices (VR streaming, per-session endpoints) mint a fresh id per
  // session and delete the old one, so this is routine, not exceptional.
  const rows = ids
    .map((id, index) => ({ id, index, device: devicesById.get(id) }))
    .filter((row): row is { id: string; index: number; device: DeviceView } =>
      row.device !== undefined,
    );

  if (rows.length === 0) {
    return <p className="empty-note">No devices yet. They appear here once detected.</p>;
  }

  return (
    <ol className="strip-list" aria-label={label}>
      {rows.map(({ id, index, device }, position) => {
        const isManual = device.isDefault && manualOverride;
        const clickable = device.available && !device.isDefault;
        const classes = [
          "strip",
          device.isDefault ? "is-default" : "",
          isManual ? "is-manual" : "",
          !device.available ? "is-offline" : "",
          clickable ? "is-clickable" : "",
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
            title={
              isManual
                ? "Manually switched; the priority list resumes on the next device event"
                : clickable
                  ? "Click to switch audio here now; drag to reorder"
                  : undefined
            }
            tabIndex={clickable ? 0 : undefined}
            onClick={(e) => {
              if (!clickable || dragHappened.current) return;
              // Clicks on the row's own controls are not device switches.
              if ((e.target as HTMLElement).closest("button") !== null) return;
              onUseNow(id);
            }}
            onKeyDown={(e) => {
              if (!clickable) return;
              if (e.key === "Enter" || e.key === " ") {
                if ((e.target as HTMLElement).closest("button") !== null) return;
                e.preventDefault();
                onUseNow(id);
              }
            }}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              dragHappened.current = true;
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
              // Cleared next tick so the post-drop click (if any) is ignored.
              setTimeout(() => {
                dragHappened.current = false;
              }, 0);
            }}
          >
            <span className="rank" aria-hidden="true">
              {position + 1}
            </span>
            <DeviceGlyph formFactor={device.formFactor} />
            <div className="strip-body">
              <div className="device-name">
                {displayName(device)}
                <StateBadge device={device} manualOverride={manualOverride} />
              </div>
              {displayDetail(device) !== null ? (
                <div className="device-sub">{displayDetail(device)}</div>
              ) : null}
            </div>
            <div className="move-controls">
              {/* Targets the neighbouring VISIBLE row's slot, so a hidden
                  unresolved entry in between never swallows a press. */}
              <button
                type="button"
                className="btn btn-icon"
                aria-label={`Move ${device.name} up`}
                disabled={position === 0}
                onClick={() => {
                  const target = rows[position - 1];
                  if (target !== undefined) onReorder(moveItem(ids, index, target.index));
                }}
              >
                &#9650;
              </button>
              <button
                type="button"
                className="btn btn-icon"
                aria-label={`Move ${device.name} down`}
                disabled={position === rows.length - 1}
                onClick={() => {
                  const target = rows[position + 1];
                  if (target !== undefined) onReorder(moveItem(ids, index, target.index));
                }}
              >
                &#9660;
              </button>
              <button
                type="button"
                className="btn btn-icon btn-remove"
                aria-label={`Remove ${device.name} from list`}
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

