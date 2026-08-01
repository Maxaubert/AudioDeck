// Writes AudioDeck's generated config next to Equalizer APO's own, and takes
// it back out again.
//
// Two rules, both because config.txt is not our file:
//   - our own config is written whole, atomically, and is the only file we own;
//   - config.txt gains exactly one line and is otherwise never rewritten.

import { copyFile, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { AUDIODECK_CONFIG, ensureIncludeLine, removeIncludeLine } from "./include.js";
import { IR_RATES, irFileName, renderConfig } from "./render.js";
import type { DeviceSection } from "./render.js";

export interface ImpulseResponses {
  /** Absolute path of the generated response for a sample rate. */
  sourcePath: (rate: number) => string;
}

export interface FileIo {
  /** File contents, or null when it does not exist. */
  read: (file: string) => Promise<string | null>;
  /** Replace a file's contents; must not leave a partial file behind. */
  write: (file: string, text: string) => Promise<void>;
  remove: (file: string) => Promise<void>;
}

export interface ApplyResult {
  /** The file that was written. */
  configFile: string;
  /** True when config.txt had to gain the include line this time. */
  linkedInclude: boolean;
}

/**
 * Render the profiles and put them where Equalizer APO will read them.
 *
 * Equalizer APO watches these files and applies changes immediately, with no
 * service restart (proven live 2026-08-01), so this is the whole of "make it
 * take effect".
 */
export async function applyProfiles(
  io: FileIo,
  configPath: string,
  sections: readonly DeviceSection[],
  /** Omitted when nothing needs the reverb response, and in tests. */
  impulses?: ImpulseResponses,
): Promise<ApplyResult> {
  const config = renderConfig(sections);

  // The response has to sit beside the config Equalizer APO reads, because
  // Convolution resolves its path relative to that directory.
  if (impulses !== undefined && config.includes("Convolution:")) {
    for (const rate of IR_RATES) {
      const target = path.join(configPath, irFileName(rate));
      try {
        await copyFile(impulses.sourcePath(rate), target);
      } catch (err) {
        // One missing rate is not fatal: the config picks by rate at runtime,
        // and the other may still be the one this device needs.
        console.error("[effects] could not place impulse response:", err);
      }
    }
  }

  const configFile = path.join(configPath, AUDIODECK_CONFIG);
  await io.write(configFile, config);

  const mainFile = path.join(configPath, "config.txt");
  // null here means Equalizer APO has no config.txt yet, which is a normal
  // fresh install: starting from empty is correct. It must never mean "the
  // read failed", or the user's own filters get replaced by our Include line.
  const existing = (await io.read(mainFile)) ?? "";
  const linked = ensureIncludeLine(existing);
  if (linked !== null) await io.write(mainFile, linked);

  return { configFile, linkedInclude: linked !== null };
}

/**
 * Remove AudioDeck's effects entirely: delete our file, take our line out of
 * theirs. Audio processing the user cannot undo from inside the app is not
 * acceptable, so this has to work even when things are in a strange state, and
 * it never fails because a file was already gone.
 */
export async function removeProfiles(io: FileIo, configPath: string): Promise<void> {
  const mainFile = path.join(configPath, "config.txt");
  const existing = await io.read(mainFile);
  if (existing !== null) {
    const stripped = removeIncludeLine(existing);
    if (stripped !== null) await io.write(mainFile, stripped);
  }
  await io.remove(path.join(configPath, AUDIODECK_CONFIG));
  for (const rate of IR_RATES) {
    await io.remove(path.join(configPath, irFileName(rate)));
  }
}

/**
 * Real filesystem access.
 *
 * Written in place, NOT through a temp file and a rename. Equalizer APO keeps
 * these files open to watch them, and Windows refuses to rename over a file
 * another process holds open: every write failed with EPERM, which looked from
 * the outside like the equalizer simply not working (observed 2026-08-01).
 * Atomicity was protecting against a torn read that Equalizer APO recovers
 * from anyway, since it re-reads whenever the file changes.
 *
 * A brief retry covers the moment it has the file open for reading.
 */
const WRITE_ATTEMPTS = 4;
const RETRY_DELAY_MS = 40;

export const realFileIo: FileIo = {
  /**
   * null means the file is genuinely not there, and nothing else.
   *
   * Swallowing every error and returning null made "I cannot read this" look
   * identical to "this does not exist", and applyProfiles turns the latter into
   * an empty string. A sharing violation from an antivirus scan or from Peace
   * having the file open was therefore enough to replace the user's entire
   * config.txt with a single Include line, and the write path retries hard
   * enough to win that race. Same retry as write, for the same reason.
   */
  read: async (file) => {
    let last: unknown;
    for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt++) {
      try {
        return await readFile(file, "utf8");
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === "ENOENT") return null;
        last = err;
        if (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES") throw err;
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
    throw last;
  },
  write: async (file, text) => {
    let last: unknown;
    for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt++) {
      try {
        await writeFile(file, text, "utf8");
        return;
      } catch (err) {
        last = err;
        const code = (err as NodeJS.ErrnoException).code;
        // Only worth retrying while another process has it open.
        if (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES") throw err;
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
    throw last;
  },
  remove: async (file) => {
    await rm(file, { force: true });
  },
};
