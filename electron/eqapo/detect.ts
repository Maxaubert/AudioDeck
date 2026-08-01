// Finds the Equalizer APO installation, or reports that there is not one.
//
// Both values come from the registry rather than a hardcoded path, because the
// install location is user-selectable (proven live 2026-08-01: a fresh install
// writes InstallPath and ConfigPath under HKLM\SOFTWARE\EqualizerAPO).
//
// Registry access is a spawned `reg query`, which keeps this dependency-free
// and matches how the rest of the daemon reaches outside Node.

import { execQuiet } from "../spawn-quiet.js";

export const EQAPO_REGISTRY_KEY = "HKLM\\SOFTWARE\\EqualizerAPO";

export interface EqApoInstall {
  installPath: string;
  /** Where config.txt lives. Read, never assumed to be installPath\config. */
  configPath: string;
}

export interface DetectDeps {
  /** Returns the raw text of a `reg query` for one key, or null if absent. */
  queryRegistry: (key: string) => Promise<string | null>;
}

/**
 * Pull one value out of `reg query` output. Lines look like:
 *
 *     ConfigPath    REG_SZ    C:\Program Files\EqualizerAPO\config
 *
 * The value itself may contain spaces, so everything after the type is taken
 * verbatim rather than split on whitespace.
 */
export function parseRegValue(output: string, name: string): string | null {
  for (const line of output.split(/\r?\n/)) {
    const found = new RegExp(`^\\s*${name}\\s+REG_[A-Z_]+\\s+(.*)$`, "i").exec(line);
    if (found !== null) {
      const value = (found[1] ?? "").trim();
      if (value !== "") return value;
    }
  }
  return null;
}

export async function detectEqApo(deps: DetectDeps): Promise<EqApoInstall | null> {
  const output = await deps.queryRegistry(EQAPO_REGISTRY_KEY);
  if (output === null) return null;

  const installPath = parseRegValue(output, "InstallPath");
  const configPath = parseRegValue(output, "ConfigPath");
  // Both are written by the installer. Missing either means something is
  // half-installed, which is not something to guess our way through.
  if (installPath === null || configPath === null) return null;
  return { installPath, configPath };
}

/** The real registry reader. Absent key exits non-zero, which is not an error. */
export async function queryRegistry(key: string): Promise<string | null> {
  try {
    const { stdout } = await execQuiet("reg.exe", ["query", key], 5000);
    return stdout;
  } catch {
    return null;
  }
}
