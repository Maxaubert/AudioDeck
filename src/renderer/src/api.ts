// Typed access to the preload bridge. The only place that touches `window`.

import type { AudioDeckApi } from "../../../shared/ipc.js";

declare global {
  interface Window {
    audiodeck: AudioDeckApi;
  }
}

export const api: AudioDeckApi = window.audiodeck;
