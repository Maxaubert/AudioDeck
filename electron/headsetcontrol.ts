// Typed wrapper around vendor/headsetcontrol.exe: spawn `-o json`, parse, map errors.
// Consumers treat any HeadsetControlError as "power unknown" and fail open.

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Battery statuses HeadsetControl 4.x reports. */
export type BatteryStatus =
  | "BATTERY_AVAILABLE"
  | "BATTERY_CHARGING"
  | "BATTERY_UNAVAILABLE"
  | "BATTERY_HIDERROR"
  | "BATTERY_TIMEOUT";

export interface HeadsetBattery {
  status: BatteryStatus;
  /** Percent 0-100; -1 when unavailable. */
  level: number;
}

export interface HeadsetDevice {
  /** "success" when the device answered; anything else means unreadable. */
  status: string;
  /** Full display name, e.g. "SteelSeries Arctis Nova Pro Wireless". */
  device: string;
  vendor: string;
  product: string;
  id_vendor: string;
  id_product: string;
  capabilities: string[];
  battery?: HeadsetBattery;
}

export interface HeadsetSnapshot {
  version: string;
  devices: HeadsetDevice[];
}

/**
 * The headset-power query surface the daemon consumes. HeadsetControl
 * implements it by spawning the vendor binary; the e2e mock backend
 * implements it in memory.
 */
export interface HeadsetQuerier {
  query(): Promise<HeadsetSnapshot>;
}

export class HeadsetControlError extends Error {
  constructor(
    message: string,
    readonly exitCode: number | null,
    readonly stderr: string,
  ) {
    super(message);
    this.name = "HeadsetControlError";
  }
}

/** Default location of the bundled binary, relative to the app root. */
export function defaultHeadsetControlPath(appRoot: string = process.cwd()): string {
  return path.join(appRoot, "vendor", "headsetcontrol.exe");
}

export interface HeadsetControlOptions {
  /** Path to headsetcontrol.exe; defaults to vendor/headsetcontrol.exe. */
  exePath?: string;
  timeoutMs?: number;
}

export class HeadsetControl implements HeadsetQuerier {
  private readonly exePath: string;
  private readonly timeoutMs: number;

  constructor(options: HeadsetControlOptions = {}) {
    this.exePath = options.exePath ?? defaultHeadsetControlPath();
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  /** One `headsetcontrol -o json` shot. Throws HeadsetControlError on any failure. */
  async query(): Promise<HeadsetSnapshot> {
    let stdout: string;
    try {
      // HeadsetControl exits non-zero when no supported device is connected but
      // still prints valid JSON, so parse stdout before judging the exit code.
      const result = await execFileAsync(this.exePath, ["-o", "json"], {
        timeout: this.timeoutMs,
        windowsHide: true,
        encoding: "utf8",
      });
      stdout = result.stdout;
    } catch (err) {
      const e = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: unknown };
      stdout = e.stdout ?? "";
      if (stdout.trim() === "") {
        throw new HeadsetControlError(
          `headsetcontrol failed to run: ${e.message}`,
          typeof e.code === "number" ? e.code : null,
          e.stderr ?? "",
        );
      }
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      throw new HeadsetControlError(
        `headsetcontrol printed invalid JSON: ${stdout.slice(0, 200)}`,
        null,
        "",
      );
    }
    const snapshot = parsed as Partial<HeadsetSnapshot>;
    return {
      version: typeof snapshot.version === "string" ? snapshot.version : "unknown",
      devices: Array.isArray(snapshot.devices) ? snapshot.devices : [],
    };
  }
}

/**
 * Is the headset powered on according to its battery status? Returns null for
 * "unknown" (device did not answer, no battery capability, HID error), which
 * callers must treat as powered on (fail open, never switch away wrongly).
 */
export function headsetPowerState(device: HeadsetDevice): boolean | null {
  if (device.status !== "success" || device.battery === undefined) return null;
  switch (device.battery.status) {
    case "BATTERY_AVAILABLE":
    case "BATTERY_CHARGING":
      return true;
    case "BATTERY_UNAVAILABLE":
      return false;
    default:
      return null;
  }
}

/**
 * Match a HeadsetControl device to a Windows endpoint by name: every word of
 * the product name must appear in the endpoint's friendly name (Windows names
 * look like "Speakers (Arctis Nova Pro Wireless)" while HeadsetControl says
 * "SteelSeries Arctis Nova Pro Wireless").
 */
export function matchesEndpointName(device: HeadsetDevice, endpointName: string): boolean {
  const haystack = endpointName.toLowerCase();
  const words = device.product
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  return words.length > 0 && words.every((w) => haystack.includes(w));
}
