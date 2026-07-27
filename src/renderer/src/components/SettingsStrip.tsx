// Bottom settings strip: autostart, pause automation, poll interval.

import type { AppState, AudioDeckApi } from "../../../../shared/ipc.js";

const POLL_CHOICES = [
  { ms: 1000, label: "1 second" },
  { ms: 2000, label: "2 seconds" },
  { ms: 5000, label: "5 seconds" },
  { ms: 10000, label: "10 seconds" },
];

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
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
      onClick={() => onChange(!checked)}
    />
  );
}

export function SettingsStrip({ state, actions }: { state: AppState; actions: AudioDeckApi }) {
  const pollValue = POLL_CHOICES.some((c) => c.ms === state.pollIntervalMs)
    ? state.pollIntervalMs
    : 2000;
  return (
    <footer className="settings-strip">
      <div className="setting">
        <span className="setting-label" id="label-autostart">
          Start with Windows
        </span>
        <Switch
          checked={state.autostart}
          label="Start with Windows"
          onChange={(next) => void actions.setAutostart(next)}
        />
      </div>
      <div className="setting">
        <span className="setting-label" id="label-pause">
          Pause automation
        </span>
        <Switch
          checked={state.paused}
          label="Pause automation"
          onChange={(next) => void actions.setPaused(next)}
        />
      </div>
      <div className="setting">
        <label className="setting-label" htmlFor="poll-interval">
          Check devices every
        </label>
        <select
          id="poll-interval"
          className="select"
          value={pollValue}
          onChange={(e) => void actions.setPollInterval(Number(e.target.value))}
        >
          {POLL_CHOICES.map((c) => (
            <option key={c.ms} value={c.ms}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
    </footer>
  );
}
