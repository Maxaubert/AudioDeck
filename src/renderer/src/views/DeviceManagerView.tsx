// Devices view: every endpoint of a flow in one list, carrying every control
// that device has. Ranked devices lead in priority order so the page reads the
// same way as the Priority tab; the rest follow under a break. Endpoints
// Windows merely remembers hide behind a toggle.

import { useState } from "react";
import { partitionDevices } from "../deviceOrder.js";
import { DeviceRow } from "../components/DeviceRow.js";
import { SectionLabel } from "../components/SectionLabel.js";
import type { EndpointFlow } from "../../../../electron/audioctl.js";
import type { AppState, AudioDeckApi, DeviceView } from "../../../../shared/ipc.js";

function DeviceSection({
  title,
  flow,
  devices,
  priority,
  manualOverride,
  expandedId,
  onToggleExpand,
  actions,
}: {
  title: string;
  flow: EndpointFlow;
  devices: DeviceView[];
  priority: string[];
  manualOverride: boolean;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  actions: AudioDeckApi;
}) {
  const [showGhosts, setShowGhosts] = useState(false);
  const { ranked, unranked, ghosts } = partitionDevices(devices, priority, flow);
  const shownGhosts = showGhosts ? ghosts : [];

  const row = (device: DeviceView, rank: number | null) => (
    <DeviceRow
      key={device.id}
      device={device}
      rank={rank}
      manualOverride={manualOverride}
      expanded={expandedId === device.id}
      onToggleExpand={() => onToggleExpand(device.id)}
      actions={actions}
    />
  );

  return (
    <>
      <SectionLabel title={title} note={`${ranked.length + unranked.length} shown`} />
      {ranked.length + unranked.length === 0 ? (
        <p className="empty-note">No {title.toLowerCase()} found.</p>
      ) : null}
      {ranked.length > 0 ? (
        <ul className="strip-list">{ranked.map((d, i) => row(d, i + 1))}</ul>
      ) : null}
      {unranked.length > 0 || shownGhosts.length > 0 ? (
        <>
          {ranked.length > 0 ? <p className="section-break">Not in priority</p> : null}
          <ul className="strip-list">
            {[...unranked, ...shownGhosts].map((d) => row(d, null))}
          </ul>
        </>
      ) : null}
      {ghosts.length > 0 ? (
        <button
          type="button"
          className="btn btn-add-device"
          onClick={() => setShowGhosts((v) => !v)}
        >
          {showGhosts ? "Hide remembered devices" : `Show remembered devices (${ghosts.length})`}
        </button>
      ) : null}
    </>
  );
}

export function DeviceManagerView({
  state,
  actions,
}: {
  state: AppState;
  actions: AudioDeckApi;
}) {
  // One panel at a time, so the list never becomes a wall of open drawers.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toggle = (id: string): void => setExpandedId((current) => (current === id ? null : id));

  return (
    <section className="view" aria-labelledby="devices-title">
      <h2 className="view-title" id="devices-title">
        Devices
      </h2>
      <p className="view-hint">
        Click a device to send audio there. Renaming applies to Windows itself.
      </p>
      <DeviceSection
        title="Outputs"
        flow="render"
        devices={state.devices}
        priority={state.outputPriority}
        manualOverride={state.override.output}
        expandedId={expandedId}
        onToggleExpand={toggle}
        actions={actions}
      />
      <DeviceSection
        title="Microphones"
        flow="capture"
        devices={state.devices}
        priority={state.micPriority}
        manualOverride={state.override.mic}
        expandedId={expandedId}
        onToggleExpand={toggle}
        actions={actions}
      />
    </section>
  );
}
