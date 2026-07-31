// Frameless window caption: the strip Windows would normally draw. The strip
// itself is the drag handle (CSS -webkit-app-region: drag); the buttons opt
// out so they stay clickable.

import { useEffect, useState } from "react";
import { api } from "../api.js";

function Minimize() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <rect x="1" y="5.5" width="10" height="1.4" />
    </svg>
  );
}

function Maximize({ maximized }: { maximized: boolean }) {
  return maximized ? (
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <rect x="1.4" y="3.4" width="7.2" height="7.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.9 3.4 V1.4 H10.6 V8.1 H8.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ) : (
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <rect x="1.4" y="1.4" width="9.2" height="9.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function Close() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <path d="M1.6 1.6 L10.4 10.4 M10.4 1.6 L1.6 10.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function WindowCaption() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    void api.windowIsMaximized().then(setMaximized);
    return api.onWindowStateChanged(setMaximized);
  }, []);

  return (
    <div className="caption">
      <span className="cap-title">
        <span className="stencil">Audio</span>
        <b>Deck</b>
      </span>
      <div className="wc">
        <button
          type="button"
          className="wcbtn"
          aria-label="Minimize"
          onClick={() => void api.windowMinimize()}
        >
          <Minimize />
        </button>
        <button
          type="button"
          className="wcbtn"
          aria-label={maximized ? "Restore" : "Maximize"}
          onClick={() => void api.windowToggleMaximize().then(setMaximized)}
        >
          <Maximize maximized={maximized} />
        </button>
        <button
          type="button"
          className="wcbtn wcbtn-close"
          aria-label="Close"
          onClick={() => void api.windowClose()}
        >
          <Close />
        </button>
      </div>
    </div>
  );
}
