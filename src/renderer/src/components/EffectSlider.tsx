// One labelled effect slider, in the print theme.
//
// Shown as a level from 0 to 20 rather than in decibels or percent. The units
// are real and the renderer works in them, but they are not what the control
// is for: nobody reaching for more bass is thinking in decibels, and "+20.0 dB"
// next to "0%" next to "0.0 dB" reads as three unrelated scales rather than
// three of the same kind of control. Level 0 always means the effect is off.

/** Every effect slider has the same number of steps, whatever its real range. */
export const LEVELS = 20;

export function EffectSlider({
  label,
  value,
  /** Value at level 0, i.e. the effect doing nothing. */
  min,
  /** Value at level 20. */
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const level = Math.round(((value - min) / (max - min)) * LEVELS);
  const clamped = Math.min(LEVELS, Math.max(0, level));
  return (
    <label className={disabled ? "fx is-off" : "fx"}>
      <span className="fx-label">{label}</span>
      <input
        type="range"
        className="fx-range"
        min={0}
        max={LEVELS}
        step={1}
        value={clamped}
        disabled={disabled}
        // The slider is in levels; the profile stays in real units, so the
        // renderer never has to know this scale exists.
        onChange={(e) => onChange(min + (Number(e.target.value) / LEVELS) * (max - min))}
      />
      <span className="fx-value">{clamped}</span>
    </label>
  );
}
