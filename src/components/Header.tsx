import type { DeviceStatus } from "../types";
import { ProfileManager, type ProfileManagerProps } from "./ProfileManager";
import styles from "./Header.module.css";

export interface HeaderProps {
  deviceStatus: DeviceStatus | null;
  profileManager: ProfileManagerProps;
  onOpenObsSettings: () => void;
}

export function Header({ deviceStatus, profileManager, onOpenObsSettings }: HeaderProps) {
  const connected = deviceStatus?.connected ?? false;

  return (
    <header className={styles.header}>
      <div className={styles.brand}>Speed Editor Control</div>

      <div className={styles.status}>
        <span className={[styles.dot, connected ? styles.on : styles.off].join(" ")} />
        <span>
          Speed Editor{deviceStatus?.mock ? " (mock)" : ""}
          <br />
          <strong>{connected ? "Connected" : "Disconnected"}</strong>
        </span>
      </div>

      <div className={styles.spacer} />

      <button type="button" className={styles.obsButton} onClick={onOpenObsSettings}>
        OBS Settings
      </button>

      <ProfileManager {...profileManager} />
    </header>
  );
}
