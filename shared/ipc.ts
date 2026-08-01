// The typed IPC contract shared by main, preload, and renderer. Types only,
// plus the channel-name constants; no runtime logic lives here.

import type { EndpointFlow, EndpointState } from "../electron/audioctl.js";
import type { AvailabilityReason } from "../electron/availability.js";

/** One device as the renderer sees it: endpoint + availability + user alias. */
export interface DeviceView {
  id: string;
  name: string;
  /** User-chosen display alias from config, null when none is set. */
  alias: string | null;
  flow: EndpointFlow;
  state: EndpointState;
  isDefault: boolean;
  isDefaultComms: boolean;
  /** Endpoint form factor (device kind); null when unreadable. */
  formFactor: number | null;
  /** 0-100, null for non-active endpoints. */
  volume: number | null;
  mute: boolean | null;
  /**
   * True when the device ignored a volume change we made: some hardware owns
   * its own level (the Arctis Nova Pro base station pins Windows at 100), so
   * the mixer says so instead of showing a fader that does nothing.
   */
  volumeLocked: boolean;
  available: boolean;
  availabilityReason: AvailabilityReason;
}

/** Per-device equalizer and effect settings, as the renderer edits them. */
export interface EqProfileView {
  enabled: boolean;
  /** Gain in dB per band, ten entries matching EQ_BANDS. */
  bands: number[];
  bassBoost: number;
  clarity: number;
  /** Stereo width percentage; 100 leaves the signal untouched. */
  width: number;
}

/** Whether audio effects can be applied at all, and where. */
export interface EffectsStatusView {
  /** False until the processing component is installed. */
  installed: boolean;
  /** Where its config lives, for error messages. Null when not installed. */
  configPath: string | null;
  /** Set when the last write failed; the profile is saved but not in effect. */
  error: string | null;
}

/** Everything the renderer needs to draw all three views plus settings. */
export interface AppState {
  devices: DeviceView[];
  outputPriority: string[];
  micPriority: string[];
  /** Manual-override hold per flow: audio was pointed somewhere by hand. */
  override: { output: boolean; mic: boolean };
  paused: boolean;
  autostart: boolean;
  pollIntervalMs: number;
  /** Shown on the Settings page. */
  appVersion: string;
}

/** The surface preload exposes as `window.audiodeck`. */
export interface AudioDeckApi {
  getState(): Promise<AppState>;
  setPriority(flow: EndpointFlow, ids: string[]): Promise<void>;
  /** Append a device to a priority list (and un-exclude it). */
  addToPriority(flow: EndpointFlow, id: string): Promise<void>;
  /** Remove a device from a priority list; it stays out until re-added. */
  removeFromPriority(flow: EndpointFlow, id: string): Promise<void>;
  setDefault(id: string): Promise<void>;
  setVolume(id: string, level: number): Promise<void>;
  setMute(id: string, mute: boolean): Promise<void>;
  setEndpointEnabled(id: string, enabled: boolean): Promise<void>;
  setAlias(id: string, alias: string | null): Promise<void>;
  /**
   * Rename the endpoint in Windows itself (audio picker, Settings, all apps).
   * `suffix` optionally replaces the parenthesized part; omitted keeps it.
   */
  renameDevice(id: string, name: string, suffix?: string): Promise<void>;
  /** Change what kind of device Windows shows this endpoint as (see deviceTypes). */
  setDeviceType(id: string, typeKey: string): Promise<void>;
  /** Whether audio effects are available, and any error from the last write. */
  getEffectsStatus(): Promise<EffectsStatusView>;
  /** The device's saved profile, or a flat one if it has never been tuned. */
  getEqProfile(deviceId: string): Promise<EqProfileView>;
  setEqProfile(deviceId: string, profile: EqProfileView): Promise<void>;
  /** Launch the bundled setup for the processing component. */
  installEffects(): Promise<{ started: boolean; error?: string }>;
  /** Take AudioDeck's effects back out, leaving the machine as it was. */
  removeEffects(): Promise<void>;
  setPaused(paused: boolean): Promise<void>;
  setAutostart(enabled: boolean): Promise<void>;
  setPollInterval(ms: number): Promise<void>;
  /** Frameless window caption controls. */
  windowMinimize(): Promise<void>;
  /** Toggles maximize/restore; resolves with the new maximized state. */
  windowToggleMaximize(): Promise<boolean>;
  windowClose(): Promise<void>;
  /** Current maximized state, for the caption glyph on first paint. */
  windowIsMaximized(): Promise<boolean>;
  /** Subscribe to maximize/unmaximize; returns an unsubscribe function. */
  onWindowStateChanged(cb: (maximized: boolean) => void): () => void;
}

/** Channel names, one per AudioDeckApi method. */
export const IPC = {
  getState: "audiodeck:get-state",
  setPriority: "audiodeck:set-priority",
  addToPriority: "audiodeck:add-to-priority",
  removeFromPriority: "audiodeck:remove-from-priority",
  setDefault: "audiodeck:set-default",
  setVolume: "audiodeck:set-volume",
  setMute: "audiodeck:set-mute",
  setEndpointEnabled: "audiodeck:set-endpoint-enabled",
  setAlias: "audiodeck:set-alias",
  renameDevice: "audiodeck:rename-device",
  setDeviceType: "audiodeck:set-device-type",
  getEffectsStatus: "audiodeck:get-effects-status",
  getEqProfile: "audiodeck:get-eq-profile",
  setEqProfile: "audiodeck:set-eq-profile",
  installEffects: "audiodeck:install-effects",
  removeEffects: "audiodeck:remove-effects",
  setPaused: "audiodeck:set-paused",
  setAutostart: "audiodeck:set-autostart",
  setPollInterval: "audiodeck:set-poll-interval",
  windowMinimize: "audiodeck:window-minimize",
  windowToggleMaximize: "audiodeck:window-toggle-maximize",
  windowClose: "audiodeck:window-close",
  windowIsMaximized: "audiodeck:window-is-maximized",
  windowStateChanged: "audiodeck:window-state-changed",
} as const;
