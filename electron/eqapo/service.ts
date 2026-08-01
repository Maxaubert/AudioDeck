// The daemon's view of audio effects: where the profiles are, whether the
// component that applies them is installed, and pushing one to the other.
//
// Everything here is I/O and orchestration; the decisions live in render.ts
// and include.ts, which are pure.

import { detectEqApo, queryRegistry } from "./detect.js";
import { applyProfiles, realFileIo, removeProfiles } from "./apply.js";
import type { EqApoInstall } from "./detect.js";
import type { FileIo } from "./apply.js";
import type { AudioDeckConfig, EqProfile } from "../config.js";
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
  private install: EqApoInstall | null = null;
  private error: string | null = null;

  constructor(deps: EffectsDeps = {}) {
    this.detect = deps.detect ?? (() => detectEqApo({ queryRegistry }));
    this.io = deps.io ?? realFileIo;
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
    if (this.install === null) await this.refresh();
    const install = this.install;
    if (install === null) return;

    try {
      await applyProfiles(this.io, install.configPath, sectionsFor(config));
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
  return { enabled: true, bands: new Array(10).fill(0), bassBoost: 0, clarity: 0, width: 100 };
}
