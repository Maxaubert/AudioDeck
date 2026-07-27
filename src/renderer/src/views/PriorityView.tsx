// Priority view: two reorderable lists (outputs, mics). Rank 1 wins when
// available; badges show live availability, amber marks the current default.

import { PriorityList } from "../components/PriorityList.js";
import type { AppState, AudioDeckApi } from "../../../../shared/ipc.js";

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
      />
      <h3 className="section-label">Microphones</h3>
      <PriorityList
        label="Microphone priority"
        ids={state.micPriority}
        devicesById={devicesById}
        onReorder={(ids) => void actions.setPriority("capture", ids)}
      />
    </section>
  );
}
