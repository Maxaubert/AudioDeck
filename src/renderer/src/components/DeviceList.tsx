// One list of device rows. Given `onReorder` it is the ranked list: rows are
// numbered and drag to reorder. Without it, it is the list of devices outside
// the ranking: no numbers, no dragging, and a + on each row instead, so there
// is exactly one way into the order.

import { useRef, useState } from "react";
import { moveItem } from "../reorder.js";
import { DeviceRow } from "./DeviceRow.js";
import type { AudioDeckApi, DeviceView } from "../../../../shared/ipc.js";

export interface DeviceListProps {
  label: string;
  devices: DeviceView[];
  manualOverride: boolean;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  /** Present only for the ranked list. */
  onReorder?: (ids: string[]) => void;
  onUnrank?: (id: string) => void;
  /** Present only for the unranked list. */
  onRank?: (id: string) => void;
  actions: AudioDeckApi;
}

export function DeviceList({
  label,
  devices,
  manualOverride,
  expandedId,
  onToggleExpand,
  onReorder,
  onUnrank,
  onRank,
  actions,
}: DeviceListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  // A completed drag suppresses the click some browsers fire after the drop,
  // so dragging to reorder never doubles as "switch to this device".
  const dragHappened = useRef(false);

  const ranked = onReorder !== undefined;

  const move = (from: number, to: number): void => {
    if (onReorder === undefined || from === to || to < 0 || to >= devices.length) return;
    onReorder(moveItem(devices.map((d) => d.id), from, to));
  };

  const drop = (target: number): void => {
    if (dragIndex !== null) move(dragIndex, target);
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <ol className="strip-list" aria-label={label}>
      {devices.map((device, index) => (
        <DeviceRow
          key={device.id}
          device={device}
          rank={ranked ? index + 1 : null}
          manualOverride={manualOverride}
          expanded={expandedId === device.id}
          onToggleExpand={() => onToggleExpand(device.id)}
          onRank={onRank === undefined ? undefined : () => onRank(device.id)}
          onUnrank={onUnrank === undefined ? undefined : () => onUnrank(device.id)}
          onMove={ranked ? (delta) => move(index, index + delta) : undefined}
          actions={actions}
          drag={
            ranked
              ? {
                  dragging: dragIndex === index,
                  dropTarget: overIndex === index && dragIndex !== null && dragIndex !== index,
                  suppressedClick: dragHappened,
                  onDragStart: () => {
                    dragHappened.current = true;
                    setDragIndex(index);
                  },
                  onDragOver: () => setOverIndex(index),
                  onDragLeave: () => setOverIndex((v) => (v === index ? null : v)),
                  onDrop: () => drop(index),
                  onDragEnd: () => {
                    setDragIndex(null);
                    setOverIndex(null);
                    // Cleared next tick so the post-drop click is ignored.
                    setTimeout(() => {
                      dragHappened.current = false;
                    }, 0);
                  },
                }
              : undefined
          }
        />
      ))}
    </ol>
  );
}
