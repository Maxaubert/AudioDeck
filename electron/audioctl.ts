// Typed wrapper around the audioctl.exe helper: spawn, parse JSON, map errors.

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type EndpointFlow = "render" | "capture";
export type EndpointState = "active" | "disabled" | "notpresent" | "unplugged";

/** One row of `audioctl list`. volume/mute are null for non-active endpoints. */
export interface Endpoint {
  id: string;
  name: string;
  flow: EndpointFlow;
  state: EndpointState;
  isDefault: boolean;
  isDefaultComms: boolean;
  volume: number | null;
  mute: boolean | null;
}

/**
 * The audio-control surface the daemon consumes. Audioctl implements it by
 * spawning audioctl.exe; the e2e mock backend implements it in memory.
 */
export interface AudioControl {
  list(): Promise<Endpoint[]>;
  setDefault(id: string): Promise<void>;
  setVolume(id: string, level: number): Promise<void>;
  mute(id: string): Promise<void>;
  unmute(id: string): Promise<void>;
  enable(id: string): Promise<void>;
  disable(id: string): Promise<void>;
  /**
   * Rename the endpoint system-wide. `suffix` optionally replaces the
   * "(...)" part Windows always appends; omitted keeps the current one.
   */
  rename(id: string, name: string, suffix?: string): Promise<void>;
}

export class AudioctlError extends Error {
  constructor(
    message: string,
    readonly command: readonly string[],
    readonly exitCode: number | null,
    readonly stderr: string,
  ) {
    super(message);
    this.name = "AudioctlError";
  }
}

/**
 * Default location of the Stage 1 publish output, relative to the app root
 * (the repo root in dev; packaging remaps this in Stage 5).
 */
export function defaultAudioctlPath(appRoot: string = process.cwd()): string {
  return path.join(
    appRoot,
    "audioctl",
    "bin",
    "x64",
    "Release",
    "net8.0",
    "win-x64",
    "publish",
    "audioctl.exe",
  );
}

export interface AudioctlOptions {
  /** Path to audioctl.exe; defaults to the repo-relative publish output. */
  exePath?: string;
  /** Kill the helper if it hangs; it is normally done in well under a second. */
  timeoutMs?: number;
}

export class Audioctl implements AudioControl {
  private readonly exePath: string;
  private readonly timeoutMs: number;

  constructor(options: AudioctlOptions = {}) {
    this.exePath = options.exePath ?? defaultAudioctlPath();
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  async list(): Promise<Endpoint[]> {
    const result = await this.run(["list"]);
    if (!Array.isArray(result)) {
      throw new AudioctlError("audioctl list did not return a JSON array", ["list"], 0, "");
    }
    return result as Endpoint[];
  }

  async setDefault(id: string): Promise<void> {
    await this.run(["set-default", id]);
  }

  async setVolume(id: string, level: number): Promise<void> {
    if (!Number.isInteger(level) || level < 0 || level > 100) {
      throw new RangeError(`volume must be an integer 0-100, got ${level}`);
    }
    await this.run(["set-volume", id, String(level)]);
  }

  async mute(id: string): Promise<void> {
    await this.run(["mute", id]);
  }

  async unmute(id: string): Promise<void> {
    await this.run(["unmute", id]);
  }

  async enable(id: string): Promise<void> {
    await this.run(["enable", id]);
  }

  async disable(id: string): Promise<void> {
    await this.run(["disable", id]);
  }

  async rename(id: string, name: string, suffix?: string): Promise<void> {
    await this.run(suffix === undefined ? ["rename", id, name] : ["rename", id, name, suffix]);
  }

  /**
   * Spawn audioctl once and return its parsed stdout. audioctl always prints
   * JSON: an array for `list`, `{ok: true, ...}` on success, `{ok: false,
   * error}` on failure (exit code 1). Everything else becomes AudioctlError.
   */
  private async run(args: string[]): Promise<unknown> {
    let stdout: string;
    let stderr = "";
    let exitCode: number | null = 0;
    try {
      const result = await execFileAsync(this.exePath, args, {
        timeout: this.timeoutMs,
        windowsHide: true,
        encoding: "utf8",
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (err) {
      const e = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: unknown };
      stdout = e.stdout ?? "";
      stderr = e.stderr ?? "";
      exitCode = typeof e.code === "number" ? e.code : null;
      // Spawn-level failure (missing exe, timeout kill): no JSON to read.
      if (stdout.trim() === "") {
        throw new AudioctlError(`audioctl failed to run: ${e.message}`, args, exitCode, stderr);
      }
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      throw new AudioctlError(
        `audioctl printed invalid JSON: ${stdout.slice(0, 200)}`,
        args,
        exitCode,
        stderr,
      );
    }

    if (isErrorPayload(parsed)) {
      throw new AudioctlError(parsed.error, args, exitCode, stderr);
    }
    return parsed;
  }
}

function isErrorPayload(value: unknown): value is { ok: false; error: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { ok?: unknown }).ok === false &&
    typeof (value as { error?: unknown }).error === "string"
  );
}
