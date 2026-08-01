// The looping illustrations at the top of each first-run card.
//
// Deliberately built from plain elements and CSS keyframes rather than a video
// or a GIF: they inherit the theme's tokens, stay sharp at any display scale,
// weigh nothing, and honour prefers-reduced-motion, which a video cannot.
// Every keyframe moves transform and opacity only.
//
// Each one is decorative. The card's heading and description carry the
// meaning, so these are hidden from assistive technology entirely.

/** Ranked rows being dragged into a new order: the thing AudioDeck is for. */
export function RankAnimation() {
  return (
    <div className="ga ga-rank" aria-hidden="true">
      {/* Numbered, because three empty boxes changing places does not say
          "ranking" on its own. Each row carries the rank it starts with and the
          rank it ends with, crossfaded at the moment the move lands: a row that
          travelled to the top while still reading "3" would be saying the
          reorder did not take. */}
      <i className="ga-row ga-row-a">
        <b className="ga-n ga-n-from">1</b>
        <b className="ga-n ga-n-to">2</b>
      </i>
      <i className="ga-row ga-row-b">
        <b className="ga-n ga-n-from">2</b>
        <b className="ga-n ga-n-to">3</b>
      </i>
      <i className="ga-row ga-row-c">
        <b className="ga-n ga-n-from">3</b>
        <b className="ga-n ga-n-to">1</b>
      </i>
    </div>
  );
}

/**
 * One device row carrying all of its controls, with the fader travelling.
 * Two bare sliders would illustrate "a slider"; the point of the card is that
 * everything lives on the row, so the row has to be in the picture.
 */
export function RowAnimation() {
  return (
    <div className="ga ga-strip" aria-hidden="true">
      <i className="gs-rank">1</i>
      <i className="gs-body">
        <i className="gs-name" />
        <i className="gs-fader">
          <i className="gs-fill" />
          <i className="gs-knob" />
        </i>
      </i>
      <i className="gs-mute">MUTE</i>
      <i className="gs-more">
        <b />
        <b />
        <b />
      </i>
    </div>
  );
}

/** Equalizer bands tracing a curve. Ten, the count Studio actually shows. */
export function StudioAnimation() {
  return (
    <div className="ga ga-studio" aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => (
        // Spread across the whole cycle rather than trailing one behind the
        // next: a uniform lag makes every frame a staircase, which reads as a
        // signal-strength icon instead of an equalizer.
        <i key={i} className="ga-band" style={{ animationDelay: `${-i * 0.22}s` }} />
      ))}
    </div>
  );
}

/** A window folding down into the tray, and the tray mark lighting up. */
export function TrayAnimation() {
  return (
    <div className="ga ga-tray" aria-hidden="true">
      <i className="gt-window">
        <i className="gt-bar" />
      </i>
      <i className="gt-taskbar">
        <i className="gt-dot" />
        <i className="gt-dot" />
        <i className="gt-trayicon" />
      </i>
    </div>
  );
}
