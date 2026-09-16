import { useEffect, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Info, X } from "lucide-react";
import { IconButton } from "../primitives/IconButton";

export interface SidebarTabsDialogTab {
  id: string;
  icon: LucideIcon;
  label: string;
}

interface SidebarTabsDialogProps {
  /** Shown in the header breadcrumb as "Title > active tab label". */
  title: string;
  tabs: SidebarTabsDialogTab[];
  /** Optional extra tab pinned at the bottom of the icon rail (`mt-auto`),
   * visually set apart from `tabs` — mirrors SLDR's `SettingsModal`, which
   * pins a "Credits" tab below the regular settings tabs this way. */
  pinnedTab?: SidebarTabsDialogTab;
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onClose: () => void;
  closeLabel: string;
  /** The active tab's panel content. The caller already knows which tab is
   * active (it's driving `activeTabId`), so it just renders that one panel
   * itself — this shell has no opinion on how panels map to tab ids. */
  children: ReactNode;
}

/** Modal shell for a settings-style dialog: a narrow icon-only rail of tabs
 * down the left edge, a header breadcrumb + close button, and a scrollable
 * content panel — fixed dialog height so a tall panel scrolls internally
 * instead of pushing the dialog (and the app window) off-screen. Genericized
 * from SLDR's `SettingsModal`: this only ports the shell (rail + header +
 * scroll area), not any of the actual settings panels that used to live
 * inside it — those are business content the caller supplies as `children`. */
export function SidebarTabsDialog({
  title,
  tabs,
  pinnedTab,
  activeTabId,
  onSelectTab,
  onClose,
  closeLabel,
  children,
}: SidebarTabsDialogProps) {
  const activeTabLabel = tabs.find((tab) => tab.id === activeTabId)?.label ?? pinnedTab?.label ?? "";

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="animate-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sidebar-tabs-dialog-title"
        className="animate-modal-in flex h-[30rem] w-full max-w-lg overflow-hidden rounded-lg border border-border bg-surface shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <nav className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-border bg-bg/40 py-4">
          {tabs.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => onSelectTab(id)}
              aria-label={label}
              aria-pressed={activeTabId === id}
              title={label}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-all duration-150 active:scale-90 ${
                activeTabId === id ? "bg-accent-muted text-accent" : "text-text-muted hover:bg-surface-hover hover:text-text"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
            </button>
          ))}
          {pinnedTab && (
            <button
              type="button"
              onClick={() => onSelectTab(pinnedTab.id)}
              aria-label={pinnedTab.label}
              aria-pressed={activeTabId === pinnedTab.id}
              title={pinnedTab.label}
              className={`mt-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-all duration-150 active:scale-90 ${
                activeTabId === pinnedTab.id ? "bg-accent-muted text-accent" : "text-text-muted hover:bg-surface-hover hover:text-text"
              }`}
            >
              <pinnedTab.icon className="h-[18px] w-[18px]" />
            </button>
          )}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <h2 id="sidebar-tabs-dialog-title" className="text-sm font-medium text-text">
              <span className="text-text-muted">{title}</span>
              <span className="text-text-muted"> &gt; </span>
              {activeTabLabel}
            </h2>
            <IconButton onClick={onClose} aria-label={closeLabel} variant="ghost" size="sm">
              <X className="h-4 w-4" />
            </IconButton>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** Label/control pair for a settings-style row: label on the left, any
 * control (a `Switch`, a `SegmentedControl`, a button group) right-aligned.
 * Extracted from `SettingsModal` because this layout shape is generic enough
 * to reuse in any settings-like panel, not just inside `SidebarTabsDialog`. */
export function SidebarTabsDialogRow({ label, children, id }: { label: string; children: ReactNode; id?: string }) {
  return (
    <div id={id} className="flex items-center justify-between gap-4">
      <span className="text-text">{label}</span>
      {children}
    </div>
  );
}

/** Small "managed externally" note (e.g. "controlled by your organization")
 * pinned under a control that's locked by some outside authority — SLDR uses
 * it under theme/language pickers when SyncLink owns those settings. Kept
 * generic and exported since any settings panel might need the same pattern,
 * not just ones built inside `SidebarTabsDialog`. */
export function ManagedHint({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-1.5 pl-0.5 text-[0.6875rem] leading-tight text-text-muted">
      <Info className="h-3 w-3 shrink-0" />
      {label}
    </p>
  );
}

// NOTE on `PillButton` (SLDR's other nested helper, not ported here): its
// markup — `rounded-sm px-3 py-1 text-xs font-medium uppercase tracking-wide
// … active:scale-95`, accent-muted when active — is byte-for-byte the same
// visual language as the already-ported `Chip` primitive (`primitives/Chip.tsx`),
// just missing a `disabled` prop. Rather than duplicate that styling as a
// second component, use `Chip`/`SegmentedControl` for pill-style toggles in
// panels built on this shell; for a disabled group, wrap it the same way
// SLDR's own palette tab disables its body (`pointer-events-none opacity-40`
// on the wrapping element) instead of threading a `disabled` prop through.
