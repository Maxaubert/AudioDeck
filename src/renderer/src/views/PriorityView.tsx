// Priority view: two reorderable lists (outputs, mics). Rank 1 wins when
// available; badges show live availability, amber marks the current default.
// Only ranked devices show as strips; everything else Windows remembers sits
// behind the collapsed Add-a-device picker.

import { AddDevicePicker } from "../components/AddDevicePicker.js";
import { PriorityList } from "../components/PriorityList.js";
import type { AppState, AudioDeckApi } from "../../../../shared/ipc.js";
import type { DeviceView } from "../../../../shared/ipc.js";

function candidatesFor(state: AppState, flow: DeviceView["flow"], ranked: string[]): DeviceView[] {
  const rankedSet = new Set(ranked);
  return state.devices
    .filter(
      (d) =>
        d.flow === flow &&
        !rankedSet.has(d.id) &&
        // Same split as the Windows sound panel: connected and disconnected
        // devices are real; "not present" endpoints are ghosts Windows
        // remembers forever (old HDMI ports, uninstalled drivers) and
        // disabled ones are managed in the Devices view.
        (d.state === "active" || d.state === "unplugged"),
    )
    .sort((a, b) => {
      if ((a.state === "active") !== (b.state === "active")) {
        return a.state === "active" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
}

export function PriorityView({ state, actions }: { state: AppState; actions: AudioDeckApi }) {
  const devicesById = new Map(state.devices.map((d) => [d.id, d]));
  return (
    <section className="view" aria-labelledby="priority-title">
      <h2 className="view-title" id="priority-title">
        Priority
      </h2>
      <p className="view-hint">
        Drag or use the arrows to reorder. The highest device that is available becomes the
        Windows default automatically.
      </p>
      <h3 className="section-label">Outputs</h3>
      <PriorityList
        label="Output priority"
        ids={state.outputPriority}
        devicesById={devicesById}
        onReorder={(ids) => void actions.setPriority("render", ids)}
        onRemove={(id) => void actions.removeFromPriority("render", id)}
      />
      <AddDevicePicker
        label="Add an output device"
        candidates={candidatesFor(state, "render", state.outputPriority)}
        onAdd={(id) => void actions.addToPriority("render", id)}
      />
      <h3 className="section-label">Microphones</h3>
      <PriorityList
        label="Microphone priority"
        ids={state.micPriority}
        devicesById={devicesById}
        onReorder={(ids) => void actions.setPriority("capture", ids)}
        onRemove={(id) => void actions.removeFromPriority("capture", id)}
      />
      <AddDevicePicker
        label="Add a microphone"
        candidates={candidatesFor(state, "capture", state.micPriority)}
        onAdd={(id) => void actions.addToPriority("capture", id)}
      />
    </section>
  );
}
