// Endpoint identity migration. Some drivers (NVIDIA HDMI, VR virtual audio)
// delete their endpoint and recreate it under a NEW id when the device
// re-enumerates; the recreated endpoint comes back wearing its driver-given
// default name. Customizations store that name as a fingerprint, so when a
// customized id disappears and a fresh endpoint appears with the fingerprint
// name, everything (rank position, exclusions, aliases, the customization
// itself) moves to the new id.

import type { Endpoint, EndpointState } from "./audioctl.js";
import type { AudioDeckConfig } from "./config.js";
import type { Supersession } from "./dedupe.js";

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

/**
 * Move settings off endpoint ids that Windows superseded (see dedupe.ts). This
 * is the reliable half of identity migration: the fingerprint above only fires
 * when the dead id vanishes AND the replacement wears the driver's name, and
 * neither holds for an endpoint Windows merely remembers as notpresent while
 * the replacement inherited the user's own name.
 *
 * Returns the migrated config, or null when nothing needed to move.
 */
export function migrateSupersessions(
  config: AudioDeckConfig,
  supersessions: readonly Supersession[],
): AudioDeckConfig | null {
  let next = config;
  let changed = false;

  for (const { ghostId, liveId } of supersessions) {
    if (!carriesSettings(next, ghostId)) continue;
    console.log(`[identity] ${ghostId} was superseded by ${liveId}`);
    next = rekey(next, ghostId, liveId);
    changed = true;
  }

  return changed ? next : null;
}

function carriesSettings(config: AudioDeckConfig, id: string): boolean {
  return (
    config.customizations[id] !== undefined ||
    config.aliases[id] !== undefined ||
    config.outputPriority.includes(id) ||
    config.micPriority.includes(id) ||
    config.excluded.output.includes(id) ||
    config.excluded.mic.includes(id) ||
    config.volumeLocked.includes(id) ||
    config.hiddenDevices.includes(id)
  );
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

/**
 * Move everything keyed on oldId onto newId. Settings newId already has of its
 * own always win: the live endpoint's own name is never replaced by the name
 * of the dead id it happens to supersede.
 */
function rekey(config: AudioDeckConfig, oldId: string, newId: string): AudioDeckConfig {
  const customizations = { ...config.customizations };
  const movedCustomization = customizations[oldId];
  delete customizations[oldId];
  if (movedCustomization !== undefined && customizations[newId] === undefined) {
    customizations[newId] = movedCustomization;
  }

  const aliases = { ...config.aliases };
  const movedAlias = aliases[oldId];
  delete aliases[oldId];
  if (movedAlias !== undefined && aliases[newId] === undefined) aliases[newId] = movedAlias;

  return {
    ...config,
    customizations,
    aliases,
    outputPriority: replaceRank(config.outputPriority, oldId, newId),
    micPriority: replaceRank(config.micPriority, oldId, newId),
    excluded: {
      output: replaceMember(config.excluded.output, oldId, newId),
      mic: replaceMember(config.excluded.mic, oldId, newId),
    },
    volumeLocked: replaceMember(config.volumeLocked, oldId, newId),
    hiddenDevices: replaceMember(config.hiddenDevices, oldId, newId),
  };
}

/** Swap oldId for newId in an unordered id set, without duplicating newId. */
function replaceMember(ids: string[], oldId: string, newId: string): string[] {
  if (!ids.includes(oldId)) return ids;
  return [...new Set(ids.map((id) => (id === oldId ? newId : id)))];
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
