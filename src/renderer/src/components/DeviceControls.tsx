// The panel a device row opens: the controls you reach for rarely. Renaming
// changes the name in Windows itself (picker, Settings, all apps), the type
// dropdown sets the icon Windows shows, and Disable removes the endpoint from
// every app until it is enabled again.

import { useState } from "react";
import {
  deviceTypeByKey,
  offeredTypesForFlow,
  typeKeyForFormFactor,
} from "../../../../shared/deviceTypes.js";
import { displayDetail, splitDeviceName } from "../useAppState.js";
import type { AudioDeckApi, DeviceView } from "../../../../shared/ipc.js";
import type { PendingEdits } from "../usePendingEdits.js";

export function DeviceControls({
  device,
  pending,
  actions,
}: {
  device: DeviceView;
  pending: PendingEdits;
  actions: AudioDeckApi;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [suffixDraft, setSuffixDraft] = useState("");

  const currentTitle = splitDeviceName(device.name).title;
  const currentDetail = displayDetail(device);
  const currentType = pending.type ?? typeKeyForFormFactor(device.formFactor, device.flow);

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
      if (trimmed !== currentTitle) pending.mark({ name: trimmed });
      if (suffix !== "" && suffix !== currentDetail) pending.mark({ detail: suffix });
      void actions.renameDevice(device.id, trimmed, suffix === "" ? undefined : suffix);
    }
    setEditing(false);
  };

  return (
    <div className="device-controls">
      <select
        className="type-select"
        aria-label={`Device type for ${device.name}`}
        value={currentType ?? "custom"}
        onChange={(e) => {
          pending.mark({ type: e.target.value });
          void actions.setDeviceType(device.id, e.target.value);
        }}
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

      {device.state === "active" ? (
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => void actions.setEndpointEnabled(device.id, false)}
        >
          Disable
        </button>
      ) : device.state === "disabled" ? (
        // Also offered on the collapsed row, where it is that row's only
        // action; here for symmetry with Disable.
        <button
          type="button"
          className="btn btn-accent"
          onClick={() => void actions.setEndpointEnabled(device.id, true)}
        >
          Enable
        </button>
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
  );
}
