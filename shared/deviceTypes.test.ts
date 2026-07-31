// The device-type catalog backs the Devices-view type dropdown; these pin the
// flow filtering and the reverse lookup the UI relies on.

import { describe, expect, it } from "vitest";
import {
  deviceTypeByKey,
  offeredTypesForFlow,
  typeKeyForFormFactor,
  typesForFlow,
  DEVICE_TYPES,
} from "./deviceTypes.js";

describe("deviceTypes", () => {
  it("every type has a distinct key and an mmres icon", () => {
    expect(new Set(DEVICE_TYPES.map((t) => t.key)).size).toBe(DEVICE_TYPES.length);
    for (const t of DEVICE_TYPES) expect(t.iconPath).toMatch(/mmres\.dll,-\d+$/);
  });

  it("filters types by flow, with headset available to both", () => {
    const renderKeys = typesForFlow("render").map((t) => t.key);
    const captureKeys = typesForFlow("capture").map((t) => t.key);
    expect(renderKeys).toContain("speakers");
    expect(renderKeys).toContain("headset");
    expect(renderKeys).not.toContain("microphone");
    expect(captureKeys).toContain("microphone");
    expect(captureKeys).toContain("headset");
    expect(captureKeys).not.toContain("tv");
  });

  it("only offers types the Windows picker visibly distinguishes", () => {
    expect(offeredTypesForFlow("render").map((t) => t.key)).toEqual([
      "speakers",
      "headphones",
      "headset",
    ]);
    expect(offeredTypesForFlow("capture").map((t) => t.key)).toEqual(["headset", "microphone"]);
  });

  it("maps form factors back to type keys per flow", () => {
    expect(typeKeyForFormFactor(1, "render")).toBe("speakers");
    expect(typeKeyForFormFactor(9, "render")).toBe("tv");
    expect(typeKeyForFormFactor(4, "capture")).toBe("microphone");
    expect(typeKeyForFormFactor(5, "capture")).toBe("headset");
    expect(typeKeyForFormFactor(null, "render")).toBeNull();
    expect(typeKeyForFormFactor(42, "render")).toBeNull();
  });

  it("looks up types by key", () => {
    expect(deviceTypeByKey("speakers")?.formFactor).toBe(1);
    expect(deviceTypeByKey("nope")).toBeUndefined();
  });
});
