// App shell: brand, view tabs, active view, settings strip.

import { useState } from "react";
import { useAppState } from "./useAppState.js";
import { PriorityView } from "./views/PriorityView.js";
import { MixerView } from "./views/MixerView.js";
import { DevicesView } from "./views/DevicesView.js";
import { SettingsStrip } from "./components/SettingsStrip.js";

type ViewName = "priority" | "mixer" | "devices";

const TABS: { name: ViewName; label: string }[] = [
  { name: "priority", label: "Priority" },
  { name: "mixer", label: "Mixer" },
  { name: "devices", label: "Devices" },
];

export default function App() {
  const [view, setView] = useState<ViewName>("priority");
  const { state, error, actions } = useAppState();

  return (
    <div className="shell" data-loaded={state !== null}>
      <header className="topbar">
        <h1 className="brand">
          Audio<span className="brand-deck">Deck</span>
        </h1>
        <nav className="tabs" aria-label="Views">
          {TABS.map((tab) => (
            <button
              key={tab.name}
              type="button"
              className="tab"
              aria-current={view === tab.name}
              onClick={() => setView(tab.name)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>
      {error !== null ? <div className="error-banner">{error}</div> : null}
      {state?.paused === true ? (
        <div className="paused-banner">Automation is paused. Devices will not switch.</div>
      ) : null}
      {state === null ? (
        <div className="loading">Reading your audio devices&hellip;</div>
      ) : view === "priority" ? (
        <PriorityView state={state} actions={actions} />
      ) : view === "mixer" ? (
        <MixerView state={state} actions={actions} />
      ) : (
        <DevicesView state={state} actions={actions} />
      )}
      {state !== null ? <SettingsStrip state={state} actions={actions} /> : null}
    </div>
  );
}
