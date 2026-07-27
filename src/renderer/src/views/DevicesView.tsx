// Devices view: manage endpoints. Rename changes the name in Windows itself
// (picker, Settings, all apps); Enable/Disable is the state control, so no
// extra state badges clutter the rows. Ghost endpoints Windows merely
// remembers (state notpresent) hide behind a toggle.

import { useState } from "react";
import {
  deviceTypeByKey,
  offeredTypesForFlow,
  typeKeyForFormFactor,
} from "../../../../shared/deviceTypes.js";
import { displayDetail, displayName, splitDeviceName } from "../useAppState.js";
import { DefaultBadge } from "../components/StatusBadge.js";
import { DeviceGlyph } from "../components/DeviceGlyph.js";
import type { AppState, AudioDeckApi, DeviceView } from "../../../../shared/ipc.js";

function DeviceRow({ device, actions }: { device: DeviceView; actions: AudioDeckApi }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [suffixDraft, setSuffixDraft] = useState("");

  const startEdit = (): void => {
    // Prefill with the current parts so an unchanged save is obvious.
    const parts = splitDeviceName(device.name);
    setDraft(parts.title);
    setSuffixDraft(parts.detail ?? "");
    setEditing(true);
  };
  const save = (): void => {
    const trimmed = draft.trim();
    const suffix = suffixDraft.trim();
    if (trimmed !== "") {
      // Renaming is global by design; the main process also drops any local
      // alias so the app shows exactly what Windows shows. An empty suffix
      // keeps the current one (Windows cannot render without it).
      void actions.renameDevice(device.id, trimmed, suffix === "" ? undefined : suffix);
    }
    setEditing(false);
  };

  const name = displayName(device);
  const currentType = typeKeyForFormFactor(device.formFactor, device.flow);
  return (
    <li className={device.isDefault ? "strip is-default" : "strip"}>
      <DeviceGlyph formFactor={device.formFactor} />
      <div className="strip-body">
        <div className="device-name">{name}</div>
        {displayDetail(device) !== null ? (
          <div className="device-sub">{displayDetail(device)}</div>
        ) : null}
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
            <input
              className="rename-input rename-suffix"
              value={suffixDraft}
              placeholder="Text in parentheses"
              aria-label={`New parenthesized text for ${device.name}`}
              onChange={(e) => setSuffixDraft(e.target.value)}
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
        <select
          className="type-select"
          aria-label={`Device type for ${device.name}`}
          value={currentType ?? "custom"}
          onChange={(e) => void actions.setDeviceType(device.id, e.target.value)}
        >
          {currentType === null ? (
            <option value="custom" disabled>
              Custom
            </option>
          ) : deviceTypeByKey(currentType)?.offered === false ? (
            // The device already carries a type we do not offer (TV, digital,
            // line in); show it truthfully without promoting it to a choice.
            <option value={currentType} disabled>
              {deviceTypeByKey(currentType)?.label}
            </option>
          ) : null}
          {offeredTypesForFlow(device.flow).map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
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
        Renaming a device changes its name in Windows itself, including the text in
        parentheses (Windows insists on the parentheses, but both texts are yours). The type
        dropdown changes the device icon system-wide; note the modern Windows picker only
        draws two of them, headphones for Headphones/Headset and a speaker for everything
        else, while the full set shows here and in the classic control panel. Devices
        Windows only remembers from the past sit behind the toggle below each list.
      </p>
      <DeviceSection title="Outputs" devices={outputs} actions={actions} />
      <DeviceSection title="Microphones" devices={mics} actions={actions} />
    </section>
  );
}
