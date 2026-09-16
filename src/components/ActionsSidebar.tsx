import type { ObsStatus } from "../types";
import styles from "./ActionsSidebar.module.css";

interface DraggableItemProps {
  label: string;
  payload: object;
  onActivate?: () => void;
}

function DraggableItem({ label, payload, onActivate }: DraggableItemProps) {
  return (
    <div
      className={styles.item}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-sped-action", JSON.stringify(payload));
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={onActivate}
      role={onActivate ? "button" : undefined}
    >
      <span className={styles.grip}>⠿</span>
      {label}
    </div>
  );
}

const OBS_TRANSPORT_ITEMS: { label: string; op: string }[] = [
  { label: "Start Recording", op: "start_recording" },
  { label: "Stop Recording", op: "stop_recording" },
  { label: "Pause Recording", op: "pause_recording" },
  { label: "Resume Recording", op: "resume_recording" },
  { label: "Start Streaming", op: "start_streaming" },
  { label: "Stop Streaming", op: "stop_streaming" },
];

export interface ActionsSidebarProps {
  obsStatus: ObsStatus;
  onCustomKeyboard: () => void;
}

export function ActionsSidebar({ obsStatus, onCustomKeyboard }: ActionsSidebarProps) {
  const scenes = obsStatus.state === "connected" ? obsStatus.scenes : [];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.heading}>Actions</div>

      <section className={styles.category}>
        <h3>Keyboard</h3>
        <DraggableItem label="Ctrl + B" payload={{ kind: "keyboard", keys: ["CTRL", "B"] }} />
        <DraggableItem label="Space" payload={{ kind: "keyboard", keys: ["SPACE"] }} />
        <DraggableItem label="Enter" payload={{ kind: "keyboard", keys: ["ENTER"] }} />
        <DraggableItem label="Esc" payload={{ kind: "keyboard", keys: ["ESC"] }} />
        <div className={styles.customItem} onClick={onCustomKeyboard} role="button">
          + Custom shortcut…
        </div>
      </section>

      <section className={styles.category}>
        <h3>OBS Studio</h3>
        <div className={styles.subheading}>
          Status:{" "}
          <span className={styles[obsStatus.state] ?? ""}>
            {obsStatus.state === "connected"
              ? "Connected"
              : obsStatus.state === "connecting"
                ? "Connecting…"
                : obsStatus.state === "error"
                  ? "Error"
                  : "Disconnected"}
          </span>
        </div>
        {scenes.length > 0 && (
          <>
            <div className={styles.subheading}>Scenes</div>
            {scenes.map((scene) => (
              <DraggableItem
                key={scene}
                label={scene}
                payload={{ kind: "obs", op: "switch_scene", scene }}
              />
            ))}
          </>
        )}
        <div className={styles.subheading}>Transport</div>
        {OBS_TRANSPORT_ITEMS.map((item) => (
          <DraggableItem key={item.op} label={item.label} payload={{ kind: "obs", op: item.op }} />
        ))}
      </section>

      <section className={styles.category}>
        <h3>System</h3>
        <div className={styles.comingSoon}>Coming soon</div>
      </section>

      <section className={styles.category}>
        <h3>Media</h3>
        <div className={styles.comingSoon}>Coming soon</div>
      </section>

      <section className={styles.category}>
        <h3>Applications</h3>
        <div className={styles.comingSoon}>Coming soon</div>
      </section>
    </aside>
  );
}
