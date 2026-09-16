import type { MouseEvent, ReactNode } from "react";

interface ChipProps {
  active: boolean;
  onClick: () => void;
  onContextMenu?: (e: MouseEvent) => void;
  title?: string;
  /** Active state reads as a deliberately destructive/unsafe choice (e.g. an
   * "unthrottled" mode) rather than a normal selection — swaps the active
   * fill from `accent` to `danger`. */
  danger?: boolean;
  children: ReactNode;
}

/** Small uppercase toggle button — category filters, format toggles, mode
 * selectors, a segmented control's individual option. Wrap a group of these
 * in `flex gap-1 rounded-md border border-border bg-surface-raised p-1`
 * (see `SegmentedControl` for that wrapper). */
export function Chip({ active, onClick, onContextMenu, title, danger, children }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={title}
      className={`rounded-sm px-3 py-1 text-xs font-medium uppercase tracking-wide transition-all duration-150 active:scale-95 ${
        active ? (danger ? "bg-danger/10 text-danger" : "bg-accent-muted text-accent") : "text-text-muted hover:text-text"
      }`}
    >
      <span className="optical-center-text">{children}</span>
    </button>
  );
}
