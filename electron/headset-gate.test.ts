import { describe, expect, it } from "vitest";
import {
  IDLE_PROBE_MS,
  endpointFingerprint,
  knownHeadsetPresent,
  shouldQueryHeadsets,
} from "./headset-gate.js";
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

describe("knownHeadsetPresent", () => {
  const NOVA = String.raw`{1}.USB\VID_1038&PID_12E0&MI_00\7&771F741&0&0000`;
  const known = new Set(["1038:12e0"]);

  it("is false before any headset has answered", () => {
    expect(knownHeadsetPresent([{ state: "active", association: NOVA }], new Set())).toBe(false);
  });

  it("stays true while the known dongle is plugged in, on any port", () => {
    const otherPort = String.raw`{1}.USB\VID_1038&PID_12E0&MI_00\8&1234ABCD&0&0000`;
    expect(knownHeadsetPresent([{ state: "active", association: otherPort }], known)).toBe(true);
  });

  it("is false once only leftovers of the dongle remain", () => {
    expect(knownHeadsetPresent([{ state: "notpresent", association: NOVA }], known)).toBe(false);
  });

  it("ignores endpoints without USB ids or of other models", () => {
    const endpoints = [
      { state: "active", association: null },
      { state: "active", association: String.raw`{1}.USB\VID_0B05&PID_1B9B&MI_00\9&1&0&0000` },
    ];
    expect(knownHeadsetPresent(endpoints, known)).toBe(false);
  });
});
