// Mixer view: a fader and mute per active device, outputs then microphones.

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { displayDetail, displayName } from "../useAppState.js";
import { DefaultBadge } from "../components/StatusBadge.js";
import type { AppState, AudioDeckApi, DeviceView } from "../../../../shared/ipc.js";

function MixerStrip({ device, actions }: { device: DeviceView; actions: AudioDeckApi }) {
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
  const name = displayName(device);
  return (
    <li className="strip mixer-strip is-plain">
      <div className="mixer-head">
        <div className="device-name">{name}</div>
        {displayDetail(device) !== null ? (
          <div className="device-sub">{displayDetail(device)}</div>
        ) : null}
        <DefaultBadge device={device} />
        <span className={muted ? "volume-value is-muted" : "volume-value"}>{local}%</span>
      </div>
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
    </li>
  );
}

export function MixerView({ state, actions }: { state: AppState; actions: AudioDeckApi }) {
  const active = state.devices.filter((d) => d.state === "active");
  const outputs = active.filter((d) => d.flow === "render");
  const mics = active.filter((d) => d.flow === "capture");
  return (
    <section className="view" aria-labelledby="mixer-title">
      <h2 className="view-title" id="mixer-title">
        Mixer
      </h2>
      <p className="view-hint">Volume and mute for every active device, in one place.</p>
      <h3 className="section-label">Outputs</h3>
      {outputs.length === 0 ? (
        <p className="empty-note">No active outputs.</p>
      ) : (
        <ul className="strip-list">
          {outputs.map((d) => (
            <MixerStrip key={d.id} device={d} actions={actions} />
          ))}
        </ul>
      )}
      <h3 className="section-label">Microphones</h3>
      {mics.length === 0 ? (
        <p className="empty-note">No active microphones.</p>
      ) : (
        <ul className="strip-list">
          {mics.map((d) => (
            <MixerStrip key={d.id} device={d} actions={actions} />
          ))}
        </ul>
      )}
    </section>
  );
}
