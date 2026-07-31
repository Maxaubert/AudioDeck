// Autostart with Windows via the HKCU Run key, on by default, toggleable in UI.
// Uses reg.exe so no native module is needed; HKCU writes need no elevation.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const RUN_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const VALUE_NAME = "AudioDeck";

/** The command the Run key launches: this executable, quoted against spaces. */
function launchCommand(): string {
  return `"${process.execPath}"`;
}

export async function isAutostartEnabled(): Promise<boolean> {
  try {
    await execFileAsync("reg.exe", ["query", RUN_KEY, "/v", VALUE_NAME], {
      windowsHide: true,
    });
    return true;
  } catch {
    // reg query exits 1 when the value does not exist.
    return false;
  }
}

export async function setAutostart(enabled: boolean): Promise<void> {
  if (enabled) {
    await execFileAsync(
      "reg.exe",
      ["add", RUN_KEY, "/v", VALUE_NAME, "/t", "REG_SZ", "/d", launchCommand(), "/f"],
      { windowsHide: true },
    );
    return;
  }
  try {
    await execFileAsync("reg.exe", ["delete", RUN_KEY, "/v", VALUE_NAME, "/f"], {
      windowsHide: true,
    });
  } catch {
    // Already absent: disabling is idempotent.
  }
}
