import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

export default defineConfig({
  main: {
    build: {
      lib: {
        entry: "electron/main.ts",
      },
    },
  },
  preload: {
    build: {
      lib: {
        entry: "electron/preload.ts",
      },
    },
  },
  renderer: {
    root: "src/renderer",
    build: {
      rollupOptions: {
        input: "src/renderer/index.html",
      },
    },
    plugins: [react()],
  },
});
