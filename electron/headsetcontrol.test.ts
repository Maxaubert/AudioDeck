// headsetPowerState must judge on battery data alone: HeadsetControl reports
// device status "partial" when any capability query fails even though the
// battery answer is valid (observed live on a Nova Pro Wireless, 2026-07-27).

import { describe, expect, it } from "vitest";
import { headsetPowerState } from "./headsetcontrol.js";
import type { HeadsetDevice } from "./headsetcontrol.js";

function device(overrides: Partial<HeadsetDevice>): HeadsetDevice {
  return {
    status: "success",
    device: "SteelSeries Arctis Nova Pro Wireless",
    vendor: "SteelSeries",
    product: "Arctis Nova Pro Wireless",
    id_vendor: "0x1038",
    id_product: "0x12e0",
    capabilities: ["CAP_BATTERY_STATUS"],
    ...overrides,
  };
}

describe("headsetPowerState", () => {
  it("reads power from battery even when device status is partial", () => {
    expect(
      headsetPowerState(device({ status: "partial", battery: { status: "BATTERY_UNAVAILABLE", level: -1 } })),
    ).toBe(false);
    expect(
      headsetPowerState(device({ status: "partial", battery: { status: "BATTERY_AVAILABLE", level: 25 } })),
    ).toBe(true);
  });

  it("charging counts as powered on", () => {
    expect(
      headsetPowerState(device({ battery: { status: "BATTERY_CHARGING", level: 80 } })),
    ).toBe(true);
  });

  it("missing battery data or HID errors are unknown, never off", () => {
    expect(headsetPowerState(device({}))).toBeNull();
    expect(
      headsetPowerState(device({ battery: { status: "BATTERY_HIDERROR", level: -1 } })),
    ).toBeNull();
    expect(
      headsetPowerState(device({ battery: { status: "BATTERY_TIMEOUT", level: -1 } })),
    ).toBeNull();
  });
});
