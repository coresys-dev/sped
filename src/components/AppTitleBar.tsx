import { WindowControls } from "../cscl-ui/window/WindowControls";
import type { DeviceStatus } from "../types";
import { ProfileManager, type ProfileManagerProps } from "./ProfileManager";

export interface AppTitleBarProps {
  deviceStatus: DeviceStatus | null;
  profileManager: ProfileManagerProps;
}

/** Merges cscl-ui's window-controls island into the app's own top bar
 * (see `src/cscl-ui/window/README.md` on `mergedElsewhere`) instead of
 * reserving a separate drag-strip above it -- one floating bar, the brand
 * on its drag region to the left, the reconstructed window controls as
 * their own small cluster at the right edge. */
export function AppTitleBar({ deviceStatus, profileManager }: AppTitleBarProps) {
  const connected = deviceStatus?.connected ?? false;

  return (
    <header
      data-tauri-drag-region
      className="animate-chrome-in mx-3 mt-3 flex h-11 shrink-0 items-stretch rounded-lg border border-border bg-surface shadow-float"
    >
      <div data-tauri-drag-region className="flex flex-1 items-center gap-4 pl-4">
        <span data-tauri-drag-region className="text-xs font-semibold tracking-wide text-text">
          Speed Editor Control
        </span>

        <div data-tauri-drag-region className="flex items-center gap-2 text-[11px] text-text-muted">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${connected ? "bg-accent" : "bg-surface-hover"}`}
            style={connected ? { boxShadow: "0 0 6px var(--color-accent)" } : undefined}
          />
          <span>
            Speed Editor{deviceStatus?.mock ? " (mock)" : ""} —{" "}
            <strong className="text-text">{connected ? "Connected" : "Disconnected"}</strong>
          </span>
        </div>

        <div data-tauri-drag-region className="flex-1" />

        <ProfileManager {...profileManager} />
      </div>

      <div className="flex shrink-0 items-stretch overflow-hidden rounded-r-lg border-l border-border">
        <WindowControls />
      </div>
    </header>
  );
}
