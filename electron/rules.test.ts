import { describe, expect, it } from "vitest";
import { decide, diffEvents, pickWinner, seedPriorityList } from "./rules.js";
import type { DeviceAvailability } from "./availability.js";
import type { Endpoint, EndpointFlow, EndpointState } from "./audioctl.js";

function endpoint(
  id: string,
  overrides: Partial<Endpoint> = {},
): Endpoint {
  return {
    id,
    name: `Device ${id}`,
    flow: "render" as EndpointFlow,
    state: "active" as EndpointState,
    isDefault: false,
    isDefaultComms: false,
    volume: 50,
    mute: false,
    ...overrides,
    formFactor: overrides.formFactor ?? 1,
  };
}

function avail(id: string, available: boolean, overrides: Partial<Endpoint> = {}): DeviceAvailability {
  return {
    endpoint: endpoint(id, overrides),
    available,
    reason: available ? "endpoint-active" : "endpoint-inactive",
  };
}

describe("seedPriorityList", () => {
  it("seeds first run with the current default first, then enumeration order", () => {
    const endpoints = [
      endpoint("{a}"),
      endpoint("{b}", { isDefault: true }),
      endpoint("{c}"),
    ];
    expect(seedPriorityList([], endpoints, "render")).toEqual(["{b}", "{a}", "{c}"]);
  });

  it("seeds first run in plain enumeration order when nothing is default", () => {
    const endpoints = [endpoint("{a}"), endpoint("{b}"), endpoint("{c}")];
    expect(seedPriorityList([], endpoints, "render")).toEqual(["{a}", "{b}", "{c}"]);
  });

  it("only seeds endpoints of the requested flow", () => {
    const endpoints = [
      endpoint("{out}", { isDefault: true }),
      endpoint("{mic}", { flow: "capture", isDefault: true }),
      endpoint("{out2}"),
    ];
    expect(seedPriorityList([], endpoints, "render")).toEqual(["{out}", "{out2}"]);
    expect(seedPriorityList([], endpoints, "capture")).toEqual(["{mic}"]);
  });

  it("seeds an empty list when the flow has no endpoints", () => {
    expect(seedPriorityList([], [endpoint("{mic}", { flow: "capture" })], "render")).toEqual([]);
  });

  it("seeds only active endpoints, ghosts stay out", () => {
    const endpoints = [
      endpoint("{a}", { isDefault: true }),
      endpoint("{b}", { state: "disabled", volume: null, mute: null }),
      endpoint("{c}", { state: "unplugged", volume: null, mute: null }),
      endpoint("{d}", { state: "notpresent", volume: null, mute: null }),
    ];
    expect(seedPriorityList([], endpoints, "render")).toEqual(["{a}"]);
  });

  it("does not append non-active endpoints to an existing list", () => {
    const endpoints = [
      endpoint("{a}"),
      endpoint("{ghost}", { state: "notpresent", volume: null, mute: null }),
    ];
    expect(seedPriorityList(["{a}"], endpoints, "render")).toEqual(["{a}"]);
  });

  it("keeps ranked entries even while their endpoint is inactive", () => {
    const endpoints = [endpoint("{a}", { state: "notpresent", volume: null, mute: null })];
    expect(seedPriorityList(["{a}"], endpoints, "render")).toEqual(["{a}"]);
  });

  it("never re-adds excluded devices", () => {
    const endpoints = [endpoint("{a}"), endpoint("{removed}")];
    expect(seedPriorityList(["{a}"], endpoints, "render", ["{removed}"])).toEqual(["{a}"]);
    expect(seedPriorityList([], endpoints, "render", ["{removed}"])).toEqual(["{a}"]);
  });

  it("appends new devices to the bottom in enumeration order", () => {
    const endpoints = [
      endpoint("{new2}"),
      endpoint("{a}"),
      endpoint("{new1}"),
      endpoint("{b}"),
    ];
    expect(seedPriorityList(["{b}", "{a}"], endpoints, "render")).toEqual([
      "{b}",
      "{a}",
      "{new2}",
      "{new1}",
    ]);
  });

  it("keeps the user's order untouched, even when the default differs", () => {
    const endpoints = [endpoint("{a}", { isDefault: true }), endpoint("{b}")];
    expect(seedPriorityList(["{b}", "{a}"], endpoints, "render")).toEqual(["{b}", "{a}"]);
  });

  it("keeps a slot for devices that have disappeared", () => {
    const endpoints = [endpoint("{a}")];
    expect(seedPriorityList(["{gone}", "{a}"], endpoints, "render")).toEqual(["{gone}", "{a}"]);
  });

  it("does not duplicate ids already in the list", () => {
    const endpoints = [endpoint("{a}"), endpoint("{b}")];
    expect(seedPriorityList(["{a}", "{b}"], endpoints, "render")).toEqual(["{a}", "{b}"]);
  });

  it("returns the same list when nothing changed", () => {
    const existing = ["{a}"];
    expect(seedPriorityList(existing, [endpoint("{a}")], "render")).toBe(existing);
  });
});

describe("pickWinner", () => {
  it("picks the highest-priority available device", () => {
    const availability = [avail("{a}", true), avail("{b}", true)];
    expect(pickWinner(["{a}", "{b}"], availability)).toBe("{a}");
  });

  it("skips unavailable higher-priority devices", () => {
    const availability = [avail("{a}", false), avail("{b}", true), avail("{c}", true)];
    expect(pickWinner(["{a}", "{b}", "{c}"], availability)).toBe("{b}");
  });

  it("returns null when nothing in the list is available", () => {
    const availability = [avail("{a}", false), avail("{b}", false)];
    expect(pickWinner(["{a}", "{b}"], availability)).toBeNull();
  });

  it("returns null for an empty priority list", () => {
    expect(pickWinner([], [avail("{a}", true)])).toBeNull();
  });

  it("treats priority entries missing from the snapshot as unavailable", () => {
    const availability = [avail("{b}", true)];
    expect(pickWinner(["{gone}", "{b}"], availability)).toBe("{b}");
  });

  it("ignores available devices that are not in the priority list", () => {
    const availability = [avail("{stranger}", true), avail("{a}", false)];
    expect(pickWinner(["{a}"], availability)).toBeNull();
  });
});

describe("diffEvents", () => {
  it("returns no events when nothing changed", () => {
    const snapshot = [avail("{a}", true), avail("{b}", false)];
    expect(diffEvents(snapshot, snapshot)).toEqual([]);
  });

  it("reports a device becoming unavailable", () => {
    expect(diffEvents([avail("{a}", true)], [avail("{a}", false)])).toEqual([
      { endpointId: "{a}", flow: "render", becameAvailable: false },
    ]);
  });

  it("reports a device becoming available", () => {
    expect(diffEvents([avail("{a}", false)], [avail("{a}", true)])).toEqual([
      { endpointId: "{a}", flow: "render", becameAvailable: true },
    ]);
  });

  it("reports a brand-new device arriving available", () => {
    expect(diffEvents([], [avail("{new}", true)])).toEqual([
      { endpointId: "{new}", flow: "render", becameAvailable: true },
    ]);
  });

  it("stays silent for a brand-new device arriving unavailable", () => {
    expect(diffEvents([], [avail("{new}", false)])).toEqual([]);
  });

  it("reports a device that vanished while available as now unavailable", () => {
    expect(diffEvents([avail("{a}", true)], [])).toEqual([
      { endpointId: "{a}", flow: "render", becameAvailable: false },
    ]);
  });

  it("stays silent for a device that vanished while unavailable", () => {
    expect(diffEvents([avail("{a}", false)], [])).toEqual([]);
  });

  it("reports several simultaneous transitions", () => {
    const previous = [avail("{a}", true), avail("{b}", false), avail("{c}", true)];
    const current = [avail("{a}", false), avail("{b}", true), avail("{c}", true)];
    expect(diffEvents(previous, current)).toEqual([
      { endpointId: "{a}", flow: "render", becameAvailable: false },
      { endpointId: "{b}", flow: "render", becameAvailable: true },
    ]);
  });

  it("carries the endpoint's flow on each event", () => {
    const previous = [avail("{mic}", false, { flow: "capture" })];
    const current = [avail("{mic}", true, { flow: "capture" })];
    expect(diffEvents(previous, current)).toEqual([
      { endpointId: "{mic}", flow: "capture", becameAvailable: true },
    ]);
  });
});

describe("decide", () => {
  const noop = { setDefaultTo: null, engageOverride: false, releaseOverride: false };

  it("does nothing in steady state (default is the winner, no events)", () => {
    const availability = [avail("{a}", true), avail("{b}", true)];
    expect(decide(["{a}", "{b}"], availability, [], "{a}", false)).toEqual(noop);
  });

  it("dissolves a held override once the default is the winner again", () => {
    const availability = [avail("{a}", true), avail("{b}", true)];
    expect(decide(["{a}", "{b}"], availability, [], "{a}", true)).toEqual({
      setDefaultTo: null,
      engageOverride: false,
      releaseOverride: true,
    });
    // Still deviating: the hold stays.
    expect(decide(["{a}", "{b}"], availability, [], "{b}", true)).toEqual(noop);
  });

  it("applies the winner when an availability event changes the picture", () => {
    const availability = [avail("{headset}", true), avail("{speakers}", true)];
    const events = [{ endpointId: "{headset}", flow: "render" as const, becameAvailable: true }];
    expect(decide(["{headset}", "{speakers}"], availability, events, "{speakers}", false)).toEqual({
      setDefaultTo: "{headset}",
      engageOverride: false,
      releaseOverride: false,
    });
  });

  it("falls back down the list when the winner becomes unavailable", () => {
    const availability = [avail("{headset}", false), avail("{speakers}", true)];
    const events = [{ endpointId: "{headset}", flow: "render" as const, becameAvailable: false }];
    expect(decide(["{headset}", "{speakers}"], availability, events, "{headset}", false)).toEqual({
      setDefaultTo: "{speakers}",
      engageOverride: false,
      releaseOverride: false,
    });
  });

  it("holds an active override when no availability event occurs", () => {
    const availability = [avail("{headset}", true), avail("{speakers}", true)];
    expect(decide(["{headset}", "{speakers}"], availability, [], "{speakers}", true)).toEqual(noop);
  });

  it("releases the override and re-applies the list on the next availability event", () => {
    const availability = [avail("{headset}", true), avail("{speakers}", true), avail("{tv}", true)];
    const events = [{ endpointId: "{tv}", flow: "render" as const, becameAvailable: true }];
    expect(
      decide(["{headset}", "{speakers}", "{tv}"], availability, events, "{speakers}", true),
    ).toEqual({
      setDefaultTo: "{headset}",
      engageOverride: false,
      releaseOverride: true,
    });
  });

  it("releases the override without switching when the winner is already default", () => {
    const availability = [avail("{headset}", true), avail("{speakers}", true)];
    const events = [{ endpointId: "{speakers}", flow: "render" as const, becameAvailable: true }];
    expect(decide(["{headset}", "{speakers}"], availability, events, "{headset}", true)).toEqual({
      setDefaultTo: null,
      engageOverride: false,
      releaseOverride: true,
    });
  });

  it("releases the override on an event even when nothing is available to switch to", () => {
    const availability = [avail("{headset}", false)];
    const events = [{ endpointId: "{headset}", flow: "render" as const, becameAvailable: false }];
    expect(decide(["{headset}"], availability, events, "{headset}", true)).toEqual({
      setDefaultTo: null,
      engageOverride: false,
      releaseOverride: true,
    });
  });

  it("engages the override when the default moved to an available non-winner with no event", () => {
    const availability = [avail("{headset}", true), avail("{speakers}", true)];
    expect(decide(["{headset}", "{speakers}"], availability, [], "{speakers}", false)).toEqual({
      setDefaultTo: null,
      engageOverride: true,
      releaseOverride: false,
    });
  });

  it("retries the winner instead of engaging when the deviating default did not move", () => {
    // Our own set-default failed last tick: the default deviates but has not
    // moved since the previous observation, so this is not a manual change.
    const availability = [avail("{headset}", true), avail("{speakers}", true)];
    expect(decide(["{headset}", "{speakers}"], availability, [], "{speakers}", false, false)).toEqual({
      setDefaultTo: "{headset}",
      engageOverride: false,
      releaseOverride: false,
    });
  });

  it("engages the override for a manual pick outside the priority list", () => {
    const availability = [avail("{headset}", true), avail("{stranger}", true)];
    expect(decide(["{headset}"], availability, [], "{stranger}", false)).toEqual({
      setDefaultTo: null,
      engageOverride: true,
      releaseOverride: false,
    });
  });

  it("repairs a default stranded on an unavailable device instead of engaging override", () => {
    const availability = [avail("{headset}", false), avail("{speakers}", true)];
    expect(decide(["{headset}", "{speakers}"], availability, [], "{headset}", false)).toEqual({
      setDefaultTo: "{speakers}",
      engageOverride: false,
      releaseOverride: false,
    });
  });

  it("applies the winner when there is no current default at all", () => {
    const availability = [avail("{speakers}", true)];
    expect(decide(["{speakers}"], availability, [], null, false)).toEqual({
      setDefaultTo: "{speakers}",
      engageOverride: false,
      releaseOverride: false,
    });
  });

  it("does nothing when nothing is available and no event fired", () => {
    const availability = [avail("{headset}", false)];
    expect(decide(["{headset}"], availability, [], "{headset}", false)).toEqual(noop);
  });

  it("does not release an inactive override on an event", () => {
    const availability = [avail("{headset}", true)];
    const events = [{ endpointId: "{headset}", flow: "render" as const, becameAvailable: true }];
    expect(decide(["{headset}"], availability, events, "{headset}", false)).toEqual(noop);
  });
});
