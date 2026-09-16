import type { DeviceStatus } from "../types";
import { ProfileManager, type ProfileManagerProps } from "./ProfileManager";

export interface HeaderProps {
  deviceStatus: DeviceStatus | null;
  profileManager: ProfileManagerProps;
}

export function Header({ deviceStatus, profileManager }: HeaderProps) {
  const connected = deviceStatus?.connected ?? false;

  return (
    <header className="animate-chrome-in mx-3 mt-3 flex h-12 shrink-0 items-center gap-4 rounded-lg border border-border bg-surface px-4 shadow-float">
      <div className="text-xs font-bold tracking-wide text-text">Speed Editor Control</div>

      <div className="flex items-center gap-2 text-[11px] text-text-muted">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            connected ? "bg-emerald-400 shadow-[0_0_6px_theme(colors.emerald.400)]" : "bg-zinc-600"
          }`}
        />
        <span>
          Speed Editor{deviceStatus?.mock ? " (mock)" : ""} —{" "}
          <strong className="text-text">{connected ? "Connected" : "Disconnected"}</strong>
        </span>
      </div>

      <div className="flex-1" />

      <ProfileManager {...profileManager} />
    </header>
  );
}
