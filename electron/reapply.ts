// Keep the user's Windows-side customizations alive. Drivers regenerate
// endpoint names, suffixes, form factors, and icons whenever a device
// re-enumerates (HDMI handshakes, VR services, reboots); this detects the
// drift each poll tick and writes the user's values back.

import { execFile } from "node:child_process";
import { splitDeviceName } from "../shared/deviceName.js";
import { deviceTypeByKey } from "../shared/deviceTypes.js";
import type { AudioControl, Endpoint } from "./audioctl.js";
import type { DeviceCustomization } from "./config.js";

/** Per-id failure backoff so a rejecting endpoint is not hammered every tick. */
const failedUntil = new Map<string, number>();
const FAILURE_BACKOFF_TICKS = 30;
const tickCounter = { value: 0 };

export async function reapplyCustomizations(
  audioctl: AudioControl,
  customizations: Record<string, DeviceCustomization>,
  endpoints: Endpoint[],
): Promise<void> {
  tickCounter.value += 1;
  let changed = false;

  for (const [id, wanted] of Object.entries(customizations)) {
    const endpoint = endpoints.find((e) => e.id === id);
    if (endpoint === undefined) continue;
    const backoff = failedUntil.get(id);
    if (backoff !== undefined && tickCounter.value < backoff) continue;

    try {
      changed = (await reapplyOne(audioctl, endpoint, wanted)) || changed;
      failedUntil.delete(id);
    } catch (err) {
      failedUntil.set(id, tickCounter.value + FAILURE_BACKOFF_TICKS);
      console.error(`[reapply] ${id} failed:`, err);
    }
  }

  // Windows applied our writes, but the flyout caches names and glyphs for
  // its process lifetime; bounce it once per tick batch that changed things.
  if (changed) restartShellHost();
}

async function reapplyOne(
  audioctl: AudioControl,
  endpoint: Endpoint,
  wanted: DeviceCustomization,
): Promise<boolean> {
  let changed = false;

  const parts = splitDeviceName(endpoint.name);
  const nameDrifted = wanted.name !== undefined && parts.title !== wanted.name;
  const suffixDrifted = wanted.suffix !== undefined && parts.detail !== wanted.suffix;
  if (nameDrifted || suffixDrifted) {
    console.log(`[reapply] restoring name of ${endpoint.id} ("${endpoint.name}")`);
    await audioctl.rename(endpoint.id, wanted.name ?? parts.title, wanted.suffix);
    changed = true;
  }

  if (wanted.typeKey !== undefined) {
    const type = deviceTypeByKey(wanted.typeKey);
    if (type !== undefined && endpoint.formFactor !== type.formFactor) {
      console.log(`[reapply] restoring type of ${endpoint.id} to ${type.key}`);
      await audioctl.setType(endpoint.id, type.formFactor, type.iconPath);
      changed = true;
    }
  }

  return changed;
}

/** Kill ShellHost (quick-settings host); Windows respawns it on demand. */
export function restartShellHost(): void {
  // Never touch the real shell from e2e/screenshot runs.
  if (process.env.AUDIODECK_TEST_MODE === "1") return;
  execFile("taskkill", ["/F", "/IM", "ShellHost.exe"], { windowsHide: true }, (err) => {
    if (err !== null) console.log("[reapply] ShellHost restart skipped:", err.message);
  });
}
