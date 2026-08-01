// Settings page. Only controls that actually change behaviour appear here:
// autostart, the automation pause, and the poll interval. Anything AudioDeck
// does unconditionally (re-applying names after a driver reset, pruning
// deleted endpoints) belongs in the first-run guide, not here: a settings page
// listing things you cannot set is a page you stop reading.

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

export function SettingsView({
  state,
  actions,
  onReplayGuide,
}: {
  state: AppState;
  actions: AudioDeckApi;
  /** Reopens the first-run guide, without waiting on a round trip to disk. */
  onReplayGuide: () => void;
}) {
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

      <SectionLabel title="Audio effects" note="Studio" />
      <div className="setlist">
        <div className="setrow">
          <div className="setlabel">
            <b>Remove audio effects</b>
            <span>
              Takes AudioDeck&rsquo;s equalizer settings out of the audio path and leaves your PC
              as it was. Your curves are kept, so turning effects back on restores them.
            </span>
          </div>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => void actions.removeEffects()}
          >
            Remove
          </button>
        </div>
      </div>

      <SectionLabel title="Guide" note="First run" />
      <div className="setlist">
        <div className="setrow">
          <div className="setlabel">
            <b>Show the guide again</b>
            <span>
              The four cards AudioDeck opens with the first time, covering ranking, the device row,
              Studio and what it does on its own
            </span>
          </div>
          <button type="button" className="btn" onClick={onReplayGuide}>
            Show
          </button>
        </div>
      </div>

      <div className="about">
        {/* The wordmark rather than plain text, with the stencil bars cut
            across AUDIO only, exactly as the title bar draws it. */}
        <span className="about-brand">
          <span className="stencil">Audio</span>
          <span className="about-deck">Deck</span>
        </span>
        <span className="about-version">{state.appVersion}</span>
      </div>
    </section>
  );
}
