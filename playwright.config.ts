import { defineConfig } from "@playwright/test";

// Electron e2e suite: each test boots the built app (test mode + mock backend)
// with its own temp APPDATA. One worker, one Electron instance at a time.
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
});
