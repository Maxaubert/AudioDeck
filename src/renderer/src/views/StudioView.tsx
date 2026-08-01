// Studio: the equalizer curve and effect sliders, per device.
//
// The profile is edited locally and written through on a debounce, the same
// shape as the mixer's fader: dragging a curve point must not mean a config
// write and a file rewrite on every frame.

import { useCallback, useEffect, useRef, useState } from "react";
import { EQ_BANDS, EqCurve } from "../components/EqCurve.js";
import { EffectSlider } from "../components/EffectSlider.js";
import {
  MAX_BASS_DB,
  MAX_BOOST_DB,
  MAX_REVERB,
  MAX_EFFECT_DB,
  MAX_WIDTH,
  NEUTRAL_WIDTH,
} from "../../../../electron/eqapo/render.js";
import { SectionLabel } from "../components/SectionLabel.js";
import { displayDetail, displayName } from "../useAppState.js";
import type { AppState, AudioDeckApi, EffectsStatusView, EqProfileView } from "../../../../shared/ipc.js";

/**
 * Wait this long after the last change before writing it through. Short enough
 * that a slider feels connected to the sound rather than lagging behind it;
 * long enough that one drag is a handful of writes rather than one per frame.
 */
const COMMIT_DELAY_MS = 50;

function flat(): EqProfileView {
  return {
    enabled: true,
    bands: EQ_BANDS.map(() => 0),
    bassBoost: 0,
    clarity: 0,
    width: 100,
    volumeBoost: 0,
    reverb: 0,
  };
}

function isFlat(p: EqProfileView): boolean {
  return (
    p.bands.every((g) => g === 0) &&
    p.bassBoost === 0 &&
    p.clarity === 0 &&
    p.width === 100 &&
    p.volumeBoost === 0 &&
    p.reverb === 0
  );
}

export function StudioView({ state, actions }: { state: AppState; actions: AudioDeckApi }) {
  const [status, setStatus] = useState<EffectsStatusView | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [profile, setProfile] = useState<EqProfileView>(flat());
  const [installing, setInstalling] = useState(false);
  const pending = useRef<EqProfileView | null>(null);
  const commit = useRef<(id: string, p: EqProfileView) => void>(() => {});
  commit.current = (id, p) => void actions.setEqProfile(id, p);

  // Only real outputs: effects on an endpoint Windows is not reporting would
  // be settings with nowhere to land.
  const outputs = state.devices.filter((d) => d.flow === "render" && d.state !== "notpresent");
  const selected = deviceId ?? outputs.find((d) => d.isDefault)?.id ?? outputs[0]?.id ?? null;

  const refreshStatus = useCallback(() => {
    void actions.getEffectsStatus().then(setStatus);
  }, [actions]);

  useEffect(refreshStatus, [refreshStatus]);

  // Load the selected device's saved profile.
  useEffect(() => {
    if (selected === null) return;
    let alive = true;
    void actions.getEqProfile(selected).then((p) => {
      if (alive) setProfile({ ...flat(), ...p });
    });
    return () => {
      alive = false;
    };
  }, [actions, selected]);

  // Debounced write-through, and a flush so leaving the tab mid-drag does not
  // swallow the change.
  useEffect(() => {
    if (selected === null || pending.current === null) return;
    const p = pending.current;
    const timer = setTimeout(() => {
      pending.current = null;
      commit.current(selected, p);
    }, COMMIT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [profile, selected]);

  useEffect(
    () => () => {
      if (pending.current !== null && selected !== null) commit.current(selected, pending.current);
    },
    [selected],
  );

  const edit = (next: EqProfileView): void => {
    pending.current = next;
    setProfile(next);
  };

  if (status === null) {
    return (
      <section className="view" aria-labelledby="studio-title">
        <h2 className="view-title" id="studio-title">
          Studio
        </h2>
        <p className="empty-note">Checking audio effects&hellip;</p>
      </section>
    );
  }

  if (!status.installed) {
    return (
      <section className="view" aria-labelledby="studio-title">
        <h2 className="view-title" id="studio-title">
          Studio
        </h2>
        <div className="setup-panel">
          <p className="setup-lead">
            Audio effects need a processing component installed on this PC. AudioDeck includes it,
            so there is nothing to download.
          </p>
          <p className="setup-detail">
            Equalizer APO, by Jonas Thedering, licensed GPL-3. It asks for administrator approval
            and may need a restart to finish.
          </p>
          <div className="setup-actions">
            <button
              type="button"
              className="btn btn-accent"
              disabled={installing}
              onClick={() => {
                setInstalling(true);
                void actions.installEffects().then((r) => {
                  setInstalling(false);
                  if (r.started) refreshStatus();
                });
              }}
            >
              {installing ? "Setting up…" : "Set up audio effects"}
            </button>
            <button type="button" className="btn" onClick={refreshStatus}>
              Recheck
            </button>
          </div>
        </div>
      </section>
    );
  }

  const device = outputs.find((d) => d.id === selected);
  const off = !profile.enabled;

  return (
    <section className="view" aria-labelledby="studio-title">
      <h2 className="view-title" id="studio-title">
        Studio
      </h2>
      <p className="view-hint">
        Each output keeps its own curve, applied whenever that device is in use.
      </p>

      {status.error !== null ? <div className="error-banner">{status.error}</div> : null}

      {outputs.length === 0 || selected === null ? (
        <p className="empty-note">No outputs to tune.</p>
      ) : (
        <>
          <div className="studio-head">
            <label className="studio-picker">
              <span className="fx-label">Device</span>
              <select
                className="select"
                value={selected}
                onChange={(e) => setDeviceId(e.target.value)}
                aria-label="Device to tune"
              >
                {outputs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {displayName(d)}
                    {displayDetail(d) !== null ? ` (${displayDetail(d)})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={off ? "btn" : "btn btn-accent"}
              aria-pressed={!off}
              onClick={() => edit({ ...profile, enabled: !profile.enabled })}
            >
              {off ? "Effects off" : "Effects on"}
            </button>
          </div>

          <SectionLabel
            title="Equalizer"
            note={device === undefined ? "" : isFlat(profile) ? "flat" : "tuned"}
          />
          <EqCurve
            bands={profile.bands}
            disabled={off}
            onChange={(bands) => edit({ ...profile, bands })}
          />

          <SectionLabel title="Effects" note="" />
          <div className="fx-list">
            {/* Digital gain, so it is capped far lower than the others: it
                multiplies samples already near full scale, and sustained
                clipping is what damages drivers. It cannot raise the
                hardware's own ceiling either. */}
            <EffectSlider
              label="Volume boost"
              value={profile.volumeBoost}
              min={0}
              max={MAX_BOOST_DB}
              disabled={off}
              onChange={(volumeBoost) => edit({ ...profile, volumeBoost })}
            />
            <EffectSlider
              label="Bass boost"
              value={profile.bassBoost}
              min={0}
              max={MAX_BASS_DB}
              disabled={off}
              onChange={(bassBoost) => edit({ ...profile, bassBoost })}
            />
            <EffectSlider
              label="Clarity"
              value={profile.clarity}
              min={0}
              max={MAX_EFFECT_DB}
              disabled={off}
              onChange={(clarity) => edit({ ...profile, clarity })}
            />
            {/* Reflections rather than convolution: Equalizer APO's
                Convolution is the same FFT machinery as GraphicEQ, which does
                nothing at all on some devices. */}
            <EffectSlider
              label="Reverb"
              value={profile.reverb}
              min={0}
              max={MAX_REVERB}
              disabled={off}
              onChange={(reverb) => edit({ ...profile, reverb })}
            />
            {/* Level 0 is 100 %, the untouched signal, so the slider only
                widens. Narrowing towards mono is possible but is not what the
                control is for, and a slider whose middle means "do nothing"
                reads as broken. */}
            <EffectSlider
              label="Surround"
              value={profile.width}
              min={NEUTRAL_WIDTH}
              max={MAX_WIDTH}
              disabled={off}
              onChange={(width) => edit({ ...profile, width })}
            />
          </div>

          <button type="button" className="btn btn-add-device" onClick={() => edit(flat())}>
            Reset to flat
          </button>
        </>
      )}
    </section>
  );
}
