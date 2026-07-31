// Mixer view: one row per ranked device, matching the Priority order. Each row
// is a single line: rank, glyph, name, segmented meter, percentage, mute. The
// meter is 20 blocks with an invisible range input laid over it, so dragging
// works exactly like a slider while the visuals stay in the print language.

import { useEffect, useRef, useState } from "react";
import { displayDetail, displayName } from "../useAppState.js";
import { StateBadge } from "../components/StatusBadge.js";
import { DeviceGlyph } from "../components/DeviceGlyph.js";
import { SectionLabel } from "../components/SectionLabel.js";
import { VolumeLock } from "../components/VolumeLock.js";
import type { AppState, AudioDeckApi, DeviceView } from "../../../../shared/ipc.js";

const SEGMENTS = 20;

/** Locked meters are hatched, not solid: a reading, not something to drag. */
function Meter({ value, locked = false }: { value: number; locked?: boolean }) {
  const lit = Math.round((value / 100) * SEGMENTS);
  return (
    <div className={locked ? "segs is-locked" : "segs"} aria-hidden="true">
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <span key={i} className={i < lit ? "f" : undefined} />
      ))}
    </div>
  );
}

function MixerStrip({
  device,
  rank,
  manualOverride,
  actions,
}: {
  device: DeviceView;
  rank: number;
  manualOverride: boolean;
  actions: AudioDeckApi;
}) {
  const [local, setLocal] = useState(device.volume ?? 0);
  const inputRef = useRef<HTMLInputElement>(null);
  // Volume the user asked for that has not reached the daemon yet.
  const pending = useRef<number | null>(null);
  const commit = useRef<(v: number) => void>(() => {});
  commit.current = (v: number) => void actions.setVolume(device.id, v);

  // Follow daemon updates unless the user is on the fader right now.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setLocal(device.volume ?? 0);
    }
  }, [device.volume]);

  // Debounced commit while dragging.
  useEffect(() => {
    if (local === (device.volume ?? 0)) {
      pending.current = null;
      return;
    }
    pending.current = local;
    const timer = setTimeout(() => {
      pending.current = null;
      commit.current(local);
    }, 200);
    return () => clearTimeout(timer);
  }, [local, device.volume]);

  // Leaving the page (or the row disappearing) must not swallow the change the
  // user just made: flush anything still inside the debounce window.
  useEffect(
    () => () => {
      if (pending.current !== null) commit.current(pending.current);
    },
    [],
  );

  const muted = device.mute === true;
  const offline = device.state !== "active";
  // The row doubles as a switch, like the Priority list. Clicks on the fader
  // or the mute button are controls, not a request to change device.
  const clickable = device.available && !device.isDefault;
  const isControl = (target: EventTarget | null): boolean =>
    (target as HTMLElement | null)?.closest("button, input, .vol") !== null;
  const switchToThis = (): void => void actions.setDefault(device.id);
  const classes = [
    "strip",
    "mixer-strip",
    offline ? "is-offline" : "",
    device.isDefault ? "is-default" : "",
    device.isDefault && manualOverride ? "is-manual" : "",
    clickable ? "is-clickable" : "",
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
      <span className="rank">{rank}</span>
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
      {device.volumeLocked && !offline ? (
        <>
          <div className="vol">
            <Meter value={local} locked />
          </div>
          <span className="volume-value">{local}%</span>
          <VolumeLock hardware={displayDetail(device) ?? displayName(device)} />
        </>
      ) : offline ? (
        <>
          <div className="na">Unavailable</div>
          <span className="volume-value">--</span>
          <button type="button" className="btn mute" disabled>
            Mute
          </button>
        </>
      ) : (
        <>
          <div className="vol">
            <Meter value={local} />
            <input
              ref={inputRef}
              type="range"
              min={0}
              max={100}
              step={1}
              value={local}
              aria-label={`${device.name} volume`}
              onChange={(e) => setLocal(Number(e.target.value))}
            />
          </div>
          <span className={muted ? "volume-value is-muted" : "volume-value"}>{local}%</span>
          <button
            type="button"
            className={muted ? "btn mute is-on" : "btn mute"}
            aria-pressed={muted}
            onClick={() => void actions.setMute(device.id, !muted)}
          >
            {muted ? "Muted" : "Mute"}
          </button>
        </>
      )}
    </li>
  );
}

function rankedDevices(state: AppState, priority: string[]): DeviceView[] {
  const byId = new Map(state.devices.map((d) => [d.id, d]));
  return priority.map((id) => byId.get(id)).filter((d): d is DeviceView => d !== undefined);
}

export function MixerView({ state, actions }: { state: AppState; actions: AudioDeckApi }) {
  const outputs = rankedDevices(state, state.outputPriority);
  const mics = rankedDevices(state, state.micPriority);
  return (
    <section className="view" aria-labelledby="mixer-title">
      <h2 className="view-title" id="mixer-title">
        Mixer
      </h2>
      <SectionLabel title="Outputs" note={`${outputs.length} ranked`} />
      {outputs.length === 0 ? (
        <p className="empty-note">No ranked outputs yet.</p>
      ) : (
        <ul className="strip-list">
          {outputs.map((d, i) => (
            <MixerStrip
              key={d.id}
              device={d}
              rank={i + 1}
              manualOverride={state.override.output}
              actions={actions}
            />
          ))}
        </ul>
      )}
      <SectionLabel title="Microphones" note={`${mics.length} ranked`} />
      {mics.length === 0 ? (
        <p className="empty-note">No ranked microphones yet.</p>
      ) : (
        <ul className="strip-list">
          {mics.map((d, i) => (
            <MixerStrip
              key={d.id}
              device={d}
              rank={i + 1}
              manualOverride={state.override.mic}
              actions={actions}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
