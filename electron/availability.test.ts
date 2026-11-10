import { describe, expect, it } from "vitest";
import { HEADSET_MEMORY_MS, HeadsetPowerMemory, evaluateAvailability } from "./availability.js";
import type { Endpoint } from "./audioctl.js";
import type { BatteryStatus, HeadsetSnapshot } from "./headsetcontrol.js";

const HEADSET: Endpoint = {
  id: "nova",
  name: "Steelseries (Arctis Nova Pro Wireless)",
  flow: "render",
  state: "active",
  isDefault: false,
  isDefaultComms: false,
  formFactor: 3,
  association: String.raw`{1}.USB\VID_1038&PID_12E0&MI_00\7&771F741&0&0000`,
  volume: 100,
  mute: false,
} as Endpoint;

function snapshot(status: BatteryStatus | null): HeadsetSnapshot {
  if (status === null) return { version: "4.0.0", devices: [] };
  return {
    version: "4.0.0",
    devices: [
      {
        status: "partial",
        device: "SteelSeries Arctis Nova Pro Wireless",
        vendor: "SteelSeries",
        product: "Arctis Nova Pro Wireless",
        id_vendor: "0x1038",
        id_product: "0x12e0",
        capabilities: ["CAP_BATTERY_STATUS"],
        battery: { status, level: -1 },
      },
    ],
  };
}

function reason(headsets: HeadsetSnapshot | null, memory: HeadsetPowerMemory, now: number) {
  return evaluateAvailability([HEADSET], headsets, memory, now)[0]?.reason;
}

describe("evaluateAvailability with headset memory", () => {
  it("keeps a headset off when the next query misses it (dongle replug)", () => {
    const memory = new HeadsetPowerMemory();
    expect(reason(snapshot("BATTERY_UNAVAILABLE"), memory, 0)).toBe("headset-off");
    expect(reason(snapshot(null), memory, 2_000)).toBe("headset-off");
    expect(reason(null, memory, 4_000)).toBe("headset-off");
  });

  it("keeps the last answer through a HID error", () => {
    const memory = new HeadsetPowerMemory();
    reason(snapshot("BATTERY_UNAVAILABLE"), memory, 0);
    expect(reason(snapshot("BATTERY_HIDERROR"), memory, 2_000)).toBe("headset-off");
  });

  it("falls back to plain endpoint state once the memory is stale", () => {
    const memory = new HeadsetPowerMemory();
    reason(snapshot("BATTERY_UNAVAILABLE"), memory, 0);
    expect(reason(snapshot(null), memory, HEADSET_MEMORY_MS + 1)).toBe("endpoint-active");
  });

  it("does not refresh the memory from a recalled state", () => {
    const memory = new HeadsetPowerMemory();
    reason(snapshot("BATTERY_UNAVAILABLE"), memory, 0);
    reason(snapshot(null), memory, HEADSET_MEMORY_MS - 1);
    expect(reason(snapshot(null), memory, HEADSET_MEMORY_MS + 1)).toBe("endpoint-active");
  });

  it("a fresh answer always wins over the memory", () => {
    const memory = new HeadsetPowerMemory();
    reason(snapshot("BATTERY_UNAVAILABLE"), memory, 0);
    expect(reason(snapshot("BATTERY_AVAILABLE"), memory, 1_000)).toBe("headset-on");
  });

  it("fails open with no memory, as before", () => {
    const memory = new HeadsetPowerMemory();
    expect(reason(snapshot("BATTERY_TIMEOUT"), memory, 0)).toBe("headset-unknown-fail-open");
    expect(reason(snapshot(null), memory, 0)).toBe("endpoint-active");
  });
});
