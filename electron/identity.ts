// Endpoint identity migration. Some drivers (NVIDIA HDMI, VR virtual audio)
// delete their endpoint and recreate it under a NEW id when the device
// re-enumerates; the recreated endpoint comes back wearing its driver-given
// default name. Customizations store that name as a fingerprint, so when a
// customized id disappears and a fresh endpoint appears with the fingerprint
// name, everything (rank position, exclusions, aliases, the customization
// itself) moves to the new id.

import type { Endpoint, EndpointState } from "./audioctl.js";
import type { AudioDeckConfig } from "./config.js";

const STATE_PREFERENCE: EndpointState[] = ["active", "unplugged", "disabled", "notpresent"];

/** Returns the migrated config, or null when nothing needed to move. */
export function migrateIdentities(
  config: AudioDeckConfig,
  endpoints: Endpoint[],
): AudioDeckConfig | null {
  const presentIds = new Set(endpoints.map((e) => e.id));
  let next = config;
  let changed = false;

  for (const [oldId, cust] of Object.entries(config.customizations)) {
    if (presentIds.has(oldId) || cust.fingerprint === undefined) continue;
    const newId = findReincarnation(cust.fingerprint, endpoints, next);
    if (newId === null) continue;
    console.log(`[identity] ${oldId} was recreated as ${newId} ("${cust.fingerprint}")`);
    next = rekey(next, oldId, newId);
    changed = true;
  }

  return changed ? next : null;
}

function findReincarnation(
  fingerprint: string,
  endpoints: Endpoint[],
  config: AudioDeckConfig,
): string | null {
  // Never steal an id that already carries its own customization.
  const candidates = endpoints.filter(
    (e) => e.name === fingerprint && config.customizations[e.id] === undefined,
  );
  for (const state of STATE_PREFERENCE) {
    const inState = candidates.filter((e) => e.state === state);
    if (inState.length === 1) return inState[0]?.id ?? null;
    // Multiple identical twins in the same state: ambiguous, do not guess.
    if (inState.length > 1) return null;
  }
  return null;
}

function rekey(config: AudioDeckConfig, oldId: string, newId: string): AudioDeckConfig {
  const customizations = { ...config.customizations };
  const moved = customizations[oldId];
  delete customizations[oldId];
  if (moved !== undefined) customizations[newId] = moved;

  const aliases = { ...config.aliases };
  if (aliases[oldId] !== undefined) {
    aliases[newId] = aliases[oldId];
    delete aliases[oldId];
  }

  return {
    ...config,
    customizations,
    aliases,
    outputPriority: replaceRank(config.outputPriority, oldId, newId),
    micPriority: replaceRank(config.micPriority, oldId, newId),
    excluded: {
      output: config.excluded.output.map((id) => (id === oldId ? newId : id)),
      mic: config.excluded.mic.map((id) => (id === oldId ? newId : id)),
    },
  };
}

/**
 * Put newId where oldId ranked. If seeding already appended newId as an
 * unrecognized fresh device, that appended slot is dropped so the device
 * keeps its original position instead of jumping to the bottom.
 */
function replaceRank(priority: string[], oldId: string, newId: string): string[] {
  if (!priority.includes(oldId)) return priority;
  return priority.filter((id) => id !== newId).map((id) => (id === oldId ? newId : id));
}
