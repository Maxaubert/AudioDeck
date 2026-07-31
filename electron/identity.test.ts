// Identity migration: recreated endpoints (new id, driver-default name) must
// inherit the dead id's rank and customizations, and never guess when the
// fingerprint is ambiguous.

import { describe, expect, it } from "vitest";
import { defaultConfig } from "./config.js";
import { migrateIdentities, migrateSupersessions } from "./identity.js";
import type { AudioDeckConfig } from "./config.js";
import type { Endpoint, EndpointState } from "./audioctl.js";

function endpoint(id: string, name: string, state: EndpointState = "active"): Endpoint {
  return {
    id,
    name,
    flow: "render",
    state,
    isDefault: false,
    isDefaultComms: false,
    formFactor: 1,
    association: "{1}.HDAUDIO\\FUNC_01",
    volume: 50,
    mute: false,
  };
}

function config(overrides: Partial<AudioDeckConfig>): AudioDeckConfig {
  return { ...defaultConfig(), ...overrides };
}

describe("migrateIdentities", () => {
  it("moves rank position, customization, and exclusion to the recreated id", () => {
    const cfg = config({
      outputPriority: ["{a}", "{old}", "{b}", "{new}"],
      customizations: { "{old}": { name: "LG", fingerprint: "LG TV (NVIDIA)" } },
    });
    const result = migrateIdentities(cfg, [
      endpoint("{a}", "A"),
      endpoint("{b}", "B"),
      endpoint("{new}", "LG TV (NVIDIA)"),
    ]);
    expect(result).not.toBeNull();
    // The recreated id takes the old slot; its seeded bottom slot is dropped.
    expect(result?.outputPriority).toEqual(["{a}", "{new}", "{b}"]);
    expect(result?.customizations["{new}"]).toEqual({ name: "LG", fingerprint: "LG TV (NVIDIA)" });
    expect(result?.customizations["{old}"]).toBeUndefined();
  });

  it("prefers an active candidate over a notpresent twin", () => {
    const cfg = config({
      outputPriority: ["{old}"],
      customizations: { "{old}": { name: "LG", fingerprint: "LG TV (NVIDIA)" } },
    });
    const result = migrateIdentities(cfg, [
      endpoint("{ghost}", "LG TV (NVIDIA)", "notpresent"),
      endpoint("{live}", "LG TV (NVIDIA)", "active"),
    ]);
    expect(result?.outputPriority).toEqual(["{live}"]);
  });

  it("does not guess between identical twins in the same state", () => {
    const cfg = config({
      customizations: { "{old}": { name: "X", fingerprint: "NVIDIA Output (NVIDIA)" } },
    });
    const result = migrateIdentities(cfg, [
      endpoint("{t1}", "NVIDIA Output (NVIDIA)", "notpresent"),
      endpoint("{t2}", "NVIDIA Output (NVIDIA)", "notpresent"),
    ]);
    expect(result).toBeNull();
  });

  it("no-ops on the leftover twin case, which the id is 'present' in", () => {
    // The reported bug: the recreated endpoint kept the user's renamed
    // description, so no candidate wears the fingerprint, and the dead id is
    // still enumerable as notpresent. Supersession is what fixes this one.
    const cfg = config({
      outputPriority: ["{old}", "{new}"],
      customizations: { "{old}": { name: "LG", fingerprint: "LG TV SSCR2 (NVIDIA)" } },
    });
    const result = migrateIdentities(cfg, [
      endpoint("{old}", "LG (NVIDIA)", "notpresent"),
      endpoint("{new}", "LG (NVIDIA)", "active"),
    ]);
    expect(result).toBeNull();
  });

  it("leaves customized candidates alone and no-ops when the id is present", () => {
    const cfg = config({
      customizations: {
        "{old}": { name: "X", fingerprint: "Twin" },
        "{taken}": { name: "Y" },
      },
    });
    expect(migrateIdentities(cfg, [endpoint("{taken}", "Twin")])).toBeNull();
    const present = config({
      customizations: { "{old}": { name: "X", fingerprint: "Twin" } },
    });
    expect(migrateIdentities(present, [endpoint("{old}", "Whatever")])).toBeNull();
  });
});

describe("migrateSupersessions", () => {
  const supersession = [{ ghostId: "{old}", liveId: "{new}" }];

  it("moves everything the dead id carried onto the live id", () => {
    const cfg = config({
      outputPriority: ["{a}", "{old}", "{b}", "{new}"],
      customizations: { "{old}": { name: "LG", typeKey: "tv", fingerprint: "LG TV SSCR2" } },
      aliases: { "{old}": "Telly" },
      excluded: { output: [], mic: ["{old}"] },
      volumeLocked: ["{old}"],
      hiddenDevices: ["{old}"],
    });
    const result = migrateSupersessions(cfg, supersession);
    expect(result).not.toBeNull();
    // The live id takes the dead id's slot; its own appended slot is dropped,
    // so the device is ranked once instead of twice.
    expect(result?.outputPriority).toEqual(["{a}", "{new}", "{b}"]);
    expect(result?.customizations).toEqual({
      "{new}": { name: "LG", typeKey: "tv", fingerprint: "LG TV SSCR2" },
    });
    expect(result?.aliases).toEqual({ "{new}": "Telly" });
    expect(result?.excluded.mic).toEqual(["{new}"]);
    expect(result?.volumeLocked).toEqual(["{new}"]);
    expect(result?.hiddenDevices).toEqual(["{new}"]);
  });

  it("never overwrites settings the live id already has of its own", () => {
    const cfg = config({
      customizations: { "{old}": { name: "Old" }, "{new}": { name: "New" } },
      aliases: { "{old}": "old", "{new}": "new" },
    });
    const result = migrateSupersessions(cfg, supersession);
    expect(result?.customizations).toEqual({ "{new}": { name: "New" } });
    expect(result?.aliases).toEqual({ "{new}": "new" });
  });

  it("returns null when the dead id carried nothing, so no save churns", () => {
    const cfg = config({ outputPriority: ["{new}"] });
    expect(migrateSupersessions(cfg, supersession)).toBeNull();
    expect(migrateSupersessions(cfg, [])).toBeNull();
  });
});
