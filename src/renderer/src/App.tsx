// App shell: brand, folder tabs, active view. Settings is a tab pinned right,
// not a footer strip.

import { useState } from "react";
import { useAppState } from "./useAppState.js";
import { PriorityView } from "./views/PriorityView.js";
import { MixerView } from "./views/MixerView.js";
import { DevicesView } from "./views/DevicesView.js";
import { SettingsView } from "./views/SettingsView.js";

type ViewName = "priority" | "mixer" | "devices" | "settings";

const TABS: { name: ViewName; label: string }[] = [
  { name: "priority", label: "Priority" },
  { name: "mixer", label: "Mixer" },
  { name: "devices", label: "Devices" },
  { name: "settings", label: "Settings" },
];

export default function App() {
  const [view, setView] = useState<ViewName>("priority");
  const { state, error, actions } = useAppState();

  return (
    <div className="shell" data-loaded={state !== null}>
      <header className="topbar">
        <h1 className="brand">
          <span className="brand-mark" aria-hidden="true">
            <i />
          </span>
          <span className="brand-word">
            Audio<span>Deck</span>
          </span>
        </h1>
        <nav className="tabs" aria-label="Views">
          {TABS.map((tab) => (
            <button
              key={tab.name}
              type="button"
              className={tab.name === "settings" ? "tab tab-settings" : "tab"}
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
      ) : view === "devices" ? (
        <DevicesView state={state} actions={actions} />
      ) : (
        <SettingsView state={state} actions={actions} />
      )}
    </div>
  );
}
