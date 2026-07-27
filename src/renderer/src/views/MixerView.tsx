// Mixer view: a fader and mute per ranked device, mirroring the Priority
// lists exactly - same devices, same order, same glyphs. Ranked devices that
// are offline show a quiet row without a fader; devices outside the priority
// list do not appear here at all.

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { displayDetail, displayName } from "../useAppState.js";
import { AvailabilityBadge } from "../components/StatusBadge.js";
import { DeviceGlyph } from "../components/DeviceGlyph.js";
import type { AppState, AudioDeckApi, DeviceView } from "../../../../shared/ipc.js";

function MixerStrip({
  device,
  manualOverride,
  actions,
}: {
  device: DeviceView;
  manualOverride: boolean;
  actions: AudioDeckApi;
}) {
  const [local, setLocal] = useState(device.volume ?? 0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Follow daemon updates unless the user is on the fader right now.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setLocal(device.volume ?? 0);
    }
  }, [device.volume]);

  // Debounced commit while dragging.
  useEffect(() => {
    if (local === (device.volume ?? 0)) return;
    const timer = setTimeout(() => void actions.setVolume(device.id, local), 200);
    return () => clearTimeout(timer);
  }, [local, device.id, device.volume, actions]);

  const muted = device.mute === true;
  const offline = device.state !== "active";
  const name = displayName(device);
  const classes = [
    "strip",
    "mixer-strip",
    "is-plain",
    offline ? "is-offline" : "",
    // The amber outline is the one "audio goes here right now" indicator;
    // blue means it was pointed here by hand and priority is on hold.
    device.isDefault ? "is-default" : "",
    device.isDefault && manualOverride ? "is-manual" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <li
      className={classes}
      title={
        device.isDefault && manualOverride
          ? "Manually switched; the priority list resumes on the next device event"
          : undefined
      }
    >
      <div className="mixer-head">
        <DeviceGlyph formFactor={device.formFactor} />
        <div className="strip-body">
          <div className="device-name">{name}</div>
          {displayDetail(device) !== null ? (
            <div className="device-sub">{displayDetail(device)}</div>
          ) : null}
        </div>
        {offline ? (
          <AvailabilityBadge device={device} />
        ) : (
          <span className={muted ? "volume-value is-muted" : "volume-value"}>{local}%</span>
        )}
      </div>
      {offline ? null : (
        <div className="volume-row">
          <input
            ref={inputRef}
            type="range"
            className="fader"
            min={0}
            max={100}
            step={1}
            value={local}
            style={{ "--fill": `${local}%` } as CSSProperties}
            aria-label={`${device.name} volume`}
            onChange={(e) => setLocal(Number(e.target.value))}
          />
          <button
            type="button"
            className={muted ? "btn btn-danger" : "btn"}
            aria-pressed={muted}
            onClick={() => void actions.setMute(device.id, !muted)}
          >
            {muted ? "Unmute" : "Mute"}
          </button>
        </div>
      )}
    </li>
  );
}

function rankedDevices(state: AppState, priority: string[]): DeviceView[] {
  const byId = new Map(state.devices.map((d) => [d.id, d]));
  return priority
    .map((id) => byId.get(id))
    .filter((d): d is DeviceView => d !== undefined);
}

export function MixerView({ state, actions }: { state: AppState; actions: AudioDeckApi }) {
  const outputs = rankedDevices(state, state.outputPriority);
  const mics = rankedDevices(state, state.micPriority);
  return (
    <section className="view" aria-labelledby="mixer-title">
      <h2 className="view-title" id="mixer-title">
        Mixer
      </h2>
      <p className="view-hint">
        Volume and mute for the devices in your priority lists, in priority order.
      </p>
      <h3 className="section-label">Outputs</h3>
      {outputs.length === 0 ? (
        <p className="empty-note">No ranked outputs yet.</p>
      ) : (
        <ul className="strip-list">
          {outputs.map((d) => (
            <MixerStrip
              key={d.id}
              device={d}
              manualOverride={state.override.output}
              actions={actions}
            />
          ))}
        </ul>
      )}
      <h3 className="section-label">Microphones</h3>
      {mics.length === 0 ? (
        <p className="empty-note">No ranked microphones yet.</p>
      ) : (
        <ul className="strip-list">
          {mics.map((d) => (
            <MixerStrip
              key={d.id}
              device={d}
              manualOverride={state.override.mic}
              actions={actions}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
