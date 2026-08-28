// The Mixer tab: the Windows per-app volume mixer, drawn in AudioDeck's print
// language. Master row on top (the default output device), one row per app
// under it. Same WASAPI session state as the Windows mixer, so the two can
// never disagree; external changes land on the next 1 s poll.

import { SectionLabel } from "../components/SectionLabel.js";
import { VolumeFader } from "../components/VolumeFader.js";
import { Fader } from "../components/Fader.js";
import { AppIcon } from "../components/AppIcon.js";
import { useMixer } from "../useMixer.js";
import { displayName } from "../useAppState.js";
import type { AppState, AudioDeckApi, MixerAppView } from "../../../../shared/ipc.js";

export function MixerView({ state, actions }: { state: AppState; actions: AudioDeckApi }) {
  const { apps, error, setAppVolume, setAppMute } = useMixer();
  const defaultOut = state.devices.find((d) => d.flow === "render" && d.isDefault) ?? null;

  return (
    <main className="view mixer-view">
      {error !== null ? <div className="error-banner">{error}</div> : null}

      <SectionLabel title="Output" />
      {defaultOut === null ? (
        <p className="mixer-empty">No output device is active.</p>
      ) : (
        <div className="mixer-row mixer-master">
          <span className="mixer-name">{displayName(defaultOut)}</span>
          <VolumeFader device={defaultOut} actions={actions} />
          <MuteButton
            name={displayName(defaultOut)}
            muted={defaultOut.mute === true}
            onToggle={() => void actions.setMute(defaultOut.id, defaultOut.mute !== true)}
          />
        </div>
      )}

      <SectionLabel title="Apps" />
      {apps === null ? (
        <p className="mixer-empty">Reading audio sessions&hellip;</p>
      ) : apps.length === 0 ? (
        <p className="mixer-empty">
          Nothing is playing. Apps appear here while they play sound on the current output.
        </p>
      ) : (
        <ul className="mixer-apps">
          {apps.map((app) => (
            <AppRow key={app.key} app={app} setAppVolume={setAppVolume} setAppMute={setAppMute} />
          ))}
        </ul>
      )}
    </main>
  );
}

function AppRow({
  app,
  setAppVolume,
  setAppMute,
}: {
  app: MixerAppView;
  setAppVolume: (ids: string[], level: number) => Promise<void>;
  setAppMute: (ids: string[], mute: boolean) => Promise<void>;
}) {
  return (
    <li className="mixer-row mixer-app" data-active={app.active}>
      <AppIcon app={app} />
      <span className="mixer-name">{app.name}</span>
      <Fader
        value={app.volume}
        muted={app.mute}
        ariaLabel={`${app.name} volume`}
        onCommit={(v) => void setAppVolume(app.sessionIds, v)}
      />
      <MuteButton
        name={app.name}
        muted={app.mute}
        onToggle={() => void setAppMute(app.sessionIds, !app.mute)}
      />
    </li>
  );
}

function MuteButton({
  name,
  muted,
  onToggle,
}: {
  name: string;
  muted: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="mixer-mute"
      aria-label={`Mute ${name}`}
      aria-pressed={muted}
      onClick={onToggle}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
        {muted ? (
          <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        ) : (
          <path
            d="M16 8.5a5 5 0 0 1 0 7"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />
        )}
      </svg>
    </button>
  );
}
