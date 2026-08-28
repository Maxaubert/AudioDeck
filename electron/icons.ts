// Disk + memory cache of app icon data URLs, extracted by `audioctl app-icon`.
// Icons only change when the exe does, so the key carries the file's mtime and
// a hit costs one readFile per app per run.

import { createHash } from "node:crypto";
import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { AudioControl } from "./audioctl.js";

/** 256 px source: crisp at any display scale; the renderer scales down. */
const ICON_SIZE = 256;

export function iconCacheKey(exePath: string, mtimeMs: number): string {
  return createHash("sha1").update(`${exePath.toLowerCase()}|${mtimeMs}`).digest("hex");
}

export class AppIconCache {
  /** exePath (lowercased) -> data URL, or null when extraction failed once. */
  private readonly memo = new Map<string, string | null>();

  constructor(private readonly deps: { audioctl: AudioControl; cacheDir: string }) {}

  async dataUrl(exePath: string): Promise<string | null> {
    const memoKey = exePath.toLowerCase();
    const memoized = this.memo.get(memoKey);
    if (memoized !== undefined) return memoized;
    let url: string | null;
    try {
      const { mtimeMs } = await stat(exePath);
      const file = path.join(this.deps.cacheDir, `${iconCacheKey(exePath, mtimeMs)}.png`);
      let bytes: Buffer;
      try {
        bytes = await readFile(file);
      } catch {
        await mkdir(this.deps.cacheDir, { recursive: true });
        await this.deps.audioctl.appIcon(exePath, file, ICON_SIZE);
        bytes = await readFile(file);
      }
      url = `data:image/png;base64,${bytes.toString("base64")}`;
    } catch {
      // "No icon" is a stable answer; caching it keeps every poll from retrying.
      url = null;
    }
    this.memo.set(memoKey, url);
    return url;
  }
}
