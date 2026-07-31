import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "electron/**/*.test.ts",
      "shared/**/*.test.ts",
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
    ],
    environment: "node",
  },
});
