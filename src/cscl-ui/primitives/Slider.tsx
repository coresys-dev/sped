import type { LucideIcon } from "lucide-react";

interface SliderProps {
  /** Current value, within `[min, max]`. */
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  /** Accessible name for the range input — plug in whatever your app's own
   * i18n produces (this component takes no translation hook itself). */
  ariaLabel: string;
  /** Picks the icon shown before the track based on the current value (e.g.
   * mute/low/high volume, empty/full battery, zoom level). Omit for a plain
   * slider with no icon. Generalizes SLDR's `VolumeSlider`, which hardcoded
   * this exact mute/low/high swap for volume specifically:
   * `iconForValue={(v) => (v <= 0.02 ? Volume : v <= 0.5 ? Volume1 : Volume2)}`. */
  iconForValue?: (value: number, max: number) => LucideIcon;
  /** Also show a plain number input next to the track, synced to the same
   * value/min/max/step, for values where dragging alone can't reach the
   * precision a user wants (e.g. a fine multiplier). Off by default since
   * most sliders (volume, brightness) don't need it. */
  showNumberInput?: boolean;
}

/** Generic value-in-range slider (volume, brightness, zoom, anything on a
 * bounded numeric scale) with an optional leading icon that reacts to the
 * current value. Stateless — the value is owned and persisted by the
 * caller, not this component. */
export function Slider({
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
  ariaLabel,
  iconForValue,
  showNumberInput,
}: SliderProps) {
  const Icon = iconForValue?.(value, max);
  return (
    <div className="flex items-center gap-1.5">
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-text-muted" />}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={ariaLabel}
        className="h-1 w-20 cursor-pointer accent-accent"
      />
      {showNumberInput && (
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isFinite(n)) return;
            onChange(n);
          }}
          aria-label={`${ariaLabel} (manual entry)`}
          className="w-20 rounded-md border border-border bg-surface-raised px-1.5 py-0.5 text-xs text-text focus:border-accent focus:outline-none"
        />
      )}
    </div>
  );
}
