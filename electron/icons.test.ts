import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppIconCache, iconCacheKey } from "./icons.js";
import type { AudioControl } from "./audioctl.js";

describe("iconCacheKey", () => {
  it("is stable and case-insensitive on the path", () => {
    expect(iconCacheKey("C:\\Apps\\x.exe", 123)).toBe(iconCacheKey("c:\\apps\\X.EXE", 123));
  });

  it("changes when the exe changes (mtime)", () => {
    expect(iconCacheKey("C:\\Apps\\x.exe", 123)).not.toBe(iconCacheKey("C:\\Apps\\x.exe", 456));
  });
});

describe("AppIconCache", () => {
  let dir: string;
  let exe: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "audiodeck-icons-"));
    exe = path.join(dir, "fake.exe");
    await writeFile(exe, "not a real exe");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  function fakeAudioctl(calls: string[]): AudioControl {
    return {
      appIcon: async (_exePath: string, outPath: string) => {
        calls.push(outPath);
        await writeFile(outPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      },
    } as unknown as AudioControl;
  }

  it("extracts once and serves a data URL from cache after", async () => {
    const calls: string[] = [];
    const cache = new AppIconCache({ audioctl: fakeAudioctl(calls), cacheDir: path.join(dir, "cache") });
    const first = await cache.dataUrl(exe);
    const second = await cache.dataUrl(exe);
    expect(first).toMatch(/^data:image\/png;base64,/);
    expect(second).toBe(first);
    expect(calls).toHaveLength(1);
  });

  it("caches extraction failure as null without retrying", async () => {
    let attempts = 0;
    const failing = {
      appIcon: async () => {
        attempts++;
        throw new Error("no icon");
      },
    } as unknown as AudioControl;
    const cache = new AppIconCache({ audioctl: failing, cacheDir: path.join(dir, "cache") });
    expect(await cache.dataUrl(exe)).toBeNull();
    expect(await cache.dataUrl(exe)).toBeNull();
    expect(attempts).toBe(1);
  });

  it("returns null for a missing exe without calling the helper", async () => {
    const calls: string[] = [];
    const cache = new AppIconCache({ audioctl: fakeAudioctl(calls), cacheDir: path.join(dir, "cache") });
    expect(await cache.dataUrl(path.join(dir, "gone.exe"))).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
