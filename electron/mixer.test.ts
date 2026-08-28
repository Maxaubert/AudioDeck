import { describe, expect, it } from "vitest";
import { groupSessions } from "./mixer.js";
import type { AppSession } from "./audioctl.js";

function session(over: Partial<AppSession>): AppSession {
  return {
    id: "s1",
    pid: 100,
    exePath: "C:\\Apps\\one.exe",
    name: "One",
    state: "active",
    isSystemSounds: false,
    volume: 50,
    mute: false,
    ...over,
  };
}

describe("groupSessions", () => {
  it("groups sessions of the same exe case-insensitively", () => {
    const rows = groupSessions([
      session({ id: "a", exePath: "C:\\Apps\\chrome.exe" }),
      session({ id: "b", exePath: "c:\\apps\\CHROME.EXE" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sessionIds).toEqual(["a", "b"]);
  });

  it("pins system sounds first, then sorts by name", () => {
    const rows = groupSessions([
      session({ id: "z", name: "Zebra", exePath: "C:\\z.exe" }),
      session({ id: "a", name: "Alpha", exePath: "C:\\a.exe" }),
      session({ id: "sys", name: "System sounds", exePath: null, isSystemSounds: true, pid: 0 }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["System sounds", "Alpha", "Zebra"]);
    expect(rows[0]?.key).toBe("system");
  });

  it("aggregates volume as max, mute as every, active as some", () => {
    const rows = groupSessions([
      session({ id: "a", exePath: "C:\\x.exe", volume: 30, mute: true, state: "inactive" }),
      session({ id: "b", exePath: "C:\\x.exe", volume: 70, mute: false, state: "active" }),
    ]);
    expect(rows[0]?.volume).toBe(70);
    expect(rows[0]?.mute).toBe(false);
    expect(rows[0]?.active).toBe(true);
  });

  it("keeps sessions without an exe path as separate pid-keyed rows", () => {
    const rows = groupSessions([
      session({ id: "a", exePath: null, pid: 11, name: "App 11" }),
      session({ id: "b", exePath: null, pid: 22, name: "App 22" }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.key).sort()).toEqual(["pid:11", "pid:22"]);
  });
});
