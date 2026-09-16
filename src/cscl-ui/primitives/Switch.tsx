interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

/** On/off toggle — never a checkbox for a settings-style boolean. */
export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
        checked ? "bg-accent" : "bg-surface-hover"
      }`}
    >
      <span
        className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
        style={{
          transform: checked ? "translateX(20px)" : "translateX(0)",
          transitionDuration: "200ms",
          transitionTimingFunction: "var(--ease-in-out-quart)",
        }}
      />
    </button>
  );
}
