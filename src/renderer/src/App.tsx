// App shell: brand, folder tabs, active view. Settings is a tab pinned right,
// not a footer strip.

import { useState } from "react";
import { useAppState } from "./useAppState.js";
import { DeviceManagerView } from "./views/DeviceManagerView.js";
import { SettingsView } from "./views/SettingsView.js";
import { WindowCaption } from "./components/WindowCaption.js";

type ViewName = "devices" | "settings";

const TABS: { name: ViewName; label: string }[] = [
  { name: "devices", label: "Devices" },
  { name: "settings", label: "Settings" },
];

export default function App() {
  const [view, setView] = useState<ViewName>("devices");
  const { state, error, actions } = useAppState();

  return (
    <div className="shell" data-loaded={state !== null}>
      <WindowCaption />
      <header className="topbar">
        <h1 className="brand">
          <span className="brand-mark" aria-hidden="true">
            <i />
          </span>
          <span className="brand-word">
            <span className="stencil">Audio</span>
            <span className="brand-deck">Deck</span>
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
      ) : view === "devices" ? (
        <DeviceManagerView state={state} actions={actions} />
      ) : (
        <SettingsView state={state} actions={actions} />
      )}
    </div>
  );
}
