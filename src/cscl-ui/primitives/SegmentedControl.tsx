import type { ReactNode } from "react";
import { Chip } from "./Chip";

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
};

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className = "",
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={`flex gap-1 rounded-md border border-border bg-surface-raised p-1 ${className}`}>
      {options.map((option) => (
        <Chip key={option.value} active={value === option.value} onClick={() => onChange(option.value)}>
          {option.label}
        </Chip>
      ))}
    </div>
  );
}
