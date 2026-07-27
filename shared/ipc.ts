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
  available: boolean;
  availabilityReason: AvailabilityReason;
}

/** Everything the renderer needs to draw all three views plus settings. */
export interface AppState {
  devices: DeviceView[];
  outputPriority: string[];
  micPriority: string[];
  paused: boolean;
  autostart: boolean;
  pollIntervalMs: number;
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
  setPaused(paused: boolean): Promise<void>;
  setAutostart(enabled: boolean): Promise<void>;
  setPollInterval(ms: number): Promise<void>;
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
  setPaused: "audiodeck:set-paused",
  setAutostart: "audiodeck:set-autostart",
  setPollInterval: "audiodeck:set-poll-interval",
} as const;
