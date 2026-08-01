// The draggable equalizer curve.
//
// Ten points on a fixed logarithmic frequency axis; dragging one changes its
// gain and nothing else. Drawn as SVG rather than canvas so every point is a
// real focusable element: the curve has to be usable without a mouse, and a
// canvas would need the whole keyboard story rebuilding by hand.

import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/** Centre frequencies, matching electron/eqapo/render.ts BANDS. */
export const EQ_BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;
export const EQ_MAX_DB = 12;

/** Viewbox units. The SVG scales with CSS; these are just its internal grid. */
const W = 1000;
const H = 300;
const PAD_X = 34;
const PAD_Y = 22;

const bandX = (index: number): number =>
  PAD_X + (index / (EQ_BANDS.length - 1)) * (W - PAD_X * 2);

const gainY = (db: number): number => H / 2 - (db / EQ_MAX_DB) * (H / 2 - PAD_Y);

const yToGain = (y: number): number => ((H / 2 - y) / (H / 2 - PAD_Y)) * EQ_MAX_DB;

/** Half-dB steps, matching what the hardware and the config file express. */
const quantise = (db: number): number =>
  Math.max(-EQ_MAX_DB, Math.min(EQ_MAX_DB, Math.round(db * 2) / 2));

export function formatHz(hz: number): string {
  return hz >= 1000 ? `${hz / 1000}k` : String(hz);
}

export function EqCurve({
  bands,
  disabled,
  onChange,
}: {
  bands: number[];
  disabled: boolean;
  /** Called with the whole band array, so the caller owns the profile. */
  onChange: (bands: number[]) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gains = EQ_BANDS.map((_, i) => bands[i] ?? 0);

  const setBand = (index: number, db: number): void => {
    const next = [...gains];
    next[index] = quantise(db);
    if (next[index] !== gains[index]) onChange(next);
  };

  /** Pointer position in viewBox units, which CSS pixels are not. */
  const toViewBox = (e: ReactPointerEvent): number | null => {
    const svg = svgRef.current;
    if (svg === null) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.height === 0) return null;
    return ((e.clientY - rect.top) / rect.height) * H;
  };

  const drag = (index: number) => (e: ReactPointerEvent<SVGCircleElement>) => {
    if (disabled) return;
    e.preventDefault();
    // Capture on the point itself, so a fast drag that leaves the circle
    // keeps controlling it rather than dropping the gesture.
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const move = (index: number) => (e: ReactPointerEvent<SVGCircleElement>) => {
    if (disabled || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const y = toViewBox(e);
    if (y !== null) setBand(index, yToGain(y));
  };

  const key = (index: number) => (e: React.KeyboardEvent<SVGCircleElement>) => {
    if (disabled) return;
    const step = e.shiftKey ? 2 : 0.5;
    const current = gains[index] ?? 0;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setBand(index, current + step);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setBand(index, current - step);
    } else if (e.key === "Home") {
      e.preventDefault();
      setBand(index, 0);
    }
  };

  const line = gains.map((g, i) => `${bandX(i)},${gainY(g)}`).join(" ");
  const fill = `${bandX(0)},${gainY(0)} ${line} ${bandX(gains.length - 1)},${gainY(0)}`;

  return (
    <div className={disabled ? "eq-curve is-off" : "eq-curve"}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="eq-svg"
        role="group"
        aria-label="Equalizer curve"
      >
        {/* Zero line, drawn solid: it is the reference, not decoration. */}
        <line x1={PAD_X} y1={gainY(0)} x2={W - PAD_X} y2={gainY(0)} className="eq-zero" />
        {[EQ_MAX_DB, -EQ_MAX_DB].map((db) => (
          <line
            key={db}
            x1={PAD_X}
            y1={gainY(db)}
            x2={W - PAD_X}
            y2={gainY(db)}
            className="eq-limit"
          />
        ))}
        {EQ_BANDS.map((_, i) => (
          <line
            key={i}
            x1={bandX(i)}
            y1={PAD_Y}
            x2={bandX(i)}
            y2={H - PAD_Y}
            className="eq-grid"
          />
        ))}

        <polygon points={fill} className="eq-fill" />
        <polyline points={line} className="eq-line" />

        {gains.map((g, i) => (
          <circle
            key={EQ_BANDS[i]}
            cx={bandX(i)}
            cy={gainY(g)}
            r={13}
            className="eq-point"
            tabIndex={disabled ? -1 : 0}
            role="slider"
            aria-label={`${formatHz(EQ_BANDS[i] ?? 0)} hertz`}
            aria-valuemin={-EQ_MAX_DB}
            aria-valuemax={EQ_MAX_DB}
            aria-valuenow={g}
            aria-valuetext={`${g > 0 ? "+" : ""}${g.toFixed(1)} decibels`}
            aria-disabled={disabled}
            onPointerDown={drag(i)}
            onPointerMove={move(i)}
            onKeyDown={key(i)}
          />
        ))}
      </svg>

      {/* Positioned from the same formula as the points rather than laid out
          in even columns: even columns put the end labels visibly off their
          dots, because the curve is inset by the SVG's padding. */}
      <ol className="eq-scale" aria-hidden="true">
        {EQ_BANDS.map((hz, i) => (
          <li key={hz} style={{ left: `${(bandX(i) / W) * 100}%` }}>
            <span className="eq-hz">{formatHz(hz)}</span>
            <span className="eq-db">{(gains[i] ?? 0).toFixed(1)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
