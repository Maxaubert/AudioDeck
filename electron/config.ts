// Load/save AudioDeck's JSON config with atomic writes. No other module touches disk config.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const CONFIG_SCHEMA_VERSION = 1;

/** Manual-override hold state, tracked independently per flow (design: "Behavior rules"). */
export interface OverrideState {
  output: boolean;
  mic: boolean;
}

export interface AudioDeckConfig {
  schemaVersion: number;
  /** Endpoint IDs, highest priority first. */
  outputPriority: string[];
  /** Endpoint IDs, highest priority first. */
  micPriority: string[];
  override: OverrideState;
  pollIntervalMs: number;
  autostart: boolean;
  /** Endpoint IDs the user has hidden from AudioDeck's lists. */
  hiddenDevices: string[];
  /** User-chosen display aliases, endpoint ID to alias. */
  aliases: Record<string, string>;
  /** Endpoint IDs the user removed from the priority lists; never auto re-added. */
  excluded: { output: string[]; mic: string[] };
}

export function defaultConfig(): AudioDeckConfig {
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    outputPriority: [],
    micPriority: [],
    override: { output: false, mic: false },
    pollIntervalMs: 2000,
    autostart: true,
    hiddenDevices: [],
    aliases: {},
    excluded: { output: [], mic: [] },
  };
}

/** `%APPDATA%\AudioDeck`, overridable for tests. */
export function configDir(): string {
  const appData =
    process.env.APPDATA ?? path.join(process.env.USERPROFILE ?? ".", "AppData", "Roaming");
  return path.join(appData, "AudioDeck");
}

export function configPath(dir: string = configDir()): string {
  return path.join(dir, "config.json");
}

/**
 * Read config from disk. A missing file yields defaults; a corrupt file throws
 * (the caller decides whether to fall back, we never silently discard user data).
 */
export async function loadConfig(file: string = configPath()): Promise<AudioDeckConfig> {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return defaultConfig();
    throw err;
  }
  return migrateConfig(JSON.parse(raw));
}

/** In-flight write per target file, so concurrent saves serialize in order. */
const pendingWrites = new Map<string, Promise<void>>();
let writeSeq = 0;

/**
 * Atomic write: write a temp file in the same directory, then rename over the
 * target. Node's rename replaces the destination on Windows, so a crash never
 * leaves a half-written config.json behind. Saves to the same file are chained
 * (the poller and IPC handlers can save concurrently); each write gets a unique
 * temp name so two writers can never interleave inside one temp file, and
 * chaining keeps the last call's state the one that lands.
 */
export async function saveConfig(
  config: AudioDeckConfig,
  file: string = configPath(),
): Promise<void> {
  const previous = pendingWrites.get(file) ?? Promise.resolve();
  const write = previous.catch(() => undefined).then(() => writeConfigFile(config, file));
  pendingWrites.set(file, write);
  try {
    await write;
  } finally {
    if (pendingWrites.get(file) === write) pendingWrites.delete(file);
  }
}

async function writeConfigFile(config: AudioDeckConfig, file: string): Promise<void> {
  const dir = path.dirname(file);
  await mkdir(dir, { recursive: true });
  writeSeq += 1;
  const tmp = path.join(dir, `.config.json.tmp-${process.pid}-${writeSeq}`);
  await writeFile(tmp, JSON.stringify(config, null, 2) + "\n", "utf8");
  await rename(tmp, file);
}

/**
 * Bring a parsed config up to the current schema and fill any missing fields
 * with defaults. Migration stub: version 1 is the only schema so far; bump
 * CONFIG_SCHEMA_VERSION and add a step here when the shape changes.
 */
export function migrateConfig(raw: unknown): AudioDeckConfig {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("config.json is not a JSON object");
  }
  const partial = raw as Partial<AudioDeckConfig>;
  const base = defaultConfig();
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    outputPriority: stringArray(partial.outputPriority) ?? base.outputPriority,
    micPriority: stringArray(partial.micPriority) ?? base.micPriority,
    override: {
      output: partial.override?.output ?? base.override.output,
      mic: partial.override?.mic ?? base.override.mic,
    },
    pollIntervalMs:
      typeof partial.pollIntervalMs === "number" && partial.pollIntervalMs >= 250
        ? partial.pollIntervalMs
        : base.pollIntervalMs,
    autostart: typeof partial.autostart === "boolean" ? partial.autostart : base.autostart,
    hiddenDevices: stringArray(partial.hiddenDevices) ?? base.hiddenDevices,
    aliases: stringRecord(partial.aliases) ?? base.aliases,
    excluded: {
      output: stringArray(partial.excluded?.output) ?? base.excluded.output,
      mic: stringArray(partial.excluded?.mic) ?? base.excluded.mic,
    },
  };
}

function stringRecord(value: unknown): Record<string, string> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((v): v is string => typeof v === "string");
}
