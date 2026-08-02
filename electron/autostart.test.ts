import { afterEach, describe, expect, it } from "vitest";
import { STARTUP_FLAG, startedByWindows } from "./autostart.js";

const original = process.argv;
afterEach(() => {
  process.argv = original;
});

describe("startedByWindows", () => {
  it("is true only when the Run key launched us", () => {
    // Opening AudioDeck by hand and getting no window looks like it failed to
    // start, which is exactly how it read straight after an install. Going to
    // the tray silently is only right when Windows did the launching.
    process.argv = ["electron.exe", "main.js", STARTUP_FLAG];
    expect(startedByWindows()).toBe(true);
  });

  it("is false for an ordinary launch", () => {
    process.argv = ["electron.exe", "main.js"];
    expect(startedByWindows()).toBe(false);
  });

  it("is false when a different flag is present", () => {
    // The installer's "open AudioDeck now" runs the executable bare, and the
    // second-instance path passes --updated. Neither should land in the tray.
    process.argv = ["electron.exe", "main.js", "--updated"];
    expect(startedByWindows()).toBe(false);
  });
});
