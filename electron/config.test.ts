import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultConfig, loadConfig, migrateConfig, saveConfig } from "./config.js";

describe("config", () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "audiodeck-config-"));
    file = path.join(dir, "config.json");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns defaults when no file exists", async () => {
    expect(await loadConfig(file)).toEqual(defaultConfig());
  });

  it("round-trips through save and load", async () => {
    const config = defaultConfig();
    config.outputPriority = ["{id-a}", "{id-b}"];
    config.pollIntervalMs = 3000;
    config.autostart = false;
    await saveConfig(config, file);
    expect(await loadConfig(file)).toEqual(config);
  });

  it("writes atomically, leaving no temp file behind", async () => {
    await saveConfig(defaultConfig(), file);
    const written = await readFile(file, "utf8");
    expect(JSON.parse(written)).toEqual(defaultConfig());
    const { readdir } = await import("node:fs/promises");
    expect(await readdir(dir)).toEqual(["config.json"]);
  });

  it("fills missing fields with defaults on migrate", () => {
    const migrated = migrateConfig({ outputPriority: ["{id-a}"] });
    expect(migrated).toEqual({ ...defaultConfig(), outputPriority: ["{id-a}"] });
  });

  it("rejects a corrupt config instead of discarding it", async () => {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(file, "not json", "utf8");
    await expect(loadConfig(file)).rejects.toThrow();
  });
});
