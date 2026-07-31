// headsetPowerState must judge on battery data alone: HeadsetControl reports
// device status "partial" when any capability query fails even though the
// battery answer is valid (observed live on a Nova Pro Wireless, 2026-07-27).

import { describe, expect, it } from "vitest";
import { headsetPowerState, matchesEndpoint } from "./headsetcontrol.js";
import type { HeadsetDevice } from "./headsetcontrol.js";

const ARCTIS_USB = "{1}.USB\\VID_1038&PID_12E0&MI_00\\B&14277468&0&0000";

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

describe("matchesEndpoint", () => {
  it("matches a renamed endpoint by its USB ids", () => {
    // The reported bug: renaming the output to "Steelseries (Arctis Nova Pro)"
    // dropped the word "Wireless", the name match failed, and the daemon never
    // saw the headset power off. Renaming is a feature of this app, so identity
    // cannot depend on the name.
    expect(
      matchesEndpoint(device({}), {
        name: "Steelseries (Arctis Nova Pro)",
        association: ARCTIS_USB,
      }),
    ).toBe(true);
  });

  it("still matches on name when the endpoint carries no USB ids", () => {
    expect(
      matchesEndpoint(device({}), {
        name: "Headphones (Arctis Nova Pro Wireless)",
        association: "{1}.BTHENUM\\DEV_2C4D79FA1B33\\7&2b3c4d5e&0&0000",
      }),
    ).toBe(true);
    expect(
      matchesEndpoint(device({}), {
        name: "Headphones (Arctis Nova Pro Wireless)",
        association: null,
      }),
    ).toBe(true);
  });

  it("does not match another device on the same machine", () => {
    expect(
      matchesEndpoint(device({}), {
        name: "SteelSeries Sonar - Gaming (SteelSeries Sonar Virtual Audio Device)",
        association: "{1}.ROOT\\MEDIA\\0000",
      }),
    ).toBe(false);
    expect(
      matchesEndpoint(device({}), {
        name: "Speakers (Realtek USB Audio)",
        association: "{1}.USB\\VID_0B05&PID_1B9B&MI_00\\9&10574C6A&0&0000",
      }),
    ).toBe(false);
  });

  it("reads the ids case-insensitively and without the 0x prefix", () => {
    expect(
      matchesEndpoint(device({ id_vendor: "0X1038", id_product: "12E0" }), {
        name: "anything",
        association: "{1}.usb\\vid_1038&pid_12e0\\b&14277468&0&0000",
      }),
    ).toBe(true);
  });
});

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
