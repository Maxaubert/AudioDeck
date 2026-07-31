// One device, one line: rank, glyph, name, volume, level, primary action, and
// the expander that opens its management panel. Clicking the row body switches
// audio here, as the Priority list does; the fader, the buttons and the panel
// are controls, not a request to change device.

import { useId } from "react";
import type { MutableRefObject } from "react";
import { deviceTypeByKey, typeKeyForFormFactor } from "../../../../shared/deviceTypes.js";
import { displayDetail, displayName } from "../useAppState.js";
import { usePendingEdits } from "../usePendingEdits.js";
import { DeviceGlyph } from "./DeviceGlyph.js";
import { StateBadge } from "./StatusBadge.js";
import { VolumeFader } from "./VolumeFader.js";
import { VolumeLock } from "./VolumeLock.js";
import { DeviceControls } from "./DeviceControls.js";
import type { AudioDeckApi, DeviceView } from "../../../../shared/ipc.js";

function ExpandMark() {
  // Three hard squares rather than a chevron: the panel is a drawer of
  // controls, not a section that continues below.
  return (
    <svg width="22" height="6" viewBox="0 0 22 6" fill="currentColor" aria-hidden="true">
      <rect x="0" y="0" width="6" height="6" />
      <rect x="8" y="0" width="6" height="6" />
      <rect x="16" y="0" width="6" height="6" />
    </svg>
  );
}

/** Everything a ranked row needs to take part in drag-to-reorder. */
export interface RowDrag {
  dragging: boolean;
  dropTarget: boolean;
  /** True for one tick after a drop, so the trailing click is not a switch. */
  suppressedClick: MutableRefObject<boolean>;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

export function DeviceRow({
  device,
  rank,
  manualOverride,
  expanded,
  onToggleExpand,
  onRank,
  onUnrank,
  onMove,
  drag,
  actions,
}: {
  device: DeviceView;
  /** Position in the priority list, or null when the device is not ranked. */
  rank: number | null;
  manualOverride: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  /** Put an unranked device into the list. Absent on ranked rows. */
  onRank?: () => void;
  /** Take a ranked device out of the list. Absent on unranked rows. */
  onUnrank?: () => void;
  /** Move a ranked row by ±1. Absent on unranked rows. */
  onMove?: (delta: number) => void;
  /** Absent on unranked rows, which do not drag. */
  drag?: RowDrag;
  actions: AudioDeckApi;
}) {
  const panelId = useId();
  const liveType = typeKeyForFormFactor(device.formFactor, device.flow);
  const pending = usePendingEdits({
    name: displayName(device),
    detail: displayDetail(device),
    type: liveType,
  });

  const name = pending.name ?? displayName(device);
  const detail = pending.detail ?? displayDetail(device);
  const formFactor =
    pending.type !== null
      ? deviceTypeByKey(pending.type)?.formFactor ?? device.formFactor
      : device.formFactor;

  const offline = device.state !== "active";
  const locked = device.volumeLocked && !offline;
  const muted = device.mute === true;
  // Switching to a device that is not there does nothing; switching to the one
  // already in use is a no-op too.
  const clickable = device.available && !device.isDefault;
  const isControl = (target: EventTarget | null): boolean =>
    (target as HTMLElement | null)?.closest("button, input, select, .vol, .device-panel") !== null;
  const switchToThis = (): void => void actions.setDefault(device.id);

  const classes = [
    "strip",
    "device-strip",
    offline ? "is-offline" : "",
    device.isDefault ? "is-default" : "",
    device.isDefault && manualOverride ? "is-manual" : "",
    clickable ? "is-clickable" : "",
    expanded ? "is-expanded" : "",
    drag !== undefined ? "is-draggable" : "",
    drag?.dragging === true ? "is-dragging" : "",
    drag?.dropTarget === true ? "is-drop-target" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const hint =
    drag !== undefined
      ? "Drag to reorder, or Alt with the arrow keys. Click to switch audio here now."
      : clickable
        ? "Click to switch audio here now"
        : undefined;

  return (
    <li
      className={classes}
      title={hint}
      tabIndex={clickable || drag !== undefined ? 0 : undefined}
      draggable={drag !== undefined}
      onDragStart={drag?.onDragStart}
      onDragOver={
        drag === undefined
          ? undefined
          : (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              drag.onDragOver();
            }
      }
      onDragLeave={drag?.onDragLeave}
      onDrop={
        drag === undefined
          ? undefined
          : (e) => {
              e.preventDefault();
              drag.onDrop();
            }
      }
      onDragEnd={drag?.onDragEnd}
      onClick={(e) => {
        if (!clickable || isControl(e.target)) return;
        if (drag?.suppressedClick.current === true) return;
        switchToThis();
      }}
      onKeyDown={(e) => {
        if (isControl(e.target)) return;
        // Alt distinguishes reordering from the plain Enter/Space switch.
        if (e.altKey && onMove !== undefined) {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            onMove(e.key === "ArrowUp" ? -1 : 1);
            return;
          }
        }
        if (!clickable) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          switchToThis();
        }
      }}
    >
      {/* Empty on unranked rows: the column is the position in the order, and
          they have none. It stays so every row's columns line up. */}
      <span className={rank === null ? "rank is-unranked" : "rank"}>{rank ?? ""}</span>
      <DeviceGlyph formFactor={formFactor} />
      <div className="strip-body">
        <div className="device-name">
          {/* Truncates rather than wraps: a row that grows to three lines
              breaks the rhythm of the whole list, and the full name is on the
              sub line and in the title attribute anyway. */}
          <span className="device-title" title={name}>
            {name}
          </span>
          <StateBadge device={device} manualOverride={manualOverride} />
          {/* A live region that is present before it has anything to say, so a
              rename landing while the panel is closed is still announced. */}
          <span className="saving-slot" aria-live="polite">
            {pending.saving ? <span className="badge badge-saving">Saving&hellip;</span> : null}
          </span>
        </div>
        {detail !== null ? <div className="device-sub">{detail}</div> : null}
      </div>

      {locked ? (
        // No meter and no percentage: Windows reports its own level for these
        // endpoints (usually a flat 100%) while the real one lives on the
        // hardware, so any number here would be a guess presented as fact.
        <>
          <div className="na">Volume set on the device</div>
          <span className="volume-value">--</span>
        </>
      ) : offline ? (
        <>
          <div className="na">Unavailable</div>
          <span className="volume-value">--</span>
        </>
      ) : (
        <VolumeFader device={device} actions={actions} />
      )}

      <div className="row-action">
        {locked ? (
          <VolumeLock hardware={displayDetail(device) ?? displayName(device)} />
        ) : device.state === "disabled" ? (
          // The only thing a disabled endpoint can do, and the slot is empty
          // anyway. Disable stays in the panel: it is the destructive one.
          <button
            type="button"
            className="btn btn-accent"
            onClick={() => void actions.setEndpointEnabled(device.id, true)}
          >
            Enable
          </button>
        ) : offline ? null : (
          <button
            type="button"
            className={muted ? "btn mute is-on" : "btn mute"}
            aria-pressed={muted}
            onClick={() => void actions.setMute(device.id, !muted)}
          >
            {muted ? "Muted" : "Mute"}
          </button>
        )}
      </div>

      {onRank !== undefined ? (
        // A device outside the order has one thing to offer: joining it. The
        // settings panel belongs to devices you actually use, so the slot
        // carries the + instead of the expander.
        <button
          type="button"
          className="btn-expand btn-rank"
          aria-label={`Add ${name} to priority`}
          title="Add to the priority list"
          onClick={onRank}
        >
          +
        </button>
      ) : (
        <button
          type="button"
          className={expanded ? "btn-expand is-open" : "btn-expand"}
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-label={`Settings for ${name}`}
          onClick={onToggleExpand}
        >
          <ExpandMark />
        </button>
      )}

      {expanded ? (
        <div className="device-panel" id={panelId} aria-label={`${name} settings`} role="group">
          <DeviceControls
            device={device}
            pending={pending}
            onUnrank={onUnrank}
            actions={actions}
          />
        </div>
      ) : null}
    </li>
  );
}
