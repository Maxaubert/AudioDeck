// Identity migration: recreated endpoints (new id, driver-default name) must
// inherit the dead id's rank and customizations, and never guess when the
// fingerprint is ambiguous.

import { describe, expect, it } from "vitest";
import { defaultConfig } from "./config.js";
import { migrateIdentities } from "./identity.js";
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
