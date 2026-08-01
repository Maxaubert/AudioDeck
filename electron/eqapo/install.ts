// Runs the bundled Equalizer APO setup.
//
// The installer's manifest requires administrator (confirmed 2026-08-01: an
// unelevated spawn fails outright), so it goes through ShellExecute with the
// runas verb. That raises the prompt for the child process alone and leaves
// AudioDeck itself running unelevated, as it does the rest of the time.
//
// Its device page is shown rather than passing /S. Silent would be tidier, but
// the install log on this machine showed it failing a device and retrying
// across install modes, and that fallback is undocumented. Owning it here
// would mean owning the case where it goes wrong, which is a device with no
// audio at all.

import { app, shell } from "electron";
import path from "node:path";
import { access } from "node:fs/promises";

export function equalizerApoSetupPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "vendor", "equalizerapo-setup.exe");
  }
  return path.join(app.getAppPath(), "vendor", "equalizerapo-setup.exe");
}

export interface InstallOutcome {
  started: boolean;
  /** Set when the setup could not be launched at all. */
  error?: string;
}

/**
 * Launch the setup. Resolves as soon as it starts, not when it finishes: the
 * user is now in a separate installer and AudioDeck's job is to stay out of
 * the way and re-detect afterwards.
 */
export async function runEqualizerApoSetup(): Promise<InstallOutcome> {
  const setup = equalizerApoSetupPath();
  try {
    await access(setup);
  } catch {
    return {
      started: false,
      error:
        `The audio effects setup is missing from this installation (${setup}). ` +
        "Reinstall AudioDeck, or install Equalizer APO yourself.",
    };
  }

  // openPath goes through ShellExecute, which honours the manifest's
  // requestedExecutionLevel and raises the elevation prompt.
  const failure = await shell.openPath(setup);
  if (failure !== "") return { started: false, error: failure };
  return { started: true };
}
