import { describe, expect, it } from "vitest";
import { IDLE_PROBE_MS, endpointFingerprint, shouldQueryHeadsets } from "./headset-gate.js";
import type { GateState } from "./headset-gate.js";

const ENDPOINTS = [
  { id: "a", state: "active" },
  { id: "b", state: "unplugged" },
];

function gate(overrides: Partial<GateState> = {}): GateState {
  return {
    relevant: false,
    probedAt: 1_000_000,
    endpointKey: endpointFingerprint(ENDPOINTS),
    ...overrides,
  };
}

describe("endpointFingerprint", () => {
  it("ignores enumeration order", () => {
    expect(endpointFingerprint(ENDPOINTS)).toBe(endpointFingerprint([...ENDPOINTS].reverse()));
  });

  it("changes when an endpoint changes state", () => {
    const moved = [{ id: "a", state: "active" }, { id: "b", state: "active" }];
    expect(endpointFingerprint(moved)).not.toBe(endpointFingerprint(ENDPOINTS));
  });
});

describe("shouldQueryHeadsets", () => {
  const key = endpointFingerprint(ENDPOINTS);

  it("always asks before anything is known", () => {
    expect(shouldQueryHeadsets(null, key, 0)).toBe(true);
  });

  it("never slows down while a supported headset is present", () => {
    // The whole feature is noticing that headset powering off, and a quiet
    // powered-on headset is exactly the state that precedes it.
    const state = gate({ relevant: true, probedAt: 1_000_000 });
    expect(shouldQueryHeadsets(state, key, 1_000_001)).toBe(true);
  });

  it("skips the query when nothing supported was found", () => {
    expect(shouldQueryHeadsets(gate(), key, 1_000_001)).toBe(false);
  });

  it("re-probes as soon as the hardware changes", () => {
    // Plugging a dongle in changes the endpoint list, so this is what makes
    // the skip responsive rather than merely cheap.
    expect(shouldQueryHeadsets(gate(), `${key} c:active`, 1_000_001)).toBe(true);
  });

  it("re-probes on its own eventually, to catch anything missed", () => {
    const state = gate({ probedAt: 1_000_000 });
    expect(shouldQueryHeadsets(state, key, 1_000_000 + IDLE_PROBE_MS - 1)).toBe(false);
    expect(shouldQueryHeadsets(state, key, 1_000_000 + IDLE_PROBE_MS)).toBe(true);
  });
});
