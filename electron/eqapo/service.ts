// The daemon's view of audio effects: where the profiles are, whether the
// component that applies them is installed, and pushing one to the other.
//
// Everything here is I/O and orchestration; the decisions live in render.ts
// and include.ts, which are pure.

import { detectEqApo, queryRegistry } from "./detect.js";
import { applyProfiles, realFileIo, removeProfiles } from "./apply.js";
import { impulseResponses } from "./impulses.js";
import type { EqApoInstall } from "./detect.js";
import type { FileIo, ImpulseResponses } from "./apply.js";
import type { AudioDeckConfig, EqProfile } from "../config.js";
import { hasDirectives, renderConfig } from "./render.js";
import type { DeviceSection } from "./render.js";

export interface EffectsStatus {
  /** Null when Equalizer APO is not installed. */
  install: EqApoInstall | null;
  /** Set when the last apply failed, for the UI's error banner. */
  error: string | null;
}

export interface EffectsDeps {
  detect?: () => Promise<EqApoInstall | null>;
  io?: FileIo;
  impulses?: ImpulseResponses;
}

/**
 * Equalizer APO matches devices on "Device_name Connection_name GUID", so the
 * bare GUID is an exact pattern (proven live 2026-08-01). AudioDeck endpoint
 * ids are `{0.0.0.00000000}.{guid}`; the second brace group is what to match.
 *
 * Matching on the GUID rather than the name is not a preference. Equalizer
 * APO's device list shows the endpoint's DeviceDesc, which is the very
 * property AudioDeck's rename feature writes, so a name pattern would break
 * every time a user renamed a device in AudioDeck.
 */
export function deviceMatchPattern(endpointId: string): string | null {
  const found = /\{[0-9a-f-]{36}\}\s*$/i.exec(endpointId);
  return found === null ? null : found[0];
}

/** Config profiles to renderer sections, dropping anything unmatchable. */
export function sectionsFor(config: AudioDeckConfig): DeviceSection[] {
  const sections: DeviceSection[] = [];
  for (const [endpointId, profile] of Object.entries(config.eq)) {
    const match = deviceMatchPattern(endpointId);
    if (match !== null) sections.push({ match, profile });
  }
  return sections;
}

export class EffectsService {
  private readonly detect: () => Promise<EqApoInstall | null>;
  private readonly io: FileIo;
  private readonly impulses: ImpulseResponses;
  private install: EqApoInstall | null = null;
  private error: string | null = null;
  /**
   * Tail of the write chain. Dragging a slider produces a burst of applies,
   * and two of them interleaving on the same file is how a half-written config
   * reaches the audio engine.
   */
  private chain: Promise<void> = Promise.resolve();

  constructor(deps: EffectsDeps = {}) {
    this.detect = deps.detect ?? (() => detectEqApo({ queryRegistry }));
    this.io = deps.io ?? realFileIo;
    this.impulses = deps.impulses ?? impulseResponses;
  }

  status(): EffectsStatus {
    return { install: this.install, error: this.error };
  }

  /** Re-run detection. Cheap, and the answer changes when the user installs. */
  async refresh(): Promise<EqApoInstall | null> {
    this.install = await this.detect();
    return this.install;
  }

  /**
   * Push the config's profiles at Equalizer APO. Safe to call when it is not
   * installed: there is simply nowhere to write, which is not an error the
   * user needs shouting about.
   */
  async apply(config: AudioDeckConfig): Promise<void> {
    const run = this.chain.then(() => this.applyNow(config));
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async applyNow(config: AudioDeckConfig): Promise<void> {
    if (this.install === null) await this.refresh();
    const install = this.install;
    if (install === null) return;

    const sections = sectionsFor(config);
    try {
      // Judged on what the config actually says, not on whether profiles
      // exist: a profile with everything at rest renders to comments alone.
      if (!hasDirectives(renderConfig(sections))) {
        // Nothing to apply: take our file and our line back out rather than
        // leaving an empty include behind. AudioDeck should not appear in
        // someone's audio configuration until they have actually asked for an
        // effect, and should disappear again when they remove the last one.
        await removeProfiles(this.io, install.configPath);
      } else {
        await applyProfiles(this.io, install.configPath, sections, this.impulses);
      }
      this.error = null;
    } catch (err) {
      // A failed write must not take the daemon down, and must not be silent
      // either: the profile is still saved, it just is not in effect.
      this.error = `Could not write audio effects to ${install.configPath}: ${String(err)}`;
      console.error("[effects]", this.error);
    }
  }

  /** Take AudioDeck's effects out, leaving the machine as it was found. */
  async removeAll(): Promise<void> {
    if (this.install === null) await this.refresh();
    const install = this.install;
    if (install === null) return;
    try {
      await removeProfiles(this.io, install.configPath);
      this.error = null;
    } catch (err) {
      this.error = `Could not remove audio effects: ${String(err)}`;
      console.error("[effects]", this.error);
    }
  }
}

/** A profile with everything at rest, for a device that has never been tuned. */
export function flatEqProfile(): EqProfile {
  return {
    enabled: true,
    bands: new Array(10).fill(0),
    bassBoost: 0,
    clarity: 0,
    width: 100,
    volumeBoost: 0,
    reverb: 0,
  };
}
