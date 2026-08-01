// App shell: brand, folder tabs, active view. Settings is a tab pinned right,
// not a footer strip.

import { useState } from "react";
import { useAppState } from "./useAppState.js";
import { DeviceManagerView } from "./views/DeviceManagerView.js";
import { StudioView } from "./views/StudioView.js";
import { SettingsView } from "./views/SettingsView.js";
import { WindowCaption } from "./components/WindowCaption.js";
import { splitDeviceName } from "../../../shared/deviceName.js";
import { FirstRunGuide } from "./components/FirstRunGuide.js";

type ViewName = "devices" | "studio" | "settings";

const TABS: { name: ViewName; label: string }[] = [
  { name: "devices", label: "Devices" },
  { name: "studio", label: "Studio" },
  { name: "settings", label: "Settings" },
];

export default function App() {
  const [view, setView] = useState<ViewName>("devices");
  const { state, error, actions } = useAppState();
  // Held locally as well as in config so replaying the guide from Settings is
  // instant, rather than waiting for the next state poll to come back.
  const [guideOpen, setGuideOpen] = useState<boolean | null>(null);
  const showGuide = guideOpen ?? (state !== null && !state.guideSeen);

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
      {(state?.contested ?? []).map((c) => (
        <div className="contested-banner" key={`${c.flow}:${c.deviceId}`} role="status">
          {/* The title alone, not the composed name: "LG TV" is what people
              call it, and the interface part makes the sentence unreadable. */}
          <b>{splitDeviceName(c.deviceName).title}</b> keeps taking your{" "}
          {c.flow === "capture" ? "microphone" : "sound"} back, so AudioDeck has stopped
          switching it. Rank it first if you want it, or remove it from the list.
        </div>
      ))}
      {state === null ? (
        <div className="loading">Reading your audio devices&hellip;</div>
      ) : view === "devices" ? (
        <DeviceManagerView state={state} actions={actions} />
      ) : view === "studio" ? (
        <StudioView state={state} actions={actions} />
      ) : (
        <SettingsView state={state} actions={actions} onReplayGuide={() => setGuideOpen(true)} />
      )}
      {showGuide ? (
        <FirstRunGuide
          onDismiss={() => {
            setGuideOpen(false);
            void actions.setGuideSeen(true);
          }}
        />
      ) : null}
    </div>
  );
}
