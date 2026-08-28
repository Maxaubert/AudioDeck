// An app's icon in the mixer: PNG data URL from main, fetched once per exe and
// cached for the window's life. System sounds and icon-less apps get inline SVG
// glyphs (SVG stays crisp at this machine's display scaling).

import { useEffect, useState } from "react";
import { api } from "../api.js";
import type { MixerAppView } from "../../../../shared/ipc.js";

const iconCache = new Map<string, string | null>();

function SystemSoundsGlyph() {
  return (
    <svg className="app-icon app-icon-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
      <path
        d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GenericAppGlyph() {
  return (
    <svg className="app-icon app-icon-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <circle cx="12" cy="12" r="3.2" fill="currentColor" />
    </svg>
  );
}

export function AppIcon({ app }: { app: MixerAppView }) {
  const exe = app.exePath;
  const [url, setUrl] = useState<string | null>(exe === null ? null : (iconCache.get(exe) ?? null));

  useEffect(() => {
    if (exe === null || iconCache.has(exe)) return;
    let live = true;
    void api.getAppIcon(exe).then((dataUrl) => {
      iconCache.set(exe, dataUrl);
      if (live) setUrl(dataUrl);
    });
    return () => {
      live = false;
    };
  }, [exe]);

  if (app.isSystemSounds) return <SystemSoundsGlyph />;
  if (url === null) return <GenericAppGlyph />;
  return <img className="app-icon" src={url} alt="" draggable={false} />;
}
