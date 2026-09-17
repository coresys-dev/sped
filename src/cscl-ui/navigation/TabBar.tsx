import { useEffect, useRef, useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { IconButton } from "../primitives/IconButton";
import { WindowControls } from "../window/WindowControls";
import { useNativeTrafficLights } from "../lib/hooks/useNativeTrafficLights";

export interface TabBarTab {
  id: string;
  /** Already-resolved display label — resolving it from whatever domain
   * object a tab represents (a folder, a saved search, …) is the caller's
   * job, this component only renders strings. */
  label: string;
}

export interface TabBarLabels {
  close: string;
  new: string;
}

interface TabBarProps {
  tabs: TabBarTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  labels: TabBarLabels;
  /** Set to `false` when this tab bar isn't the host window's own frame (no
   * window-chrome island to embed) — e.g. embedded inside a larger layout,
   * or a non-Tauri host. Defaults to `true`. */
  showWindowControls?: boolean;
  /** Pinned to the trailing edge of the tab island, after the "+" button
   * and outside the scrollable tab strip so it never scrolls out of view
   * (e.g. a settings button, an actions menu for the active tab). */
  trailing?: ReactNode;
}

/** Browser-style tab bar: each tab is a label + close button (the close
 * button only ever appears once there's more than one tab, so the user can
 * never close the last one) plus a trailing "+" to open a new tab. Embeds
 * the window-chrome island (`WindowControls`) at the trailing edge exactly
 * like SLDR's app frame does — a no-op empty spacer on macOS (native traffic
 * lights are repositioned into it by `useNativeTrafficLights`), the
 * reconstructed minimize/maximize/close trio on Windows/Linux. Panels for
 * each tab are expected to all stay mounted by the caller and only the
 * active one shown, so switching tabs doesn't lose scroll position/state. */
export function TabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  labels,
  showWindowControls = true,
  trailing,
}: TabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const islandRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useNativeTrafficLights(islandRef);

  // Fondu en bout de barre : uniquement visible si les onglets débordent
  // réellement (pas juste un décor permanent), pour adoucir la coupe nette
  // du dernier onglet tronqué par `overflow-x-auto`.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const checkOverflow = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    checkOverflow();
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(el);
    return () => observer.disconnect();
  }, [tabs.length]);

  return (
    <div className="m-3 mb-0 flex shrink-0 items-stretch gap-2">
      <div
        data-tauri-drag-region
        className="flex min-w-0 flex-1 items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1.5 shadow-float"
      >
        <div
          ref={scrollRef}
          data-tauri-drag-region
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
        >
          {tabs.map((tab) => {
            const active = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectTab(tab.id)}
                onKeyDown={(e) => e.key === "Enter" && onSelectTab(tab.id)}
                className={`group flex max-w-[12rem] shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors ${
                  active ? "bg-accent-muted text-accent" : "text-text-muted hover:bg-surface-hover hover:text-text"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{tab.label}</span>
                {tabs.length > 1 && (
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(tab.id);
                    }}
                    aria-label={labels.close}
                    title={labels.close}
                    variant="ghost"
                    size="sm"
                    className={active ? "opacity-70 hover:opacity-100" : "opacity-0 group-hover:opacity-100"}
                  >
                    <X className="h-3.5 w-3.5" />
                  </IconButton>
                )}
              </div>
            );
          })}
          <IconButton onClick={onNewTab} aria-label={labels.new} title={labels.new} variant="ghost" size="sm">
            <Plus className="h-3.5 w-3.5" />
          </IconButton>
          {overflowing && (
            <div
              aria-hidden
              className="pointer-events-none sticky right-0 w-8 shrink-0 self-stretch bg-gradient-to-r from-transparent to-surface"
            />
          )}
        </div>
        {trailing && <div className="flex shrink-0 items-center gap-1">{trailing}</div>}
      </div>
      {showWindowControls && (
        <div
          ref={islandRef}
          className="flex shrink-0 items-stretch overflow-hidden rounded-lg border border-border bg-surface shadow-float"
        >
          <WindowControls />
        </div>
      )}
    </div>
  );
}
