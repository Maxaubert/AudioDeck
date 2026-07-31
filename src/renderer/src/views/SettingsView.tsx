// Settings page. Only controls that actually change behaviour appear here:
// autostart, the automation pause, and the poll interval. Anything AudioDeck
// does unconditionally (re-applying names after a driver reset, pruning
// deleted endpoints) is stated as behaviour, not offered as a fake switch.

import type { AppState, AudioDeckApi } from "../../../../shared/ipc.js";

const POLL_CHOICES = [
  { ms: 1000, label: "1 second" },
  { ms: 2000, label: "2 seconds" },
  { ms: 5000, label: "5 seconds" },
  { ms: 10000, label: "10 seconds" },
];

function SectionLabel({ title, note }: { title: string; note: string }) {
  return (
    <h3 className="section-label">
      <span>{title}</span>
      <span className="rule" />
      {note}
    </h3>
  );
}

function Switch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <span className="swwrap">
      <span className="state">{checked ? "On" : "Off"}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className="switch"
        onClick={() => onChange(!checked)}
      />
    </span>
  );
}

export function SettingsView({ state, actions }: { state: AppState; actions: AudioDeckApi }) {
  const pollValue = POLL_CHOICES.some((c) => c.ms === state.pollIntervalMs)
    ? state.pollIntervalMs
    : 2000;

  return (
    <section className="view" aria-labelledby="settings-title">
      <h2 className="view-title" id="settings-title">
        Settings
      </h2>

      <SectionLabel title="Automation" note={state.paused ? "Paused" : "Running"} />
      <div className="setlist">
        <div className="setrow">
          <div className="setlabel">
            <b>Pause automation</b>
            <span>Hold the current devices and stop switching</span>
          </div>
          <Switch
            checked={state.paused}
            label="Pause automation"
            onChange={(next) => void actions.setPaused(next)}
          />
        </div>
        <label className="setrow">
          <div className="setlabel">
            <b>Check devices every</b>
            <span>How often AudioDeck polls for device changes</span>
          </div>
          <select
            className="select"
            aria-label="Check devices every"
            value={pollValue}
            onChange={(e) => void actions.setPollInterval(Number(e.target.value))}
          >
            {POLL_CHOICES.map((c) => (
              <option key={c.ms} value={c.ms}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <SectionLabel title="Startup" note="Tray" />
      <div className="setlist">
        <div className="setrow">
          <div className="setlabel">
            <b>Start with Windows</b>
            <span>Runs in the tray after sign in</span>
          </div>
          <Switch
            checked={state.autostart}
            label="Start with Windows"
            onChange={(next) => void actions.setAutostart(next)}
          />
        </div>
      </div>

      <SectionLabel title="What AudioDeck always does" note="Behaviour" />
      <div className="setlist">
        <div className="setrow">
          <div className="setlabel">
            <b>Keeps your manual pick until a device changes</b>
            <span>
              Choosing a device by hand holds until something connects or disconnects, then the
              ranking takes over again
            </span>
          </div>
        </div>
        <div className="setrow">
          <div className="setlabel">
            <b>Re-applies your names and icons after a driver reset</b>
            <span>Windows rebuilds endpoints and loses custom names; AudioDeck writes them back</span>
          </div>
        </div>
        <div className="setrow">
          <div className="setlabel">
            <b>Forgets devices Windows has deleted</b>
            <span>Ranked entries drop off once the endpoint is gone entirely, not merely offline</span>
          </div>
        </div>
      </div>

      <div className="about">
        <span>AudioDeck {state.appVersion}</span>
        <span className="about-d" aria-hidden="true" />
        <span>audioctl</span>
        <span className="about-d" aria-hidden="true" />
        <span>headsetcontrol 4.0.0</span>
      </div>
    </section>
  );
}
