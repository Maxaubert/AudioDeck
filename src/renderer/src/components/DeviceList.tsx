// One section's rows, and the drag bookkeeping that reorders them. Only ranked
// rows drag: a drop onto an unranked row would have to mean "rank it here",
// and ranking has exactly one way in, the + button. Reordering therefore only
// ever permutes the ranked prefix.

import { useRef, useState } from "react";
import { moveItem } from "../reorder.js";
import { DeviceRow } from "./DeviceRow.js";
import type { AudioDeckApi, DeviceView } from "../../../../shared/ipc.js";

export interface DeviceListProps {
  label: string;
  /** Ranked devices in priority order, then any revealed unranked ones. */
  ranked: DeviceView[];
  unranked: DeviceView[];
  manualOverride: boolean;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  onReorder: (ids: string[]) => void;
  onRank: (id: string) => void;
  onUnrank: (id: string) => void;
  actions: AudioDeckApi;
  /** Rendered between the ranked rows and the unranked ones. */
  divider?: React.ReactNode;
}

export function DeviceList({
  label,
  ranked,
  unranked,
  manualOverride,
  expandedId,
  onToggleExpand,
  onReorder,
  onRank,
  onUnrank,
  actions,
  divider,
}: DeviceListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  // A completed drag suppresses the click some browsers fire after the drop,
  // so dragging to reorder never doubles as "switch to this device".
  const dragHappened = useRef(false);

  const rankedIds = ranked.map((d) => d.id);

  const move = (from: number, to: number): void => {
    if (from === to || to < 0 || to >= ranked.length) return;
    onReorder(moveItem(rankedIds, from, to));
  };

  const drop = (target: number): void => {
    if (dragIndex !== null) move(dragIndex, target);
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <ol className="strip-list" aria-label={label}>
      {ranked.map((device, index) => (
        <DeviceRow
          key={device.id}
          device={device}
          rank={index + 1}
          manualOverride={manualOverride}
          expanded={expandedId === device.id}
          onToggleExpand={() => onToggleExpand(device.id)}
          onUnrank={() => onUnrank(device.id)}
          onMove={(delta) => move(index, index + delta)}
          actions={actions}
          drag={{
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
              // Cleared next tick so the post-drop click (if any) is ignored.
              setTimeout(() => {
                dragHappened.current = false;
              }, 0);
            },
          }}
        />
      ))}
      {unranked.length > 0 ? (
        <>
          {divider}
          {unranked.map((device) => (
            <DeviceRow
              key={device.id}
              device={device}
              rank={null}
              manualOverride={manualOverride}
              expanded={expandedId === device.id}
              onToggleExpand={() => onToggleExpand(device.id)}
              onRank={() => onRank(device.id)}
              actions={actions}
            />
          ))}
        </>
      ) : null}
    </ol>
  );
}
