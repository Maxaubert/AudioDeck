import { describe, expect, it } from "vitest";
import { partitionDevices } from "./deviceOrder.js";
import type { DeviceView } from "../../../shared/ipc.js";

function device(overrides: Partial<DeviceView> & { id: string }): DeviceView {
  return {
    name: overrides.id,
    alias: null,
    flow: "render",
    state: "active",
    isDefault: false,
    isDefaultComms: false,
    formFactor: null,
    volume: 50,
    mute: false,
    volumeLocked: false,
    available: true,
    availabilityReason: "endpoint-active",
    ...overrides,
  };
}

const ids = (list: DeviceView[]): string[] => list.map((d) => d.id);

describe("partitionDevices", () => {
  it("puts ranked devices first, in priority order", () => {
    const devices = [device({ id: "a" }), device({ id: "b" }), device({ id: "c" })];
    const { ranked, unranked } = partitionDevices(devices, ["c", "a"], "render");
    expect(ids(ranked)).toEqual(["c", "a"]);
    expect(ids(unranked)).toEqual(["b"]);
  });

  it("skips priority ids Windows no longer reports", () => {
    // A stale id must not render as a hole in the numbering.
    const devices = [device({ id: "a" })];
    const { ranked } = partitionDevices(devices, ["gone", "a"], "render");
    expect(ids(ranked)).toEqual(["a"]);
  });

  it("keeps enumeration order for the unranked remainder", () => {
    const devices = [device({ id: "a" }), device({ id: "b" }), device({ id: "c" })];
    const { unranked } = partitionDevices(devices, [], "render");
    expect(ids(unranked)).toEqual(["a", "b", "c"]);
  });

  it("separates remembered endpoints even when they are ranked", () => {
    // The ghost toggle is only honest if a ranked ghost hides with the rest.
    const devices = [device({ id: "live" }), device({ id: "ghost", state: "notpresent" })];
    const { ranked, unranked, ghosts } = partitionDevices(devices, ["ghost", "live"], "render");
    expect(ids(ranked)).toEqual(["live"]);
    expect(ids(unranked)).toEqual([]);
    expect(ids(ghosts)).toEqual(["ghost"]);
  });

  it("keeps disabled and unplugged endpoints in the list", () => {
    const devices = [
      device({ id: "off", state: "disabled" }),
      device({ id: "out", state: "unplugged" }),
    ];
    const { unranked, ghosts } = partitionDevices(devices, [], "render");
    expect(ids(unranked)).toEqual(["off", "out"]);
    expect(ghosts).toEqual([]);
  });

  it("ignores the other flow entirely", () => {
    const devices = [device({ id: "out" }), device({ id: "mic", flow: "capture" })];
    // A capture id in the render priority list must not pull the mic in.
    const { ranked, unranked } = partitionDevices(devices, ["mic", "out"], "render");
    expect(ids(ranked)).toEqual(["out"]);
    expect(ids(unranked)).toEqual([]);
  });

  it("puts everything in unranked when nothing is ranked", () => {
    const devices = [device({ id: "a" }), device({ id: "b" })];
    const { ranked, unranked } = partitionDevices(devices, [], "render");
    expect(ranked).toEqual([]);
    expect(ids(unranked)).toEqual(["a", "b"]);
  });
});
