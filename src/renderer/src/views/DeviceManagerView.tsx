// The whole app in one page: outputs and microphones, each in priority order,
// each row carrying every control that device has. Rank 1 wins when available.
// Devices outside the ranking stay hidden until asked for, because the list you
// look at every day is the short one.

import { useState } from "react";
import { partitionDevices } from "../deviceOrder.js";
import { DeviceList } from "../components/DeviceList.js";
import { SectionLabel } from "../components/SectionLabel.js";
import type { EndpointFlow } from "../../../../electron/audioctl.js";
import type { AppState, AudioDeckApi, DeviceView } from "../../../../shared/ipc.js";

function DeviceSection({
  title,
  label,
  flow,
  devices,
  priority,
  manualOverride,
  expandedId,
  onToggleExpand,
  actions,
}: {
  title: string;
  label: string;
  flow: EndpointFlow;
  devices: DeviceView[];
  priority: string[];
  manualOverride: boolean;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  actions: AudioDeckApi;
}) {
  const [revealed, setRevealed] = useState(false);
  const [showGhosts, setShowGhosts] = useState(false);
  const { ranked, unranked, ghosts } = partitionDevices(devices, priority, flow);

  const shown = revealed ? [...unranked, ...(showGhosts ? ghosts : [])] : [];
  const noun = flow === "capture" ? "microphone" : "output";

  return (
    <>
      <SectionLabel title={title} note={`${ranked.length} ranked`} />
      {ranked.length === 0 && !revealed ? (
        <p className="empty-note">Nothing ranked yet. Add a device below.</p>
      ) : (
        <DeviceList
          label={label}
          ranked={ranked}
          unranked={shown}
          manualOverride={manualOverride}
          expandedId={expandedId}
          onToggleExpand={onToggleExpand}
          onReorder={(ids) => void actions.setPriority(flow, ids)}
          onRank={(id) => void actions.addToPriority(flow, id)}
          onUnrank={(id) => void actions.removeFromPriority(flow, id)}
          actions={actions}
          divider={
            <li className="section-break" role="presentation">
              Not in priority
            </li>
          }
        />
      )}

      {unranked.length > 0 || revealed ? (
        <button
          type="button"
          className="btn btn-add-device"
          aria-expanded={revealed}
          onClick={() => setRevealed((v) => !v)}
        >
          {revealed ? "Fewer devices" : `+ More ${noun}s (${unranked.length})`}
        </button>
      ) : null}

      {revealed && ghosts.length > 0 ? (
        <button
          type="button"
          className="btn btn-ghost-toggle"
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
        Rank 1 wins whenever it is available. Drag to reorder, click a row to switch now.
      </p>
      <DeviceSection
        title="Outputs"
        label="Output priority"
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
        label="Microphone priority"
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
