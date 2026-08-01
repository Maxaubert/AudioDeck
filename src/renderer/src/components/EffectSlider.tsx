// One labelled effect slider, in the print theme.
//
// A plain range input rather than the mixer's meter-with-invisible-input: this
// is a value with a midpoint and a unit, not a level, so it reads better as an
// ordinary track with its number alongside.

export function EffectSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const shown = unit === "%" ? `${Math.round(value)}%` : `${value > 0 ? "+" : ""}${value.toFixed(1)} ${unit}`;
  return (
    <label className={disabled ? "fx is-off" : "fx"}>
      <span className="fx-label">{label}</span>
      <input
        type="range"
        className="fx-range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="fx-value">{shown}</span>
    </label>
  );
}
