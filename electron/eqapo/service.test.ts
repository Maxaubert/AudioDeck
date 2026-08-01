import { describe, expect, it } from "vitest";
import { EffectsService, deviceMatchPattern, flatEqProfile, sectionsFor } from "./service.js";
import { defaultConfig } from "../config.js";
import type { FileIo } from "./apply.js";
import type { AudioDeckConfig } from "../config.js";

function withEq(eq: AudioDeckConfig["eq"]): AudioDeckConfig {
  return { ...defaultConfig(), eq };
}

function fakeIo(initial: Record<string, string> = {}) {
  const files = new Map(Object.entries(initial));
  const io: FileIo = {
    read: async (f) => files.get(f) ?? null,
    write: async (f, t) => void files.set(f, t),
    remove: async (f) => void files.delete(f),
  };
  return { io, files };
}

const INSTALL = { installPath: "C:\\EQ", configPath: "C:\\EQ\\config" };

describe("deviceMatchPattern", () => {
  it("takes the endpoint GUID out of an AudioDeck id", () => {
    // Equalizer APO matches against "Device_name Connection_name GUID", so the
    // bare GUID is exact, and unlike the name it does not move when the user
    // renames the device in AudioDeck.
    expect(deviceMatchPattern("{0.0.0.00000000}.{db9b4466-47fb-4c66-9486-3d68061ff950}")).toBe(
      "{db9b4466-47fb-4c66-9486-3d68061ff950}",
    );
  });

  it("takes the second group, not the flow prefix", () => {
    const pattern = deviceMatchPattern("{0.0.1.00000000}.{907c7897-002f-4447-96ed-8acda93337ab}");
    expect(pattern).not.toContain("0.0.1");
  });

  it("returns null for an id that carries no GUID", () => {
    // Better to skip a device than to emit a pattern that might match others.
    expect(deviceMatchPattern("mock-out-arctis")).toBeNull();
  });
});

describe("sectionsFor", () => {
  it("turns each profile into a section", () => {
    const config = withEq({
      "{0.0.0.00000000}.{db9b4466-47fb-4c66-9486-3d68061ff950}": flatEqProfile(),
    });
    expect(sectionsFor(config)).toEqual([
      { match: "{db9b4466-47fb-4c66-9486-3d68061ff950}", profile: flatEqProfile() },
    ]);
  });

  it("drops profiles whose id yields no pattern", () => {
    expect(sectionsFor(withEq({ "mock-device": flatEqProfile() }))).toEqual([]);
  });
});

describe("EffectsService", () => {
  it("writes nothing when Equalizer APO is not installed", async () => {
    // Not an error: most machines will be in this state until the user sets
    // effects up, and the profile is still saved either way.
    const { io, files } = fakeIo();
    const service = new EffectsService({ detect: async () => null, io });
    await service.apply(withEq({ "{0.0.0.00000000}.{aaaaaaaa-1111-2222-3333-444444444444}": flatEqProfile() }));
    expect(files.size).toBe(0);
    expect(service.status().error).toBeNull();
  });

  it("writes the config when it is installed", async () => {
    const { io, files } = fakeIo();
    const service = new EffectsService({ detect: async () => INSTALL, io });
    await service.apply(
      withEq({
        "{0.0.0.00000000}.{aaaaaaaa-1111-2222-3333-444444444444}": {
          ...flatEqProfile(),
          bassBoost: 5,
        },
      }),
    );
    expect(files.get("C:\\EQ\\config\\audiodeck.txt")).toContain(
      "Device: {aaaaaaaa-1111-2222-3333-444444444444}",
    );
    expect(files.get("C:\\EQ\\config\\config.txt")).toContain("Include: audiodeck.txt");
  });

  it("keeps working after a failed write, and says why", async () => {
    // A read-only Program Files should surface in the UI, not crash the daemon
    // or silently pretend the effects are live.
    const io: FileIo = {
      read: async () => null,
      write: async () => {
        throw new Error("EACCES");
      },
      remove: async () => {},
    };
    const service = new EffectsService({ detect: async () => INSTALL, io });
    await expect(service.apply(withEq({}))).resolves.toBeUndefined();
    expect(service.status().error).toContain("Could not write audio effects");
  });

  it("clears a previous error once a write succeeds", async () => {
    let fail = true;
    const io: FileIo = {
      read: async () => null,
      write: async () => {
        if (fail) throw new Error("EACCES");
      },
      remove: async () => {},
    };
    const service = new EffectsService({ detect: async () => INSTALL, io });
    await service.apply(withEq({}));
    expect(service.status().error).not.toBeNull();
    fail = false;
    await service.apply(withEq({}));
    expect(service.status().error).toBeNull();
  });

  it("removes everything it wrote", async () => {
    const { io, files } = fakeIo({ "C:\\EQ\\config\\config.txt": "Preamp: -6 dB\n" });
    const service = new EffectsService({ detect: async () => INSTALL, io });
    await service.apply(withEq({ "{0.0.0.00000000}.{aaaaaaaa-1111-2222-3333-444444444444}": flatEqProfile() }));
    await service.removeAll();
    expect(files.has("C:\\EQ\\config\\audiodeck.txt")).toBe(false);
    expect(files.get("C:\\EQ\\config\\config.txt")).toBe("Preamp: -6 dB\n");
  });
});
