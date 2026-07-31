// One device, one line: rank, glyph, name, volume, level, primary action, and
// the expander that opens its management panel. Clicking the row body switches
// audio here, as the Priority list does; the fader, the buttons and the panel
// are controls, not a request to change device.

import { useId } from "react";
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

export function DeviceRow({
  device,
  rank,
  manualOverride,
  expanded,
  onToggleExpand,
  actions,
}: {
  device: DeviceView;
  /** Position in the priority list, or null when the device is not ranked. */
  rank: number | null;
  manualOverride: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
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
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li
      className={classes}
      title={clickable ? "Click to switch audio here now" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={(e) => {
        if (!clickable || isControl(e.target)) return;
        switchToThis();
      }}
      onKeyDown={(e) => {
        if (!clickable || isControl(e.target)) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          switchToThis();
        }
      }}
    >
      <span className={rank === null ? "rank is-unranked" : "rank"}>{rank ?? ""}</span>
      <DeviceGlyph formFactor={formFactor} />
      <div className="strip-body">
        <div className="device-name">
          {name}
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

      {expanded ? (
        <div className="device-panel" id={panelId} aria-label={`${name} settings`} role="group">
          <DeviceControls device={device} pending={pending} actions={actions} />
        </div>
      ) : null}
    </li>
  );
}
