import { api } from "../api";
import type { ControlEvent, DeviceStatus } from "../types";
import styles from "./DevPanel.module.css";

export interface DevPanelProps {
  deviceStatus: DeviceStatus | null;
  log: { time: string; event: ControlEvent }[];
  onClose: () => void;
}

const MOCK_CONTROLS = ["cut", "cam-1", "stop-play"];

function describe(event: ControlEvent): string {
  switch (event.type) {
    case "connected":
      return "Connected";
    case "disconnected":
      return "Disconnected";
    case "pressed":
      return `${event.control.toUpperCase()}  Pressed`;
    case "released":
      return `${event.control.toUpperCase()}  Released`;
    case "jog":
      return `JOG  ${event.delta > 0 ? "+" : ""}${event.delta}`;
    case "shuttle":
      return `SHTL  ${event.value}`;
  }
}

export function DevPanel({ deviceStatus, log, onClose }: DevPanelProps) {
  const mockActive = deviceStatus?.mock ?? false;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span>Speed Editor Events</span>
        <button type="button" onClick={onClose}>
          ×
        </button>
      </div>

      {mockActive ? (
        <div className={styles.mockControls}>
          {MOCK_CONTROLS.map((id) => (
            <button key={id} type="button" onClick={() => api.mockSend({ action: "tap", value: id })}>
              [ {id.toUpperCase()} ]
            </button>
          ))}
          <button type="button" onClick={() => api.mockSend({ action: "jog", value: 1 })}>
            [ JOG + ]
          </button>
          <button type="button" onClick={() => api.mockSend({ action: "jog", value: -1 })}>
            [ JOG - ]
          </button>
        </div>
      ) : (
        <div className={styles.hint}>Set SPED_MOCK=1 and restart to enable mock controls.</div>
      )}

      <div className={styles.log}>
        {log.map((entry, i) => (
          <div key={i} className={styles.logRow}>
            <span className={styles.time}>{entry.time}</span>
            <span>{describe(entry.event)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
