// Devices view: every endpoint including disabled ones. Enable/disable,
// make default, and rename (a local alias stored in AudioDeck's config).

import { useState } from "react";
import { displayName } from "../useAppState.js";
import { DefaultBadge, StateBadge } from "../components/StatusBadge.js";
import type { AppState, AudioDeckApi, DeviceView } from "../../../../shared/ipc.js";

function DeviceRow({ device, actions }: { device: DeviceView; actions: AudioDeckApi }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEdit = (): void => {
    setDraft(device.alias ?? "");
    setEditing(true);
  };
  const save = (): void => {
    void actions.setAlias(device.id, draft.trim() === "" ? null : draft.trim());
    setEditing(false);
  };

  const name = displayName(device);
  return (
    <li className={device.isDefault ? "strip is-default" : "strip"}>
      <div className="strip-body">
        <div className="device-name">{name}</div>
        {device.alias !== null ? <div className="device-sub">{device.name}</div> : null}
        {editing ? (
          <form
            className="rename-form"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <input
              className="rename-input"
              value={draft}
              autoFocus
              placeholder="New name (empty restores the Windows name)"
              aria-label={`New name for ${device.name}`}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit" className="btn btn-accent">
              Save name
            </button>
            <button type="button" className="btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </form>
        ) : null}
      </div>
      <div className="strip-tags">
        <DefaultBadge device={device} />
        <StateBadge state={device.state} />
      </div>
      <div className="move-controls">
        {!editing ? (
          <button type="button" className="btn" onClick={startEdit}>
            Rename
          </button>
        ) : null}
        {device.state === "active" && !device.isDefault ? (
          <button
            type="button"
            className="btn"
            onClick={() => void actions.setDefault(device.id)}
          >
            Make default
          </button>
        ) : null}
        {device.state === "active" ? (
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => void actions.setEndpointEnabled(device.id, false)}
          >
            Disable
          </button>
        ) : device.state === "disabled" ? (
          <button
            type="button"
            className="btn btn-accent"
            onClick={() => void actions.setEndpointEnabled(device.id, true)}
          >
            Enable
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function DevicesView({ state, actions }: { state: AppState; actions: AudioDeckApi }) {
  const outputs = state.devices.filter((d) => d.flow === "render");
  const mics = state.devices.filter((d) => d.flow === "capture");
  return (
    <section className="view" aria-labelledby="devices-title">
      <h2 className="view-title" id="devices-title">
        Devices
      </h2>
      <p className="view-hint">
        Every endpoint Windows knows about, including disabled ones. Renames only change how
        AudioDeck shows the device.
      </p>
      <h3 className="section-label">Outputs</h3>
      <ul className="strip-list">
        {outputs.map((d) => (
          <DeviceRow key={d.id} device={d} actions={actions} />
        ))}
      </ul>
      <h3 className="section-label">Microphones</h3>
      <ul className="strip-list">
        {mics.map((d) => (
          <DeviceRow key={d.id} device={d} actions={actions} />
        ))}
      </ul>
    </section>
  );
}
