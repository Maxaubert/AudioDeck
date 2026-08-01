// Writes AudioDeck's generated config next to Equalizer APO's own, and takes
// it back out again.
//
// Two rules, both because config.txt is not our file:
//   - our own config is written whole, atomically, and is the only file we own;
//   - config.txt gains exactly one line and is otherwise never rewritten.

import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { AUDIODECK_CONFIG, ensureIncludeLine, removeIncludeLine } from "./include.js";
import { renderConfig } from "./render.js";
import type { DeviceSection } from "./render.js";

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
): Promise<ApplyResult> {
  const configFile = path.join(configPath, AUDIODECK_CONFIG);
  await io.write(configFile, renderConfig(sections));

  const mainFile = path.join(configPath, "config.txt");
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
  read: async (file) => {
    try {
      return await readFile(file, "utf8");
    } catch {
      return null;
    }
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
