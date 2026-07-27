import { defineConfig } from "@playwright/test";

// Electron e2e tests land in Stage 4; the directory exists so `npm run e2e` is
// wired up from day one (it passes with no tests until then).
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
});
