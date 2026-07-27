// Devices view: manage endpoints. Rename changes the name in Windows itself
// (picker, Settings, all apps); Enable/Disable is the state control, so no
// extra state badges clutter the rows. Ghost endpoints Windows merely
// remembers (state notpresent) hide behind a toggle.

import { useState } from "react";
import { displayName } from "../useAppState.js";
import { DefaultBadge } from "../components/StatusBadge.js";
import type { AppState, AudioDeckApi, DeviceView } from "../../../../shared/ipc.js";

function DeviceRow({ device, actions }: { device: DeviceView; actions: AudioDeckApi }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEdit = (): void => {
    setDraft("");
    setEditing(true);
  };
  const save = (): void => {
    const trimmed = draft.trim();
    if (trimmed !== "") {
      // Renaming is global by design: Windows keeps the "(interface)" part
      // and shows the new name everywhere. Any old local alias is dropped so
      // the app shows exactly what Windows shows.
      void actions.renameDevice(device.id, trimmed);
      void actions.setAlias(device.id, null);
    }
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
              placeholder="New name, shown everywhere in Windows"
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

function DeviceSection({
  title,
  devices,
  actions,
}: {
  title: string;
  devices: DeviceView[];
  actions: AudioDeckApi;
}) {
  const [showGhosts, setShowGhosts] = useState(false);
  const real = devices.filter((d) => d.state !== "notpresent");
  const ghosts = devices.filter((d) => d.state === "notpresent");
  const shown = showGhosts ? [...real, ...ghosts] : real;
  return (
    <>
      <h3 className="section-label">{title}</h3>
      <ul className="strip-list">
        {shown.map((d) => (
          <DeviceRow key={d.id} device={d} actions={actions} />
        ))}
      </ul>
      {ghosts.length > 0 ? (
        <button
          type="button"
          className="btn btn-add-device"
          onClick={() => setShowGhosts((v) => !v)}
        >
          {showGhosts
            ? "Hide remembered devices"
            : `Show remembered devices (${ghosts.length})`}
        </button>
      ) : null}
    </>
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
        Renaming a device changes its name in Windows itself. Devices Windows only remembers
        from the past are tucked behind the toggle below each list.
      </p>
      <DeviceSection title="Outputs" devices={outputs} actions={actions} />
      <DeviceSection title="Microphones" devices={mics} actions={actions} />
    </section>
  );
}
