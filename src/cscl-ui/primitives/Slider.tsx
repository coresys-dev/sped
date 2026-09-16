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
}

/** Generic value-in-range slider (volume, brightness, zoom, anything on a
 * bounded numeric scale) with an optional leading icon that reacts to the
 * current value. Stateless — the value is owned and persisted by the
 * caller, not this component. */
export function Slider({ value, min = 0, max = 1, step = 0.01, onChange, ariaLabel, iconForValue }: SliderProps) {
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
    </div>
  );
}
